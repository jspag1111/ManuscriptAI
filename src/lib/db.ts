import fs from 'fs';
import path from 'path';
import { createClient, type Client } from '@libsql/client';
import { normalizeProject } from './projects';
import type { Project } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'projects.sqlite');
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
const DB_TARGET = (process.env.MANUSCRIPTAI_DB_TARGET || '').toLowerCase();
const LOCAL_DB_PATH = process.env.MANUSCRIPTAI_LOCAL_DB_PATH
  ? path.resolve(process.cwd(), process.env.MANUSCRIPTAI_LOCAL_DB_PATH)
  : DB_PATH;
const LOCAL_DB_URL = `file:${LOCAL_DB_PATH}`;
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

  await client.execute(`
    CREATE TABLE IF NOT EXISTS discover_runs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created INTEGER NOT NULL,
      last_modified INTEGER NOT NULL,
      data TEXT NOT NULL
    );
  `);

  await client.execute('CREATE INDEX IF NOT EXISTS idx_discover_runs_user_id ON discover_runs(user_id)');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS chatkit_threads (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_item_at INTEGER NOT NULL,
      data TEXT NOT NULL
    );
  `);

  await client.execute('CREATE INDEX IF NOT EXISTS idx_chatkit_threads_user_id ON chatkit_threads(user_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_chatkit_threads_project_id ON chatkit_threads(project_id)');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS chatkit_items (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      data TEXT NOT NULL
    );
  `);

  await client.execute('CREATE INDEX IF NOT EXISTS idx_chatkit_items_thread_id ON chatkit_items(thread_id)');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS chatkit_documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      format TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      content TEXT NOT NULL
    );
  `);

  await client.execute('CREATE INDEX IF NOT EXISTS idx_chatkit_documents_user_id ON chatkit_documents(user_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_chatkit_documents_project_id ON chatkit_documents(project_id)');
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
    const useLocal = DB_TARGET === 'local' || DB_TARGET === 'sqlite' || DB_TARGET === 'file' || (!DB_TARGET && !TURSO_URL);
    const url = useLocal ? LOCAL_DB_URL : TURSO_URL;
    const authToken = useLocal ? undefined : TURSO_AUTH_TOKEN;

    if (!url) {
      throw new Error(
        'Database is not configured. Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN) for Turso, or set MANUSCRIPTAI_DB_TARGET=local to use data/projects.sqlite.'
      );
    }

    if (useLocal) {
      fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
    }

    clientPromise = (async () => {
      const client = createClient({
        url,
        authToken,
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

const getProjectById = async (id: string, userId: string): Promise<Project | null> => {
  if (!userId) {
    throw new Error('User id is required to load a project.');
  }
  const client = await getClient();
  const row = await client.execute({
    sql: 'SELECT data FROM projects WHERE id = ? AND user_id = ? LIMIT 1',
    args: [id, userId],
  });
  const data = row.rows?.[0]?.data;
  if (!data) return null;
  return normalizeProject(JSON.parse(String(data)));
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
  getById: getProjectById,
  save: saveProjectRecord,
  delete: deleteProjectRecord,
  dbUrl: (DB_TARGET === 'local' || DB_TARGET === 'sqlite' || DB_TARGET === 'file' || (!DB_TARGET && !TURSO_URL))
    ? LOCAL_DB_URL
    : (TURSO_URL ?? 'unset'),
  dbPath: LOCAL_DB_PATH,
};

export const discoverRunStore = {
  get: async (id: string, userId: string) => {
    if (!userId) {
      throw new Error('User id is required to load a discover run.');
    }
    const client = await getClient();
    const row = await client.execute({
      sql: 'SELECT data FROM discover_runs WHERE id = ? AND user_id = ? LIMIT 1',
      args: [id, userId],
    });
    const data = row.rows?.[0]?.data;
    if (!data) return null;
    return JSON.parse(String(data));
  },
  save: async (run: { id: string; userId: string; createdAt?: number; updatedAt?: number } & Record<string, any>) => {
    if (!run?.userId) {
      throw new Error('User id is required to save a discover run.');
    }
    const client = await getClient();
    const created = typeof run.createdAt === 'number' ? run.createdAt : Date.now();
    const lastModified = typeof run.updatedAt === 'number' ? run.updatedAt : Date.now();

    await client.execute({
      sql: `
        INSERT INTO discover_runs (id, user_id, created, last_modified, data)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id=excluded.user_id,
          created=excluded.created,
          last_modified=excluded.last_modified,
          data=excluded.data
      `,
      args: [run.id, run.userId, created, lastModified, JSON.stringify(run)],
    });
    return run;
  },
};

type ChatKitThreadRecord = {
  id: string;
  userId: string;
  projectId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  lastItemAt: number;
  data: Record<string, unknown>;
};

type ChatKitItemRecord = {
  id: string;
  threadId: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  data: Record<string, unknown>;
};

type ChatKitDocumentRecord = {
  id: string;
  userId: string;
  projectId: string;
  filename: string;
  format: string;
  createdAt: number;
  content: string;
};

const listChatkitThreads = async ({
  userId,
  projectId,
  limit,
  order,
}: {
  userId: string;
  projectId: string;
  limit?: number;
  order?: 'asc' | 'desc';
}): Promise<ChatKitThreadRecord[]> => {
  if (!userId) {
    throw new Error('User id is required to list ChatKit threads.');
  }
  const client = await getClient();
  const orderBy = order === 'asc' ? 'ASC' : 'DESC';
  const rows = await client.execute({
    sql: `
      SELECT id, user_id, project_id, title, created_at, updated_at, last_item_at, data
      FROM chatkit_threads
      WHERE user_id = ? AND project_id = ?
      ORDER BY last_item_at ${orderBy}
      ${typeof limit === 'number' ? 'LIMIT ?' : ''}
    `,
    args: typeof limit === 'number' ? [userId, projectId, limit] : [userId, projectId],
  });
  return rows.rows.map((row: any) => ({
    id: String(row.id),
    userId: String(row.user_id),
    projectId: String(row.project_id),
    title: String(row.title),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    lastItemAt: Number(row.last_item_at),
    data: JSON.parse(String(row.data)),
  }));
};

const getChatkitThread = async (threadId: string, userId: string): Promise<ChatKitThreadRecord | null> => {
  if (!userId) {
    throw new Error('User id is required to load a ChatKit thread.');
  }
  const client = await getClient();
  const row = await client.execute({
    sql: `
      SELECT id, user_id, project_id, title, created_at, updated_at, last_item_at, data
      FROM chatkit_threads
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `,
    args: [threadId, userId],
  });
  const data = row.rows?.[0];
  if (!data) return null;
  return {
    id: String(data.id),
    userId: String(data.user_id),
    projectId: String(data.project_id),
    title: String(data.title),
    createdAt: Number(data.created_at),
    updatedAt: Number(data.updated_at),
    lastItemAt: Number(data.last_item_at),
    data: JSON.parse(String(data.data)),
  };
};

const saveChatkitThread = async (record: ChatKitThreadRecord) => {
  if (!record.userId) {
    throw new Error('User id is required to save a ChatKit thread.');
  }
  const client = await getClient();
  await client.execute({
    sql: `
      INSERT INTO chatkit_threads (id, user_id, project_id, title, created_at, updated_at, last_item_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title,
        updated_at=excluded.updated_at,
        last_item_at=excluded.last_item_at,
        data=excluded.data
    `,
    args: [
      record.id,
      record.userId,
      record.projectId,
      record.title,
      record.createdAt,
      record.updatedAt,
      record.lastItemAt,
      JSON.stringify(record.data),
    ],
  });
  return record;
};

const deleteChatkitThread = async (threadId: string, userId: string) => {
  if (!userId) {
    throw new Error('User id is required to delete a ChatKit thread.');
  }
  const client = await getClient();
  await client.execute({
    sql: 'DELETE FROM chatkit_items WHERE thread_id = ? AND user_id = ?',
    args: [threadId, userId],
  });
  await client.execute({
    sql: 'DELETE FROM chatkit_threads WHERE id = ? AND user_id = ?',
    args: [threadId, userId],
  });
};

const listChatkitItems = async ({
  threadId,
  userId,
  limit,
  order,
}: {
  threadId: string;
  userId: string;
  limit?: number;
  order?: 'asc' | 'desc';
}): Promise<ChatKitItemRecord[]> => {
  if (!userId) {
    throw new Error('User id is required to list ChatKit items.');
  }
  const client = await getClient();
  const orderBy = order === 'asc' ? 'ASC' : 'DESC';
  const rows = await client.execute({
    sql: `
      SELECT id, thread_id, user_id, created_at, updated_at, data
      FROM chatkit_items
      WHERE thread_id = ? AND user_id = ?
      ORDER BY created_at ${orderBy}
      ${typeof limit === 'number' ? 'LIMIT ?' : ''}
    `,
    args: typeof limit === 'number' ? [threadId, userId, limit] : [threadId, userId],
  });
  return rows.rows.map((row: any) => ({
    id: String(row.id),
    threadId: String(row.thread_id),
    userId: String(row.user_id),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    data: JSON.parse(String(row.data)),
  }));
};

const saveChatkitItem = async (record: ChatKitItemRecord) => {
  if (!record.userId) {
    throw new Error('User id is required to save a ChatKit item.');
  }
  const client = await getClient();
  await client.execute({
    sql: `
      INSERT INTO chatkit_items (id, thread_id, user_id, created_at, updated_at, data)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        updated_at=excluded.updated_at,
        data=excluded.data
    `,
    args: [
      record.id,
      record.threadId,
      record.userId,
      record.createdAt,
      record.updatedAt,
      JSON.stringify(record.data),
    ],
  });
  return record;
};

const createChatkitDocument = async (record: ChatKitDocumentRecord) => {
  if (!record.userId) {
    throw new Error('User id is required to save a ChatKit document.');
  }
  const client = await getClient();
  await client.execute({
    sql: `
      INSERT INTO chatkit_documents (id, user_id, project_id, filename, format, created_at, content)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      record.id,
      record.userId,
      record.projectId,
      record.filename,
      record.format,
      record.createdAt,
      record.content,
    ],
  });
  return record;
};

const getChatkitDocument = async (id: string, userId: string): Promise<ChatKitDocumentRecord | null> => {
  if (!userId) {
    throw new Error('User id is required to load a ChatKit document.');
  }
  const client = await getClient();
  const row = await client.execute({
    sql: `
      SELECT id, user_id, project_id, filename, format, created_at, content
      FROM chatkit_documents
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `,
    args: [id, userId],
  });
  const data = row.rows?.[0];
  if (!data) return null;
  return {
    id: String(data.id),
    userId: String(data.user_id),
    projectId: String(data.project_id),
    filename: String(data.filename),
    format: String(data.format),
    createdAt: Number(data.created_at),
    content: String(data.content),
  };
};

export const chatkitStore = {
  listThreads: listChatkitThreads,
  getThread: getChatkitThread,
  saveThread: saveChatkitThread,
  deleteThread: deleteChatkitThread,
  listItems: listChatkitItems,
  saveItem: saveChatkitItem,
};

export const chatkitDocumentStore = {
  create: createChatkitDocument,
  get: getChatkitDocument,
};
