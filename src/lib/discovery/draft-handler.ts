import { createHash, randomUUID } from 'node:crypto';
import type { DiscoveryDraftRepository } from './draft-repository-core';
import {
  DISCOVERY_DRAFT_MAX_PAYLOAD_BYTES,
  createDiscoveryDraftDefaults,
  getDiscoveryDraftRetentionDays,
  validateDiscoveryDraftLocale,
  validateDiscoveryDraftMutation,
  type DiscoveryDraftOutcome,
} from './draft-contract';
import type { DiscoveryDraftWriteLimiter } from './draft-rate-limit-core';
import { isAllowedDiscoveryOrigin } from './origin';
import { applyDiscoverySecurityHeaders } from './security-headers';

type DraftHandlerDependencies = {
  baseUrl?: string;
  enabled?: string;
  getSessionHash(): Promise<Buffer | null>;
  limit: DiscoveryDraftWriteLimiter;
  repository: DiscoveryDraftRepository;
  retentionDays?: string;
};

function response(body: object, status: number): Response {
  const headers = applyDiscoverySecurityHeaders(
    new Headers({ 'Content-Type': 'application/json' }),
  );
  return new Response(JSON.stringify(body), { status, headers });
}

function draftBody(result: Extract<DiscoveryDraftOutcome, { draft: unknown }>) {
  return {
    status: result.outcome,
    draft: {
      ...result.draft,
      updatedAt: result.draft.updatedAt.toISOString(),
    },
  };
}

function outcomeResponse(result: DiscoveryDraftOutcome, successStatus = 200): Response {
  if ('draft' in result) {
    return response(
      draftBody(result),
      result.outcome === 'conflict' ? 409 : successStatus,
    );
  }
  if (result.outcome === 'unauthorized') return response({ status: 'unavailable' }, 401);
  if (result.outcome === 'missing') return response({ status: 'missing' }, 404);
  if (result.outcome === 'submitted') return response({ status: 'submitted' }, 409);
  return response({ status: 'mutation-conflict' }, 409);
}

function enabled(dependencies: DraftHandlerDependencies): boolean {
  return dependencies.enabled === 'true';
}

function getRequestIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || headers.get('x-real-ip')
    || 'unknown';
}

async function parseJsonBody(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    throw new Response(null, { status: 415 });
  }
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > DISCOVERY_DRAFT_MAX_PAYLOAD_BYTES) {
    throw new Response(null, { status: 413 });
  }
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > DISCOVERY_DRAFT_MAX_PAYLOAD_BYTES) {
    throw new Response(null, { status: 413 });
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Response(null, { status: 400 });
  }
}

async function authorizeWrite(
  request: Request,
  dependencies: DraftHandlerDependencies,
): Promise<Buffer | Response> {
  if (!isAllowedDiscoveryOrigin(request, dependencies.baseUrl)) {
    return response({ status: 'unavailable' }, 403);
  }
  let sessionHash: Buffer | null;
  try {
    sessionHash = await dependencies.getSessionHash();
  } catch {
    sessionHash = null;
  }
  if (!sessionHash) return response({ status: 'unavailable' }, 401);
  const sessionDigest = createHash('sha256').update(sessionHash).digest('hex');
  let allowed = false;
  try {
    allowed = await dependencies.limit({
      ipAddress: getRequestIp(request.headers),
      sessionDigest,
    });
  } catch {
    allowed = false;
  }
  return allowed ? sessionHash : response({ status: 'unavailable' }, 429);
}

export async function handleDiscoveryDraftGet(
  dependencies: DraftHandlerDependencies,
): Promise<Response> {
  if (!enabled(dependencies)) return response({ status: 'disabled' }, 503);
  let sessionHash: Buffer | null;
  try {
    sessionHash = await dependencies.getSessionHash();
  } catch {
    sessionHash = null;
  }
  if (!sessionHash) return response({ status: 'unavailable' }, 401);
  try {
    return outcomeResponse(await dependencies.repository.read({ sessionHash }));
  } catch {
    return response({ status: 'unavailable' }, 503);
  }
}

export async function handleDiscoveryDraftPost(
  request: Request,
  dependencies: DraftHandlerDependencies,
): Promise<Response> {
  if (!enabled(dependencies)) return response({ status: 'disabled' }, 503);
  const authorized = await authorizeWrite(request, dependencies);
  if (authorized instanceof Response) return authorized;
  let locale: 'en' | 'it';
  try {
    const body = await parseJsonBody(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    const keys = Object.keys(body);
    if (keys.length !== 1 || keys[0] !== 'locale') throw new Error();
    locale = validateDiscoveryDraftLocale((body as { locale?: unknown }).locale);
  } catch (error) {
    if (error instanceof Response) {
      return response({ status: 'unavailable' }, error.status);
    }
    return response({ status: 'unavailable' }, 400);
  }
  let retentionDays: number;
  try {
    retentionDays = getDiscoveryDraftRetentionDays(dependencies.retentionDays);
  } catch {
    return response({ status: 'unavailable' }, 503);
  }
  try {
    const result = await dependencies.repository.initialize({
      briefId: randomUUID(),
      defaultAnswers: createDiscoveryDraftDefaults(),
      locale,
      retentionDays,
      sessionHash: authorized,
    });
    return outcomeResponse(result, result.outcome === 'created' ? 201 : 200);
  } catch {
    return response({ status: 'unavailable' }, 503);
  }
}

export async function handleDiscoveryDraftPut(
  request: Request,
  dependencies: DraftHandlerDependencies,
): Promise<Response> {
  if (!enabled(dependencies)) return response({ status: 'disabled' }, 503);
  const authorized = await authorizeWrite(request, dependencies);
  if (authorized instanceof Response) return authorized;
  let mutation;
  try {
    mutation = validateDiscoveryDraftMutation(await parseJsonBody(request));
  } catch (error) {
    if (error instanceof Response) {
      return response({ status: 'unavailable' }, error.status);
    }
    return response({ status: 'unavailable' }, 400);
  }
  try {
    return outcomeResponse(
      await dependencies.repository.update({ mutation, sessionHash: authorized }),
    );
  } catch {
    return response({ status: 'unavailable' }, 503);
  }
}
