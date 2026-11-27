# Project Discovery V1 Operations

This runbook describes configuration contracts only. It does not authorize a
production migration, environment change, invitation, notification, scheduler,
or deployment.

## Global activation and rollback

`DISCOVERY_ENABLED` is the fail-closed public activation switch. Missing,
`false`, and every value other than exactly `true` prevent the Discovery pages,
invitation exchange, draft endpoints, and submission endpoint from reaching
database or Redis operations. `DISCOVERY_DRAFT_PERSISTENCE_ENABLED` remains a
separate draft/submission persistence prerequisite.

Administration and notification delivery are intentionally independent of the
global client switch. Disabling Discovery does not delete invitations, sessions,
drafts, submitted briefs, or queued notification events. The administration CLI
remains available for incident response, and the worker remains controlled only
by `DISCOVERY_OUTBOX_WORKER_ENABLED` and its dedicated bearer secret. This lets
CodeVivo finish or pause queued delivery without reopening the client surface.

For initial rollout, deploy migrations and configuration with
`DISCOVERY_ENABLED=false` and `DISCOVERY_OUTBOX_WORKER_ENABLED=false`. Activate
only after isolated and production smoke gates pass. Immediate application
rollback is to set `DISCOVERY_ENABLED=false` and redeploy; do not roll back data
or reverse completed submissions.

## Guarded administration

Every invocation requires an explicit environment:

```text
npm run discovery:admin -- --environment validation <command>
npm run discovery:admin -- --environment production <command>
```

Commands are `create`, `inspect`, `retrieve`, `revoke`, and `extend`. The CLI
validates the URL hostname, direct/non-pooled endpoint, database, admin role,
canonical origin, and connected PostgreSQL identity before operating. It never
falls back between environments. Production create, revoke, and extend actions
require an additional typed production confirmation.

Validation continues to use these Keychain services under account
`codevivo-project`:

- `codevivo.discovery.admin.database-url`
- `codevivo.discovery.token-pepper`

Production requires separately provisioned entries:

- `codevivo.discovery.production.admin.database-url`
- `codevivo.discovery.production.token-pepper`

Before production use, independently verify and provide these non-secret,
process-only identifiers:

- `DISCOVERY_PRODUCTION_ADMIN_HOST`
- `DISCOVERY_PRODUCTION_DATABASE`
- `DISCOVERY_PRODUCTION_ORIGIN=https://codevivo.dev`
- `DISCOVERY_BASE_URL=https://codevivo.dev`

The production host and database are deliberately not committed or inferred.
The production pepper must match the deployed runtime value without displaying
either value. Production invitations must be created only after migrations and
role permissions pass their authorized gate.

Invitation links are copied directly to the macOS clipboard and never printed.
Treat the clipboard as sensitive and clear it after transferring the link via
the approved client communication channel.

## Submitted-brief retrieval

Retrieve exactly one immutable submitted brief by its reference:

```text
npm run discovery:admin -- --environment <validation|production> retrieve
```

The CLI emits a structured JSON representation containing the stable
questionnaire identifiers and answers, schema version, locale, submission
reference and timestamp, and the invitation client identity. It performs one
read-only query restricted to `state = 'submitted'`; it does not expose a web
endpoint or update the brief.

The output contains client information. Use a private terminal, avoid shared
screen recordings and shell transcript capture, and do not redirect it into an
unencrypted or repository-managed file. If an export is operationally required,
store it only in an approved encrypted location with access and deletion
controls.

## Notification scheduling and retry

The worker contract is documented in
`docs/PROJECT_DISCOVERY_NOTIFICATION_WORKER.md`. It supports a five-minute HTTPS
GET schedule using a dedicated `Authorization: Bearer` header and no URL
credentials. The current Vercel account tier, protected-deployment behavior,
external scheduler frequency, timeout, and monitoring options require manual
dashboard verification before activation.

Manual retry does not mutate a submission. Leave a retryable event scheduled
and invoke one authenticated bounded worker batch. Do not edit attempt counts or
force a sent event back to pending. Exhausted or ambiguous events require review
of their sanitized category and Resend's 24-hour idempotency window before any
administrative database correction is separately authorized.

## Privacy and retention review

Technical inventory for the V1 privacy review:

- Data: invitation identity and email, session and invitation metadata,
  questionnaire answers, draft editing state, submission reference and time,
  delivery status, and provider message identifier.
- Purposes: invitation-only project discovery, draft continuity, project brief
  assessment, client follow-up, security, abuse prevention, delivery recovery,
  and backup/recovery.
- Storage/processors: Neon PostgreSQL, Upstash Redis rate limiting, Vercel
  application hosting/logging, Resend internal notification delivery, and the
  approved backup archive location.
- Access: authorized CodeVivo administrators and restricted application roles;
  client access is limited by invitation/session ownership.
- Expiry: invitations use their configured expiry; sessions are capped at 12
  hours and cannot outlive invitation authorization.
- Deletion: no automated destructive retention is implemented. An authorized,
  documented administrative deletion procedure and backup-expiry treatment are
  required before production retention claims can be finalized.

The configured draft and submitted-brief retention values are technical policy
inputs, not approved legal periods. The legal basis, controller identity and
address, final retention periods, processor agreements, client rights process,
and treatment of records in backups require developer/legal approval.

### Draft wording for review — English

> Information provided through Project Discovery is used to assess and respond
> to your project enquiry, maintain your invitation-only questionnaire session,
> and support security and service recovery. The information may be processed
> using CodeVivo's hosting, database, rate-limiting, email-delivery, and backup
> providers. Access is limited to authorized CodeVivo operations. Retention
> periods, the legal basis, controller details, and the process for exercising
> privacy rights must be confirmed in the approved Privacy Notice before this
> service is activated for clients.

### Testo provvisorio per revisione — Italiano

> Le informazioni fornite tramite Project Discovery sono utilizzate per
> valutare e rispondere alla richiesta di progetto, mantenere la sessione del
> questionario accessibile solo su invito e supportare la sicurezza e il
> ripristino del servizio. Le informazioni possono essere trattate tramite i
> fornitori di hosting, database, limitazione delle richieste, consegna email e
> backup di CodeVivo. L'accesso è limitato alle operazioni CodeVivo autorizzate.
> I periodi di conservazione, la base giuridica, i dati del titolare e la
> procedura per esercitare i diritti privacy devono essere confermati
> nell'Informativa Privacy approvata prima dell'attivazione del servizio per i
> clienti.

These paragraphs are review drafts, not published legal notices and not evidence
of consent or approval.

## Production release checklist

1. Approve final bilingual privacy wording, controller details, legal basis,
   retention periods, deletion procedure, processor terms, and backup handling.
2. Independently verify the production Neon project, branch, endpoint, database,
   region, direct and pooled hosts, and role identities.
3. Provision environment-specific runtime, admin, migration, pepper, Redis,
   Resend, notification recipient, and worker credentials without reuse from
   validation.
4. Apply and checksum-verify migrations `0001` through `0004` in order using the
   migration role; verify runtime/admin grants and submitted-brief immutability.
5. Run the authorized database suites, including submission atomicity and
   notification claim, lease, retry, and stale-worker fencing.
6. Deploy with both activation flags false and verify canonical EN/IT routing,
   security headers, Contact isolation, disabled APIs, and zero worker dispatch.
7. Validate one guarded production administration identity check without
   creating an invitation, then separately authorize a synthetic invitation.
8. Complete browser acceptance for invitation exchange, drafts, final
   submission, durable confirmation, refresh restoration, and disabled rollback.
9. Complete controlled Resend delivery and ambiguous/retry verification without
   exposing questionnaire answers.
10. Verify the scheduler/account-tier decision, monitoring, emergency shutdown,
    and secret-rotation procedure; activate the worker and scheduler only after
    approval.
11. Enable `DISCOVERY_ENABLED=true` only after all blocking gates pass. Confirm
    the first real-client invitation separately.
