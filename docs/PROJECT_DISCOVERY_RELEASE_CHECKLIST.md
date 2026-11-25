# Project Discovery Pre-Production Checklist

This checklist records release gates that remain open after the Phase 2 draft
persistence work. An unchecked item is not evidence of failure; it has not yet
been completed and verified for production.

## Repository and evidence

- [ ] Audit repository files and rationalize tests before production. Preserve
  permanent unit, integration, database, recovery, and security regression
  coverage while separately identifying temporary diagnostics, branch-pinned
  validation scripts, one-off artifacts, and generated development files.
- [ ] Run an independent automated secret scan over the repository and relevant
  Git history, explicitly including commit `2304a76`.
- [ ] Review and document the tracking policy for generated Next.js files,
  including `next-env.d.ts`.
- [ ] Complete the full application integration, accessibility, responsive,
  localization, database, and security regression suites on the release commit.

## Production infrastructure

- [ ] Audit effective PostgreSQL privileges for the production migration,
  administration, Discovery runtime, and contact runtime roles.
- [ ] Verify all production environment-variable names, scopes, values, and
  ownership without exposing secret values in logs or review artifacts.
- [ ] Confirm migration checksums, backup/restore readiness, retention settings,
  feature flags, monitoring, and rollback procedures.
- [ ] Perform a final deployment-readiness review and record the approved release
  owner, deployment target, validation evidence, and rollback decision.

No item may be marked complete without retained evidence from the corresponding
review or validation run. No test or validation infrastructure should be deleted
solely because it appears milestone-specific; classify its regression and
operational value first.
