#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { createClient } from '@libsql/client';
import envPkg from '@next/env';

// Load .env.local / .env into process.env so the script works like Next.js
const { loadEnvConfig } = envPkg;
loadEnvConfig(process.cwd());

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
const LOCAL_DB_PATH = path.join(process.cwd(), 'data', 'projects.sqlite');

if (!TURSO_URL) {
  console.error('Missing TURSO_DATABASE_URL. Set it in your environment before running this script.');
  process.exit(1);
}

if (!fs.existsSync(LOCAL_DB_PATH)) {
  console.error(`Local SQLite database not found at ${LOCAL_DB_PATH}. Nothing to migrate.`);
  process.exit(1);
}

const readLocalProjects = () => {
  const sqlite = new Database(LOCAL_DB_PATH, { readonly: true });
  const rows = sqlite
    .prepare('SELECT id, title, description, created, last_modified, data FROM projects')
    .all();
  sqlite.close();
  return rows;
};

const ensureSchema = async (client) => {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      created INTEGER NOT NULL,
      last_modified INTEGER NOT NULL,
      data TEXT NOT NULL
    );
  `);
};

const getRemoteCount = async (client) => {
  const result = await client.execute('SELECT COUNT(*) as count FROM projects');
  return Number(result.rows?.[0]?.count ?? result.rows?.[0]?.['count(*)'] ?? 0);
};

const upsertProjects = async (client, projects) => {
  if (projects.length === 0) return 0;

  const tx = await client.transaction();
  try {
    for (const project of projects) {
      await tx.execute({
        sql: `
          INSERT INTO projects (id, title, description, created, last_modified, data)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            description=excluded.description,
            created=excluded.created,
            last_modified=excluded.last_modified,
            data=excluded.data
        `,
        args: [
          project.id,
          project.title,
          project.description,
          project.created,
          project.last_modified,
          typeof project.data === 'string' ? project.data : JSON.stringify(project.data),
        ],
      });
    }

    await tx.commit();
    return projects.length;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};

const main = async () => {
  console.log(`Reading projects from ${LOCAL_DB_PATH}...`);
  const localProjects = readLocalProjects();
  console.log(`Found ${localProjects.length} project(s) locally.`);

  const client = createClient({ url: TURSO_URL, authToken: TURSO_AUTH_TOKEN });
  await ensureSchema(client);

  const beforeCount = await getRemoteCount(client);
  console.log(`Remote Turso projects before migration: ${beforeCount}`);

  const migrated = await upsertProjects(client, localProjects);
  const afterCount = await getRemoteCount(client);

  console.log(`Migrated ${migrated} project(s) to Turso.`);
  console.log(`Remote Turso projects after migration: ${afterCount}`);
};

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
