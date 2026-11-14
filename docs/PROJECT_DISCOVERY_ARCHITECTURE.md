# CodeVivo Project Discovery Architecture

## Status

Project Discovery V1 is an approved, invitation-only client questionnaire.

Milestone 1 established and validated the database foundation on disposable
Neon infrastructure. M2A adds invitation-token exchange, session authorization,
route protection, and mocked local tests. Administration commands, questionnaire
forms, live M2 integration tests, and notifications remain outside M2A.

## V1 Scope

V1 includes:

- private invitation links valid for 14 days;
- bilingual Italian and English questionnaire flows;
- durable drafts with optimistic revision control;
- one immutable final submission;
- a minimal local administrative CLI;
- Resend submission notifications with a persistent outbox;
- configurable retention for drafts and submitted briefs.

V1 excludes client accounts, proposal or contract delivery, project portals,
file uploads, signatures, payments, and PDF generation.

## Approved Architecture

### Persistence

- Neon PostgreSQL in an EU region is the persistent store.
- `@neondatabase/serverless` is the application driver.
- Application traffic uses a pooled Neon connection string.
- Migrations use a separate direct connection string and migration role.
- SQL is parameterized and migrations are explicit; no ORM is required for V1.

The driver supports non-interactive HTTP transactions and interactive
transactions through `Client` or `Pool`. Guarded integration tests cover the
selected HTTP transaction path once disposable Neon credentials are supplied.

### Database Roles

Three credentials remain separate:

1. **Runtime:** minimum privileges required by the deployed application.
2. **Administration:** invitation lifecycle, submission retrieval, retention
   reporting, and notification retry through the local CLI.
3. **Migration:** schema ownership and migrations only.

Administrative and migration credentials are supplied from macOS Keychain at
process launch. They must not be configured in Vercel or stored in repository
environment files.

### Invitation and Session Security

- Invitation tokens are cryptographically random bearer credentials.
- Only a keyed hash of an invitation token is stored.
- The token is delivered in a URL fragment and exchanged once for a distinct,
  server-generated session credential.
- Session credentials are stored only as hashes and sent in a Secure, HttpOnly,
  SameSite=Strict, `__Host-` cookie.
- Sessions have a non-renewing 12-hour lifetime capped by invitation expiry.
- Every protected read and mutation rechecks invitation expiry, revocation,
  token generation, session validity, and submission state.
- Mutations require same-origin POST requests and optimistic revision checks.
- Discovery routes must be no-store, noindex, no-referrer, and excluded from
  analytics.

Revocation is final for that invitation. No operation may reactivate it.
Invitation replacement is deferred beyond M2A; submitted briefs remain
immutable.

`DISCOVERY_TOKEN_PEPPER` is a server-only high-entropy secret with a minimum
length of 32 bytes. Emergency rotation invalidates every active V1 invitation
link and discovery session and therefore requires an explicit incident-response
decision.

### Questionnaire

The questionnaire uses one versioned, language-independent schema with
localized labels and validation messages. Only essential contact information,
project name and category, a meaningful description, privacy acknowledgement,
and deliberate final confirmation are required. All approved source fields
remain available; most discovery and technical fields are optional or support
an explicit undecided value.

Budget choices are:

- under EUR 1,000;
- EUR 1,000-2,499;
- EUR 2,500-4,999;
- EUR 5,000-9,999;
- EUR 10,000 or more;
- undecided;
- prefer not to say.

### Drafts and Submission

- Autosave is server-side and single-flight on the client.
- Each mutation includes an expected revision and idempotency identifier.
- Stale writes are rejected rather than overwriting newer answers.
- Hidden conditional answers may remain in drafts but are excluded from the
  normalized final submission.
- Final validation, immutable submission, reference generation, and outbox
  insertion occur atomically.

### Notifications and Retention

- Resend is reused for submission notifications.
- Notification failure cannot roll back or duplicate a submission.
- Failed outbox events are retried manually through the administrative CLI in
  V1.
- Abandoned drafts default to 30 days of retention after expiry or revocation.
- Submitted briefs provisionally default to 730 days after submission.
- Both retention periods are environment-configurable and require approved
  privacy wording before production launch.

## Environment Contract

`.env.example` is the source of truth for required variable names and safe
defaults. Populated secret values belong only in local ignored files, Vercel
secret storage, or macOS Keychain as appropriate.

Application runtime variables:

- `DATABASE_URL`
- `DISCOVERY_TOKEN_PEPPER`
- `DISCOVERY_BASE_URL`
- `DISCOVERY_NOTIFICATION_TO`
- `DISCOVERY_ABANDONED_RETENTION_DAYS`
- `DISCOVERY_SUBMITTED_RETENTION_DAYS`
- existing Resend and Upstash variables

Local process-only variables:

- `DISCOVERY_ADMIN_DATABASE_URL`
- `DISCOVERY_MIGRATION_DATABASE_URL`

## Milestone Boundaries

Milestone 2 may begin only after the Milestone 1 migration, role boundaries,
transactions, and recovery procedure have been verified against disposable
Neon infrastructure. It must not introduce future client lifecycle stages.

The defective Italian Service Agreement PDF remains outside Project Discovery
implementation and requires a separate document-correction task.
