# Project Discovery Notification Worker

Project Discovery final submission creates one durable
`project_brief_submitted` outbox event in the same transaction that makes the
brief immutable. Delivery is separate: a notification failure cannot roll back
or repeat the client submission.

The server-only worker exposes one bounded batch at:

`GET /api/internal/discovery-notifications`

It is disabled unless `DISCOVERY_OUTBOX_WORKER_ENABLED` is exactly `true` and
requires `Authorization: Bearer <DISCOVERY_OUTBOX_WORKER_SECRET>`. The endpoint
returns only aggregate counters, sets `Cache-Control: no-store, max-age=0`, and
never returns event identifiers, client details, questionnaire answers,
provider responses, or credentials.

## Runtime configuration

- `DATABASE_URL`: pooled connection for `codevivo_discovery_runtime`.
- `RESEND_API_KEY`: server-only transactional-email credential.
- `DISCOVERY_NOTIFICATION_TO`: approved internal recipient address.
- `DISCOVERY_OUTBOX_WORKER_ENABLED`: `false` until migration and controlled
  verification are complete.
- `DISCOVERY_OUTBOX_WORKER_SECRET`: dedicated 32–256 byte printable bearer
  secret. Do not reuse Contact, invitation, session, or scheduler credentials.

Migration `0004_discovery_final_submission.sql` owns the notification claim and
finalization boundary. The runtime role can execute the three narrow functions
but cannot directly insert or update outbox delivery state. Claims use
`FOR UPDATE SKIP LOCKED`, a ten-minute lease, attempt fencing, a 20-event batch,
and concurrency of three. Provider calls occur after the claim transaction has
closed.

## Delivery and privacy

The CodeVivo-facing email contains only the submission reference, client name
and email, questionnaire locale, and submission timestamp. It intentionally
excludes questionnaire answers. Complete brief retrieval remains an
administrative database workflow using the submission reference; this
iteration does not add a public or production administration interface.

The database event idempotency key is reused as Resend's idempotency key.
Temporary, rate-limit, concurrent-idempotency, and ambiguous outcomes retry
with bounded exponential backoff. Configuration, validation, authorization,
and conflicting-idempotency errors are terminal. A stale worker cannot finalize
a newer attempt. If Resend accepted a message but finalization failed, the
lease is left intact and the next attempt reuses the same key.

Resend retains idempotency records for 24 hours. Recovery beyond that window is
at-least-once and can duplicate the internal notification; it is not an
exactly-once guarantee.

## Activation and scheduling

No scheduler is configured by the repository. Reuse the approved external
HTTPS scheduler pattern only after production authorization:

1. Apply and checksum-verify migrations in order through `0004`.
2. Verify the runtime has function execution but no direct outbox insert or
   delivery-column update privileges.
3. Configure environment-isolated database, Resend, recipient, and worker
   secrets with the worker disabled.
4. Deploy and verify disabled, unauthorized, and controlled empty-batch paths.
5. Enable the worker in the intended environment and configure an HTTPS `GET`
   every five minutes with the bearer secret in the `Authorization` header,
   never in the URL.
6. Monitor non-200 responses and aggregate failure counters.

Overlapping invocations are safe. Missed schedules leave events durable for a
later invocation. Emergency shutdown is performed by disabling the scheduler,
setting `DISCOVERY_OUTBOX_WORKER_ENABLED=false`, and deploying that environment
snapshot. Rotating the dedicated worker secret revokes scheduler access without
invalidating client invitations or sessions.
