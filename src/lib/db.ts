import fs from 'fs';
import path from 'path';
import { createClient, type Client } from '@libsql/client';
import { normalizeProject } from './projects';
import type { Project } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'projects.sqlite');
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

let clientPromise: Promise<Client> | null = null;
let seeded = false;

const ensureSchema = async (client: Client) => {
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

const persistProjects = async (client: Client, projects: Project[]) => {
  if (projects.length === 0) return;

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

  const raw = fs.readFileSync(seedPath, 'utf-8');
  const projects: Partial<Project>[] = JSON.parse(raw);
  const normalized = projects.map((project) => normalizeProject(project));
  await persistProjects(client, normalized);
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

const getAllProjects = async (): Promise<Project[]> => {
  const client = await getClient();
  const rows = await client.execute('SELECT data FROM projects ORDER BY last_modified DESC');
  return rows.rows.map((row) => normalizeProject(JSON.parse(String(row.data))));
};

const saveProjectRecord = async (project: Partial<Project>): Promise<Project> => {
  const client = await getClient();
  const incoming = normalizeProject(project);
  const now = Date.now();
  const toPersist: Project = {
    ...incoming,
    created: incoming.created || now,
    lastModified: now,
  };

  await client.execute({
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
      toPersist.id,
      toPersist.title,
      toPersist.description,
      toPersist.created,
      toPersist.lastModified,
      JSON.stringify(toPersist),
    ],
  });

  return toPersist;
};

const deleteProjectRecord = async (id: string) => {
  const client = await getClient();
  await client.execute({
    sql: 'DELETE FROM projects WHERE id = ?',
    args: [id],
  });
};

export const projectStore = {
  getAll: getAllProjects,
  save: saveProjectRecord,
  delete: deleteProjectRecord,
  dbUrl: TURSO_URL ?? 'unset',
  dbPath: DB_PATH,
};
