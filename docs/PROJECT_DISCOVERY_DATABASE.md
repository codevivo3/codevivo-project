# Project Discovery Database Operations

## Purpose

This document defines the Milestone 1 database bootstrap, migration, credential,
test, and recovery procedures. It does not authorize production provisioning or
application features.

## Provisioning Boundary

Create the Neon project only after the project, EU region, and billing plan are
approved. Do not expose connection strings in tickets, commits, logs, or shell
arguments.

The three credentials have separate purposes:

- `DATABASE_URL`: pooled runtime connection configured in Vercel.
- `DISCOVERY_ADMIN_DATABASE_URL`: local administrative role, loaded from
  macOS Keychain at process launch.
- `DISCOVERY_MIGRATION_DATABASE_URL`: direct migration-role connection, loaded
  from macOS Keychain at process launch.

The deployed application must never receive the administration or migration
credentials.

## Bootstrap

Run `db/bootstrap/roles.sql` against the `neondb` database as `neondb_owner`
using `psql`. The file verifies both values, creates the three login roles
without passwords, temporarily grants only the PostgreSQL 18 privileges needed
to assign schema ownership, and creates or repairs the `discovery` schema
ownership. Schema ACLs are applied while operating as the migration owner:
runtime and administration receive `USAGE`, never `CREATE`. The bootstrap then
resets the active role, revokes only its own temporary membership grant and the
temporary database privilege, and verifies the effective privileges before
commit. A failed verification rolls back the transaction. It is safe to rerun
when the roles and schema already exist under the documented ownership.

Set strong, unique generated passwords with `psql`'s interactive `\password`
command after the file has completed. The command prompts without placing the
password in the SQL file or shell history.

Confirm that the migration role owns the `discovery` schema before running
migrations.

## macOS Keychain

Use Keychain Access to create password items with these service names:

- `codevivo.discovery.runtime.database-url`
- `codevivo.discovery.admin.database-url`
- `codevivo.discovery.migration.database-url`
- `codevivo.discovery.token-pepper`

Use `codevivo-project` as the account name. Store the complete connection URL
as the password value for database items and the high-entropy token pepper as
the password value for the pepper item. Use the pooled branch URL for runtime
and direct branch URLs for administration and migration. Limit access to the
local macOS account.
Local database validation and the administrative CLI read the relevant items
directly at process launch without printing them. Do not save any populated URL
in `.env.local` or a shell profile.

## Migrations

Migration files live in `db/migrations` and use the format
`NNNN_descriptive_name.sql`. Applied filenames and SHA-256 checksums are stored
in `discovery.schema_migrations`.

Run migrations with the direct migration-role URL supplied only to the process:

```bash
npm run db:migrate
```

The runner:

- obtains a PostgreSQL advisory lock;
- rejects changed checksums for applied migrations;
- applies each new migration in its own transaction;
- rolls back a failed migration;
- never runs down migrations or destructive cleanup automatically.

## Integration Tests

Database tests mutate and clean up disposable fixture data. They refuse to run
unless `DISCOVERY_DB_TEST_ALLOW=1` is explicitly supplied with all three role
connections.

```bash
npm run test:db
```

Run them only against a migrated disposable Neon branch. They validate
parameterized queries, commit, rollback, constraints, and role boundaries.
Never enable the guard against the production branch.

## Invitation Administration

The local TypeScript CLI reads the direct administration URL and token pepper
from the Keychain items above. It never accepts credentials or invitation
tokens as arguments and never prints invitation tokens.

```bash
npm run discovery:admin -- create
npm run discovery:admin -- inspect
npm run discovery:admin -- revoke
```

Create prompts for client details and locale, stores only the invitation HMAC,
and copies the locale-aware link to the macOS clipboard. Inspect prompts for a
stable invitation ID. Revoke requires an explicit confirmation, is irreversible,
and atomically invalidates the invitation's active sessions. Invitation
replacement and email delivery are not implemented.

## M2B Validation Gates

The live database suite reads the validation runtime URL, administration URL,
and matching token pepper from macOS Keychain. It verifies the fixed Frankfurt
validation compute, database, and role names before creating disposable rows.
Run it only after those three items are accessible:

```bash
DISCOVERY_M2B_LIVE_ALLOW=1 npm run test:m2b:database
```

The Upstash suite reads the existing ignored `.env.local` REST credentials and
uses a unique `codevivo:m2b:validation:*` namespace:

```bash
DISCOVERY_UPSTASH_TEST_ALLOW=1 npm run test:m2b:upstash
```

Both guards default to disabled. Never enable the database guard with a
production connection, and never copy credential values into command arguments
or terminal output.

## Backup and Recovery

Neon restore history is the first recovery layer. Production readiness also
requires a tested logical backup process using the direct migration connection.

Recommended procedure:

1. Retrieve the migration URL from macOS Keychain without printing it.
2. Run `pg_dump` in custom format with encrypted destination storage.
3. Record the backup timestamp, migration version, checksum, and retention.
4. Create a disposable Neon branch or separate development database.
5. Restore with `pg_restore` into that disposable target.
6. Run `npm run test:db` against the restored target.
7. Confirm row counts, constraints, permissions, and migration history.
8. Delete the disposable target only after validation.

Never test restoration by overwriting production. The database is not
production-ready until an actual backup and disposable restore have succeeded
and the result has been recorded.
