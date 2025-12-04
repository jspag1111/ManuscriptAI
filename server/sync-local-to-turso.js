import fs from 'fs';
import Database from 'better-sqlite3';
import { createClient } from '@libsql/client';
import { DB_PATH as DEFAULT_DB_PATH, TABLE_SQL, normalizeProject } from './dbClient.js';

const tursoUrl = process.env.TURSO_DATABASE_URL;
if (!tursoUrl) {
  console.error('TURSO_DATABASE_URL must be set to sync to Turso.');
  process.exit(1);
}

const localDbPath = process.env.LOCAL_DB_PATH || DEFAULT_DB_PATH;

if (!fs.existsSync(localDbPath)) {
  console.error(`Local database not found at ${localDbPath}. Set LOCAL_DB_PATH if your file lives elsewhere.`);
  process.exit(1);
}

const readLocalProjects = () => {
  const db = new Database(localDbPath);
  const rows = db.prepare('SELECT data FROM projects').all();
  return rows.map((row) => normalizeProject(JSON.parse(row.data)));
};

const upsertIntoTurso = async (projects) => {
  const client = createClient({
    url: tursoUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  await client.execute(TABLE_SQL);

  const sql = `
    INSERT OR REPLACE INTO projects (id, title, description, created, last_modified, data)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const statements = projects.map((project) => ({
    sql,
    args: [
      project.id,
      project.title || 'Untitled Project',
      project.description || '',
      project.created,
      project.lastModified,
      JSON.stringify(project),
    ],
  }));

  await client.batch(statements, 'write');
};

const sync = async () => {
  const projects = readLocalProjects();
  if (projects.length === 0) {
    console.log('No local projects found to sync.');
    return;
  }

  await upsertIntoTurso(projects);
  console.log(`Synced ${projects.length} project(s) from ${localDbPath} to ${tursoUrl}`);
};

sync().catch((error) => {
  console.error('Failed to sync local database to Turso', error);
  process.exit(1);
});
