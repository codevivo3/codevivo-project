import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client } from '@neondatabase/serverless';

const connectionString = process.env.DISCOVERY_MIGRATION_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DISCOVERY_MIGRATION_DATABASE_URL must be supplied at process launch',
  );
}

const migrationsDirectory = resolve('db', 'migrations');
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((file) => /^\d{4}_[a-z0-9_]+\.sql$/u.test(file))
  .sort((left, right) => left.localeCompare(right));

if (migrationFiles.length === 0) {
  throw new Error('No database migrations were found');
}

const client = new Client({ connectionString });

await client.connect();

try {
  await client.query('SELECT pg_advisory_lock($1)', [824_011_001]);
  await client.query(`
    CREATE TABLE IF NOT EXISTS discovery.schema_migrations (
      version text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  for (const file of migrationFiles) {
    const migrationSql = await readFile(
      resolve(migrationsDirectory, file),
      'utf8',
    );
    const checksum = createHash('sha256').update(migrationSql).digest('hex');
    const existing = await client.query(
      'SELECT checksum FROM discovery.schema_migrations WHERE version = $1',
      [file],
    );

    if (existing.rows.length > 0) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`Applied migration checksum changed: ${file}`);
      }

      console.log(`Already applied: ${file}`);
      continue;
    }

    await client.query('BEGIN');

    try {
      await client.query(migrationSql);
      await client.query(
        `INSERT INTO discovery.schema_migrations (version, checksum)
         VALUES ($1, $2)`,
        [file, checksum],
      );
      await client.query('COMMIT');
      console.log(`Applied: ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await client.query('SELECT pg_advisory_unlock($1)', [824_011_001]);
  await client.end();
}
