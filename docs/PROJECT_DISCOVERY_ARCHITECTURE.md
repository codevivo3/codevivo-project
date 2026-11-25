# CodeVivo Project Discovery Architecture

## Status

Project Discovery V1 is an approved, invitation-only client questionnaire.

Milestone 1 established and validated the database foundation on disposable
Neon infrastructure. M2A and M2B completed invitation-token exchange, session
authorization, route protection, administrative invitation operations, and live
security validation. Phase 2B.1 completed the secure draft persistence
foundation. Phase 2B.2 connects that foundation to the questionnaire through
restoration, autosave, retry, and explicit conflict handling. Passwordless
questionnaire recovery remains Phase 2B.3.

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

Questionnaire schema `2.0` uses stable, language-independent field and option
identifiers with localized labels and validation messages. First name, last
name, email, project category, a meaningful business description, conditional
"Other" details, and deliberate final confirmation
are required. Company or organisation and project name are optional. Target
audience, desired visitor actions, required languages, and visual style use
structured multi-selection answers with explicit undecided choices where
appropriate. This is a breaking answer-shape change from schema `1.0`, but no
server-side questionnaire drafts existed when schema `2.0` was approved, so no
stored-answer migration was required. Phase 2B.1 now creates and validates every
draft explicitly as schema `2.0`.

An authenticated invitation may pre-fill its own email address. The value
remains editable and is copied only into local questionnaire state. Invitation
`client_name` is deliberately not split or assigned to a person or company.
There is currently no trusted contact-inquiry-to-invitation relationship, so
contact inquiry data must not be retrieved by matching an email address. Phase
2 may extend pre-fill only after an explicit, authorization-checked association
exists.

Budget choices are:

- under EUR 1,000;
- EUR 1,000-2,499;
- EUR 2,500-4,999;
- EUR 5,000-9,999;
- EUR 10,000 or more;
- undecided;
- prefer not to say.

#### Future private attachments (Phase 2.1)

Optional visual-reference attachments belong to the
`coloursAndVisualReferences` answer. The proposed contract is an ordered array
of records containing a stable attachment UUID, brief UUID, owning invitation
UUID, original filename, sanitized display filename, MIME type, byte size,
SHA-256 digest, private storage object key, upload state, creation timestamp,
and deletion timestamp. Questionnaire answers store attachment UUID references,
not public URLs or file contents.

Uploads require an authenticated, invitation-owned brief; a strict MIME and
size allowlist; server-issued short-lived upload authorization; malware and
content validation before an object becomes available; encryption in transit
and at rest; private storage with no anonymous listing or reads; audit-safe
metadata; retention aligned with the owning draft or submitted brief; and
authorization checks on every download and deletion. Failed or abandoned
uploads must be quarantined or removed. No upload control is displayed until
this complete storage and authorization path exists.

### Drafts and Submission

- Autosave is server-side and single-flight on the client.
- Each mutation includes an expected revision and idempotency identifier.
- Stale writes are rejected rather than overwriting newer answers.
- Hidden conditional answers may remain in drafts but are excluded from the
  normalized final submission.
- Final validation, immutable submission, reference generation, and outbox
  insertion occur atomically.

Phase 2B.1 provides feature-gated authenticated draft initialization, reads, and
revision-based updates. Phase 2B.2 owns the client lifecycle:

1. read the authorized draft before enabling editing;
2. initialize only after an explicit missing result;
3. hydrate the last server-acknowledged answers, progress, and bounded editing
   state;
4. debounce normal changes while allowing only one mutation in flight;
5. retain the immutable mutation identifier and payload after an ambiguous
   failure;
6. queue newer edits separately and advance revisions only after acknowledgement;
7. stop automatic writes on authorization failure, submission, or conflict; and
8. require an explicit discard action before replacing local work with a newer
   conflicting server snapshot.

Valid dates remain canonical ISO date-only values. Incomplete date and phone
text is stored only in the bounded draft editing state. Questionnaire content is
never stored in `localStorage`, `sessionStorage`, or IndexedDB.

The save indicator reports only server-acknowledged state as saved. A tab close,
browser close, device failure, or navigation before acknowledgement can still
lose the latest in-memory changes; unload-time delivery is not treated as a
recovery guarantee.

Draft persistence remains disabled unless
`DISCOVERY_DRAFT_PERSISTENCE_ENABLED=true`. Activation requires migration `0003`,
the approved runtime role, isolated environment configuration, live API and
browser validation, and a reviewed rollback plan. Production activation is a
separate authorization.

Phase 2B.3 is reserved for passwordless recovery requests, short-lived hashed
tokens, safe redemption, session replacement, and recovery email delivery. It
must not weaken invitation expiry or revocation.

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
