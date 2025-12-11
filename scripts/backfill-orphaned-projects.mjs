#!/usr/bin/env node

import { createClient } from '@libsql/client';
import envPkg from '@next/env';

const { loadEnvConfig } = envPkg;
loadEnvConfig(process.cwd());

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
const SEED_PROJECT_OWNER_ID = process.env.SEED_PROJECT_OWNER_ID || process.env.DEFAULT_PROJECT_OWNER_ID;

if (!TURSO_URL) {
  console.error('Missing TURSO_DATABASE_URL. Set it in your environment before running this script.');
  process.exit(1);
}

if (!SEED_PROJECT_OWNER_ID) {
  console.error('Missing SEED_PROJECT_OWNER_ID or DEFAULT_PROJECT_OWNER_ID. Provide the Clerk user id that should own the seed projects.');
  process.exit(1);
}

const main = async () => {
  const client = createClient({ url: TURSO_URL, authToken: TURSO_AUTH_TOKEN });
  const countResult = await client.execute('SELECT COUNT(*) as count FROM projects WHERE user_id IS NULL');
  const count = Number(countResult.rows?.[0]?.count ?? countResult.rows?.[0]?.['count(*)'] ?? 0);

  if (count === 0) {
    console.log('No orphaned projects found. Nothing to backfill.');
    return;
  }

  await client.execute({
    sql: 'UPDATE projects SET user_id = ? WHERE user_id IS NULL',
    args: [SEED_PROJECT_OWNER_ID],
  });

  console.log(`Assigned ${count} orphaned project(s) to user ${SEED_PROJECT_OWNER_ID}.`);
};

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
