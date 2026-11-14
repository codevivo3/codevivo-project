\set ON_ERROR_STOP on

BEGIN;

DO $preflight$
BEGIN
  IF current_database() <> 'neondb' THEN
    RAISE EXCEPTION
      'Project Discovery bootstrap must run against database neondb, not %',
      current_database();
  END IF;

  IF current_user <> 'neondb_owner' THEN
    RAISE EXCEPTION
      'Project Discovery bootstrap must run as neondb_owner, not %',
      current_user;
  END IF;
END
$preflight$;

DO $roles$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'codevivo_discovery_runtime'
  ) THEN
    CREATE ROLE codevivo_discovery_runtime
      LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'codevivo_discovery_admin'
  ) THEN
    CREATE ROLE codevivo_discovery_admin
      LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'codevivo_discovery_migration'
  ) THEN
    CREATE ROLE codevivo_discovery_migration
      LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT;
  END IF;
END
$roles$;

-- PostgreSQL 18 gives a non-superuser role creator ADMIN TRUE but SET FALSE
-- on roles it creates. Temporarily allow the project owner to SET ROLE so the
-- migration role can own the schema, and temporarily allow that role to own a
-- schema in this database.
GRANT codevivo_discovery_migration TO CURRENT_USER
  WITH SET TRUE, INHERIT FALSE
  GRANTED BY CURRENT_USER;
GRANT CREATE ON DATABASE neondb TO codevivo_discovery_migration;

CREATE SCHEMA IF NOT EXISTS discovery
  AUTHORIZATION codevivo_discovery_migration;

ALTER SCHEMA discovery OWNER TO codevivo_discovery_migration;

-- Schema ACLs must be changed with the authority of the schema owner. SET is
-- local to this transaction and the bootstrap's membership grant is removed
-- below without affecting grants made by another grantor.
SET LOCAL ROLE codevivo_discovery_migration;

REVOKE ALL ON SCHEMA discovery FROM PUBLIC;
GRANT USAGE ON SCHEMA discovery TO
  codevivo_discovery_runtime,
  codevivo_discovery_admin;

RESET ROLE;

REVOKE CREATE ON DATABASE neondb FROM codevivo_discovery_migration;
REVOKE codevivo_discovery_migration FROM CURRENT_USER
  GRANTED BY CURRENT_USER;

DO $verification$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_namespace schema
    JOIN pg_roles owner ON owner.oid = schema.nspowner
    WHERE schema.nspname = 'discovery'
      AND owner.rolname = 'codevivo_discovery_migration'
  ) THEN
    RAISE EXCEPTION 'discovery schema owner verification failed';
  END IF;

  IF has_database_privilege(
    'codevivo_discovery_migration', current_database(), 'CREATE'
  ) THEN
    RAISE EXCEPTION 'migration role retained database CREATE privilege';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_auth_members membership
    JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
    JOIN pg_roles member_role ON member_role.oid = membership.member
    WHERE granted_role.rolname = 'codevivo_discovery_migration'
      AND member_role.rolname = current_user
      AND membership.set_option
  ) THEN
    RAISE EXCEPTION 'temporary migration-role SET membership remains';
  END IF;

  IF NOT has_schema_privilege(
    'codevivo_discovery_runtime', 'discovery', 'USAGE'
  ) OR has_schema_privilege(
    'codevivo_discovery_runtime', 'discovery', 'CREATE'
  ) THEN
    RAISE EXCEPTION 'runtime schema privilege verification failed';
  END IF;

  IF NOT has_schema_privilege(
    'codevivo_discovery_admin', 'discovery', 'USAGE'
  ) OR has_schema_privilege(
    'codevivo_discovery_admin', 'discovery', 'CREATE'
  ) THEN
    RAISE EXCEPTION 'administrative schema privilege verification failed';
  END IF;
END
$verification$;

COMMIT;

-- Set strong generated passwords separately with psql's interactive \password
-- command. Never add password literals to this file or SQL history.
