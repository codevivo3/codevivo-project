# Contact Notification Worker

The contact notification worker exposes one server-only dispatcher batch at:

`GET /api/internal/contact-notifications`

The route is reachable over HTTPS, but it fails closed unless the worker is
explicitly enabled and the request supplies the dedicated bearer secret. It
does not use Project Discovery credentials and it does not accept credentials
in the URL.

## Required environment

- `CONTACT_OUTBOX_WORKER_ENABLED`: set to `true` only after the activation
  checklist is complete. Every other value keeps the endpoint disabled.
- `CONTACT_OUTBOX_WORKER_SECRET`: a dedicated, randomly generated bearer token
  containing 32 to 256 printable, non-whitespace bytes.
- `CONTACT_DATABASE_URL`: the pooled connection for the restricted
  `codevivo_contact_runtime` role.
- `RESEND_API_KEY`: the restricted Resend credential used for transactional
  contact notifications.

Use different worker secrets for validation and production environments. Never
commit them, put them in URLs, reuse them for another service, or include them
in logs and support requests.

## Manual cron-job.org setup

Do not create or enable the job until the application has passed controlled
verification.

1. Create an HTTPS `GET` job for
   `https://codevivo.dev/api/internal/contact-notifications`.
2. Select an execution interval of every five minutes.
3. Add the custom header `Authorization` with the value
   `Bearer <CONTACT_OUTBOX_WORKER_SECRET>`.
4. Do not place the secret in the URL, query string, request body, title, or
   description.
5. Disable response-body storage if the account interface offers that option.
   The endpoint is sanitized regardless, but third-party retention should be
   minimized.
6. Enable notification on the first failure, recovery notification, and job
   disablement notification.
7. Leave the job disabled until the activation checklist is complete.

cron-job.org supports custom request headers and five-minute schedules. Its
request timeout is 30 seconds, so the Vercel route is bounded to 25 seconds and
returns only a small JSON result. The scheduler remains an external holder of
the dedicated bearer secret; that residual trust is why the credential must be
single-purpose and readily revocable.

## Activation checklist

1. Confirm the production contact migration and role grants are verified.
2. Confirm `CONTACT_DATABASE_URL` authenticates only as
   `codevivo_contact_runtime` and cannot access Discovery data.
3. Confirm the production Resend sender and recipient configuration.
4. Configure a new production worker secret in Vercel and cron-job.org without
   copying it into files or terminal history.
5. Deploy with `CONTACT_OUTBOX_WORKER_ENABLED=false` and verify the route returns
   `503` without dispatching.
6. Perform one controlled authenticated verification with synthetic data.
7. Set `CONTACT_OUTBOX_WORKER_ENABLED=true`, redeploy, then enable the scheduler.
8. Confirm one successful scheduler execution and zero test-fixture residue.

## Monitoring and recovery

The response and runtime log contain only aggregate counters: claimed, sent,
retries scheduled, permanent failures, ambiguous outcomes, database failures,
and stale claims. They never contain contact details, messages, event IDs,
provider payloads, or credentials.

- `200`: one bounded batch completed. Persisted retries may still be scheduled.
- `401`: missing or incorrect bearer authentication.
- `503`: worker disabled, configuration unavailable, or database unavailable.
- `500`: unexpected sanitized worker failure.

Overlapping calls are safe because the repository claims rows with
`FOR UPDATE SKIP LOCKED` and finalizes them with attempt-aware compare-and-set
updates. A timed-out invocation leaves its claims protected by the ten-minute
lease; a later invocation can recover them after expiry.

cron-job.org does not guarantee exact execution times and can disable a job
after repeated failures. The next successful invocation processes still-due
events. Investigate repeated non-200 responses, permanent failures, database
failures, and ambiguous provider outcomes before forcing any replay.

Resend retains idempotency records for 24 hours. Recovery after that window is
at-least-once and may produce a duplicate message. Inspect affected events
before replaying a backlog older than 24 hours.

## Secret rotation and emergency shutdown

For planned rotation:

1. Temporarily disable the cron-job.org job.
2. Generate a new dedicated secret and update the Vercel environment securely.
3. Redeploy, then replace the scheduler's `Authorization` header.
4. Run one controlled request and re-enable the schedule after it succeeds.

For emergency shutdown, disable the cron-job.org job immediately, set
`CONTACT_OUTBOX_WORKER_ENABLED=false`, and redeploy. Rotating the worker secret
revokes the previous scheduler credential without affecting database or
Project Discovery credentials.
