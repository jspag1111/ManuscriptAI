import fs from 'fs';
import path from 'path';
import { createClient, type Client } from '@libsql/client';
import { normalizeProject } from './projects';
import type { Project } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'projects.sqlite');
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
const SEED_PROJECT_OWNER_ID = process.env.SEED_PROJECT_OWNER_ID || process.env.DEFAULT_PROJECT_OWNER_ID || null;

let clientPromise: Promise<Client> | null = null;
let seeded = false;

const ensureSchema = async (client: Client) => {
  // Create base table if missing
  await client.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      created INTEGER NOT NULL,
      last_modified INTEGER NOT NULL,
      data TEXT NOT NULL
    );
  `);

  // Backfill user_id for existing deployments that pre-date auth
  const columns = await client.execute('PRAGMA table_info(projects)');
  const hasUserId = columns.rows.some((row: any) => row.name === 'user_id');
  if (!hasUserId) {
    await client.execute('ALTER TABLE projects ADD COLUMN user_id TEXT');
  }

  await client.execute('CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)');
};

const findSeedFile = (): string | null => {
  const candidates = ['example_data.json', 'example_data_2.json'];
  for (const candidate of candidates) {
    const candidatePath = path.join(process.cwd(), candidate);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }
  return null;
};

const persistProjects = async (client: Client, projects: Project[], userId: string | null) => {
  if (projects.length === 0) return;

  const tx = await client.transaction();
  try {
    for (const project of projects) {
      await tx.execute({
        sql: `
          INSERT INTO projects (id, user_id, title, description, created, last_modified, data)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            user_id=COALESCE(excluded.user_id, projects.user_id),
            title=excluded.title,
            description=excluded.description,
            created=excluded.created,
            last_modified=excluded.last_modified,
            data=excluded.data
        `,
        args: [
          project.id,
          userId,
          project.title,
          project.description,
          project.created,
          project.lastModified,
          JSON.stringify(project),
        ],
      });
    }

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};

const seedDatabase = async (client: Client) => {
  if (seeded) return;
  const row = await client.execute('SELECT COUNT(*) as count FROM projects');
  const count = Number(row.rows?.[0]?.count ?? row.rows?.[0]?.['count(*)'] ?? 0);
  if (count > 0) {
    seeded = true;
    return;
  }

  const seedPath = findSeedFile();
  if (!seedPath) {
    seeded = true;
    return;
  }

  // Avoid creating ownerless records; require an explicit owner for seeds.
  if (!SEED_PROJECT_OWNER_ID) {
    console.warn('Seed data found but SEED_PROJECT_OWNER_ID/DEFAULT_PROJECT_OWNER_ID is not set; skipping seeding to avoid shared records.');
    seeded = true;
    return;
  }

  const raw = fs.readFileSync(seedPath, 'utf-8');
  const projects: Partial<Project>[] = JSON.parse(raw);
  const normalized = projects.map((project) => normalizeProject(project));
  await persistProjects(client, normalized, SEED_PROJECT_OWNER_ID);
  seeded = true;
};

const getClient = async (): Promise<Client> => {
  if (!clientPromise) {
    if (!TURSO_URL) {
      throw new Error('TURSO_DATABASE_URL is not set; please configure your Turso database URL.');
    }

    clientPromise = (async () => {
      const client = createClient({
        url: TURSO_URL,
        authToken: TURSO_AUTH_TOKEN,
      });
      await ensureSchema(client);
      await seedDatabase(client);
      return client;
    })();
  }

  return clientPromise;
};

const getAllProjects = async (userId: string): Promise<Project[]> => {
  if (!userId) {
    throw new Error('User id is required to load projects.');
  }
  const client = await getClient();

  // If a seed owner is configured, automatically claim any orphaned rows so they stop
  // leaking into other users' boards and remain visible only to the intended account.
  if (SEED_PROJECT_OWNER_ID && userId === SEED_PROJECT_OWNER_ID) {
    const orphanCount = await client.execute('SELECT COUNT(*) as count FROM projects WHERE user_id IS NULL');
    const count = Number(orphanCount.rows?.[0]?.count ?? orphanCount.rows?.[0]?.['count(*)'] ?? 0);
    if (count > 0) {
      await client.execute({
        sql: 'UPDATE projects SET user_id = ? WHERE user_id IS NULL',
        args: [userId],
      });
      console.info(`Claimed ${count} orphaned project(s) for seed owner ${userId}.`);
    }
  }

  const rows = await client.execute({
    sql: `
      SELECT data FROM projects
      WHERE user_id = ?
      ORDER BY last_modified DESC
    `,
    args: [userId],
  });
  return rows.rows.map((row) => normalizeProject(JSON.parse(String(row.data))));
};

const getProjectOwner = async (client: Client, id: string): Promise<string | null> => {
  const row = await client.execute({
    sql: 'SELECT user_id FROM projects WHERE id = ? LIMIT 1',
    args: [id],
  });
  const value = row.rows?.[0]?.user_id ?? null;
  return value ? String(value) : null;
};

const saveProjectRecord = async (project: Partial<Project>, userId: string): Promise<Project> => {
  if (!userId) {
    throw new Error('User id is required to save a project.');
  }

  const client = await getClient();
  const incoming = normalizeProject(project);
  const now = Date.now();
  const toPersist: Project = {
    ...incoming,
    created: incoming.created || now,
    lastModified: now,
  };

  const owner = incoming.id ? await getProjectOwner(client, incoming.id) : null;
  if (owner && owner !== userId) {
    throw new Error('Forbidden: project belongs to another user.');
  }

  await client.execute({
    sql: `
      INSERT INTO projects (id, user_id, title, description, created, last_modified, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        user_id=excluded.user_id,
        title=excluded.title,
        description=excluded.description,
        created=excluded.created,
        last_modified=excluded.last_modified,
        data=excluded.data
    `,
    args: [
      toPersist.id,
      userId,
      toPersist.title,
      toPersist.description,
      toPersist.created,
      toPersist.lastModified,
      JSON.stringify(toPersist),
    ],
  });

  return toPersist;
};

const deleteProjectRecord = async (id: string, userId: string) => {
  if (!userId) {
    throw new Error('User id is required to delete a project.');
  }
  const client = await getClient();
  const owner = await getProjectOwner(client, id);
  if (owner && owner !== userId) {
    throw new Error('Forbidden: project belongs to another user.');
  }
  await client.execute({
    sql: 'DELETE FROM projects WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
};

export const projectStore = {
  getAll: getAllProjects,
  save: saveProjectRecord,
  delete: deleteProjectRecord,
  dbUrl: TURSO_URL ?? 'unset',
  dbPath: DB_PATH,
};
