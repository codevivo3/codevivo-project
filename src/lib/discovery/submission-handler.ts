import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DISCOVERY_DRAFT_MAX_PAYLOAD_BYTES } from './draft-contract';
import { DiscoveryDraftValidationError } from './draft-value-validation';
import type { DiscoveryDraftWriteLimiter } from './draft-rate-limit-core';
import { isAllowedDiscoveryOrigin } from './origin';
import { applyDiscoverySecurityHeaders } from './security-headers';
import {
  DiscoverySubmissionValidationError,
  validateDiscoverySubmission,
} from './submission-contract';
import type {
  DiscoverySubmissionOutcome,
  DiscoverySubmissionRepository,
} from './submission-repository-core';

type SubmissionHandlerDependencies = {
  baseUrl?: string;
  enabled?: string;
  generateOutboxId?: () => string;
  generateSubmissionReference?: () => string;
  getSessionHash(): Promise<Buffer | null>;
  limit: DiscoveryDraftWriteLimiter;
  repository: DiscoverySubmissionRepository;
};

function response(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: applyDiscoverySecurityHeaders(
      new Headers({ 'Content-Type': 'application/json' }),
    ),
  });
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

function outcomeResponse(result: DiscoverySubmissionOutcome): Response {
  if (result.outcome === 'submitted' || result.outcome === 'replayed') {
    return response({
      status: 'submitted',
      outcome: result.outcome,
      submission: {
        reference: result.submission.reference,
        revision: result.submission.revision,
        submittedAt: result.submission.submittedAt.toISOString(),
      },
    }, result.outcome === 'submitted' ? 201 : 200);
  }
  if (result.outcome === 'conflict') {
    return response({ status: 'conflict', revision: result.revision }, 409);
  }
  if (result.outcome === 'mutation-conflict') {
    return response({ status: 'mutation-conflict' }, 409);
  }
  if (result.outcome === 'missing') return response({ status: 'missing' }, 404);
  return response({ status: 'unavailable' }, 401);
}

export async function handleDiscoverySubmission(
  request: Request,
  dependencies: SubmissionHandlerDependencies,
): Promise<Response> {
  if (dependencies.enabled !== 'true') return response({ status: 'disabled' }, 503);
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
  if (!allowed) return response({ status: 'unavailable' }, 429);

  let submission;
  try {
    submission = validateDiscoverySubmission(await parseJsonBody(request));
  } catch (error) {
    if (error instanceof DiscoverySubmissionValidationError) {
      return response({ status: 'invalid', errors: error.errors }, 422);
    }
    if (error instanceof Response) {
      return response({ status: 'invalid' }, error.status);
    }
    if (error instanceof DiscoveryDraftValidationError) {
      return response({ status: 'invalid' }, 400);
    }
    return response({ status: 'unavailable' }, 503);
  }

  const generateReference = dependencies.generateSubmissionReference
    ?? (() => `CV-${new Date().getUTCFullYear()}-${randomBytes(6).toString('hex').toUpperCase()}`);
  try {
    return outcomeResponse(await dependencies.repository.submit({
      outboxId: dependencies.generateOutboxId?.() ?? randomUUID(),
      sessionHash,
      submission,
      submissionReference: generateReference(),
    }));
  } catch {
    return response({ status: 'unavailable' }, 503);
  }
}
