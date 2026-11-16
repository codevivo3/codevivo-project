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
tokens as arguments and never prints invitation tokens. The current entry point
is intentionally restricted to the approved `discovery-validation` Neon
compute and Preview origin. A future production workflow must use a separate,
reviewed target configuration rather than weakening these validation checks.

```bash
DISCOVERY_BASE_URL='https://codevivo-project-git-discovery-validation-codevivo-team.vercel.app' \
  npm run discovery:admin -- create
npm run discovery:admin -- inspect
npm run discovery:admin -- revoke
```

Create prompts for client details and locale, stores only the invitation HMAC,
and copies the locale-aware link to the macOS clipboard. Inspect prompts for a
stable invitation ID. Revoke requires an explicit confirmation, is irreversible,
and atomically invalidates the invitation's active sessions. Invitation
replacement and email delivery are not implemented.

Before creating a validation invitation, compare the local Keychain pepper with
the branch-scoped deployed secret through an authenticated, linked Vercel CLI:

```bash
vercel env run -e preview --git-branch discovery-validation -- \
  npm run discovery:verify-pepper
```

The comparator prints only `MATCH` or exits with a generic failure. It never
prints either pepper or a reusable hash. Do not replace this check with shell
commands that echo, hash, or otherwise expose either secret.

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

### Recovery integration-test guard

Recovery database tests must use the dedicated `npm run test:db:recovery`
launcher. It verifies the fixed project and recovery branch through Neon's
read-only API, requires the exact read-write endpoint returned for that branch,
and validates direct role-specific connection URLs before starting the existing
database tests. Ordinary `npm run test:db` behavior is unchanged.

After creating `recovery-gate-20261116`, record its branch and read-write
endpoint IDs. Store a Neon API credential with access to read this project's
metadata, plus the three direct recovery database URLs, in macOS Keychain under
account `codevivo-project`. The launcher uses the credential only for two GET
requests:

- `codevivo.discovery.recovery.neon-api-key`
- `codevivo.discovery.recovery.runtime.database-url`
- `codevivo.discovery.recovery.admin.database-url`
- `codevivo.discovery.recovery.migration.database-url`

Then run:

```bash
DISCOVERY_RECOVERY_TEST_ALLOW='recovery-gate-20261116' \
DISCOVERY_RECOVERY_BRANCH_ID='br-cold-base-babuwept' \
DISCOVERY_RECOVERY_ENDPOINT_ID='ep-wild-silence-baxdsq4w' \
npm run test:db:recovery
```

The launcher rejects the validation source, pooled URLs, every other database
or role, and any branch or endpoint identity not confirmed by the Neon API.

### Guarded recovery executor

The recovery exercise must use `npm run discovery:recovery -- <stage>`. The
executor is pinned to project `round-tree-42808727`, recovery branch
`br-cold-base-babuwept`, parent `br-winter-block-bagymuuk`, and endpoint
`ep-wild-silence-baxdsq4w` at the exact direct hostname
`ep-wild-silence-baxdsq4w.c-8.eu-central-1.aws.neon.tech`. It requires at least
three hours of branch lifetime at the start of every stage. An expired branch or
a future replacement requires a reviewed code change; environment variables
cannot redirect the executor.

Set only non-secret execution metadata in the shell:

```bash
export DISCOVERY_RECOVERY_BRANCH_ID='br-cold-base-babuwept'
export DISCOVERY_RECOVERY_ENDPOINT_ID='ep-wild-silence-baxdsq4w'
export DISCOVERY_RECOVERY_ARCHIVE_DIR='/absolute/outside-repository/path'
```

The archive directory must already exist, be owned by the current user, have
mode `0700`, not be a symbolic link, and resolve outside the repository. The
executor refuses to overwrite archives, manifests, or checksum records.

Run the stages in this order:

```bash
npm run discovery:recovery -- preflight

DISCOVERY_RECOVERY_STAGE_ALLOW='backup-source:recovery-gate-20261116' \
  npm run discovery:recovery -- backup-source

DISCOVERY_RECOVERY_STAGE_ALLOW='prepare-fixtures:recovery-gate-20261116' \
  npm run discovery:recovery -- prepare-fixtures

DISCOVERY_RECOVERY_STAGE_ALLOW='backup-exercise:recovery-gate-20261116' \
  npm run discovery:recovery -- backup-exercise

DISCOVERY_RECOVERY_STAGE_ALLOW='restore:recovery-gate-20261116' \
  npm run discovery:recovery -- restore

DISCOVERY_RECOVERY_STAGE_ALLOW='validate:recovery-gate-20261116' \
  npm run discovery:recovery -- validate
```

Each non-preflight stage requires its exact, non-reusable authorization value.
Every stage repeats Keychain, Neon metadata, branch-expiration, endpoint, role,
database, direct-connection, and archive-directory checks before continuing.
The executor reads these Keychain services under account `codevivo-project`:

- `codevivo.discovery.recovery.neon-api-key`
- `codevivo.discovery.recovery.runtime.database-url`
- `codevivo.discovery.recovery.admin.database-url`
- `codevivo.discovery.recovery.migration.database-url`
- `codevivo.discovery.migration.database-url` (read-only source backup)

The original validation source is opened with PostgreSQL's
`default_transaction_read_only` setting. Synthetic fixtures are written only
to the disposable branch's cloned `neondb`. The restore destination is always
the empty `codevivo_recovery_gate` database. Connection URLs and passwords are
passed to PostgreSQL tools only through a reduced child-process environment;
they are never arguments or log output.

Backups stream directly from PostgreSQL 18 `pg_dump -Fc` to GnuPG AES-256
symmetric encryption. GnuPG obtains the passphrase through pinentry. No
plaintext archive is created. Each encrypted archive is first cryptographically
verified by draining the complete GnuPG plaintext stream to a non-persistent
sink. Catalog extraction is a separate `pg_restore --list` pass. A successful
catalog consumer may close early; only the exact GnuPG exit-`2` broken-pipe
case, without a conflicting GnuPG diagnostic, is accepted after full-stream
verification. Genuine decryption, integrity, passphrase, or catalog failures
remain fatal. The archive then receives a mode-`0600` SHA-256 record and
manifest. The extracted catalog is reused by restore, avoiding a redundant
catalog pass. Restore uses `--exit-on-error`,
`--single-transaction`, `--no-owner`, and a validated `--use-list`; `--clean`,
`--create`, and blanket ACL suppression are rejected. The filtered TOC metadata
is written exclusively to a randomly named mode-`0600` file in the validated
private archive directory. The decrypted archive payload remains streamed from
GnuPG to `pg_restore` and is never written to disk. The temporary TOC file is
removed after success or failure; a cleanup failure is a blocking security
error.

Pipeline diagnostics retain only a bounded amount of child-process error output
in memory and classify failures by process and safe category. Raw GnuPG and
PostgreSQL output is never logged or included in thrown errors. Restore failures
reinspect the destination and report whether it remained empty. When
`pg_restore` terminates early and GnuPG receives a corroborated broken pipe, the
consumer failure is reported; genuine decryption failures retain precedence.
Sanitized diagnostic errors identify the precise recovery stage:
`archive-full-stream-verification`, `archive-catalog-extraction`,
`toc-filtering`, `database-restore-streaming`, `temporary-toc-preparation`,
`temporary-toc-cleanup`, or `rollback-inspection`. Pipeline failures also report
only the process name, classified cause, exit code, termination signal, and
stream state. They never include captured standard error, archive contents,
credentials, or passphrases.
ACL restoration remains enabled: `--no-owner` does not suppress ACL/default-ACL
entries, and `--no-acl` would prevent the recovery exercise from proving the
approved runtime and administration grants. Before restore, the executor
requires exactly one
`public` tables default-ACL entry and one `public` sequences default-ACL entry
owned by Neon's provider role `cloud_admin`. It comments only those two entries
in the validated `pg_restore --use-list` catalog because the migration role
cannot assume `cloud_admin`; all application ACL entries remain selected. The
restore fails closed if either provider entry is missing, duplicated, malformed,
or has different metadata. This exception is intentionally specific to the
verified Neon archive format and must be reviewed if provider metadata changes.

Validation checks the migration checksum, schema objects, ownership, ACLs,
approved roles, exact synthetic fixtures, and the original source fingerprint,
then invokes the existing guarded database integration-test launcher. A failed
restore is inspected for partial state and stops. The executor never repairs,
cleans, retries, deletes, or revokes resources automatically.

After a successful report, separately authorize removal of the disposable
fixtures/branch, local encrypted archives according to the chosen retention
period, recovery Keychain entries, the dedicated Viewer API key, and its
project grant. Never delete evidence or credentials as part of a failed run.
