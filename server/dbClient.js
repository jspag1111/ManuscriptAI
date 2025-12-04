import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { createClient } from '@libsql/client';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DATA_DIR = path.resolve(__dirname, '../data');
export const DB_PATH = path.join(DATA_DIR, 'projects.sqlite');

export const TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created INTEGER NOT NULL,
    last_modified INTEGER NOT NULL,
    data TEXT NOT NULL
  );
`;

const DEFAULT_SETTINGS = {
  targetJournal: '',
  wordCountTarget: 3000,
  formattingRequirements: '',
  tone: 'Academic and formal',
};

const ensureId = (project) => {
  if (project.id) return project.id;
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const normalizeProject = (project = {}) => {
  const fallbackTime = Date.now();
  return {
    ...project,
    id: ensureId(project),
    created: project.created || fallbackTime,
    lastModified: project.lastModified || project.last_modified || fallbackTime,
    settings: project.settings || { ...DEFAULT_SETTINGS },
    manuscriptMetadata: project.manuscriptMetadata || { authors: [], affiliations: [] },
    sections: Array.isArray(project.sections)
      ? project.sections.map((s) => ({
        ...s,
        useReferences: s.useReferences !== undefined ? s.useReferences : true,
      }))
      : [],
    references: Array.isArray(project.references) ? project.references : [],
    figures: Array.isArray(project.figures) ? project.figures : [],
  };
};

const createSqliteAdapter = () => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const ensureSchema = async () => {
    db.exec(TABLE_SQL);
  };

  const countProjects = async () => {
    const row = db.prepare('SELECT COUNT(*) as count FROM projects').get();
    return row?.count || 0;
  };

  const getAllProjects = async () => {
    const rows = db.prepare('SELECT data FROM projects ORDER BY last_modified DESC').all();
    return rows.map((row) => normalizeProject(JSON.parse(row.data)));
  };

  const upsertProject = async (project) => {
    const now = Date.now();
    const toPersist = {
      ...normalizeProject(project),
      created: project.created || now,
      lastModified: now,
    };

    db.prepare(`
      INSERT INTO projects (id, title, description, created, last_modified, data)
      VALUES (@id, @title, @description, @created, @last_modified, @data)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title,
        description=excluded.description,
        created=excluded.created,
        last_modified=excluded.last_modified,
        data=excluded.data
    `).run({
      id: toPersist.id,
      title: toPersist.title || 'Untitled Project',
      description: toPersist.description || '',
      created: toPersist.created,
      last_modified: toPersist.lastModified,
      data: JSON.stringify(toPersist),
    });

    return toPersist;
  };

  const deleteProject = async (id) => {
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  };

  const insertMany = async (projects) => {
    if (!projects.length) return;

    const insert = db.prepare(`
      INSERT OR REPLACE INTO projects (id, title, description, created, last_modified, data)
      VALUES (@id, @title, @description, @created, @last_modified, @data)
    `);

    const insertManyTx = db.transaction((items) => {
      for (const project of items) {
        const normalized = normalizeProject(project);
        insert.run({
          id: normalized.id,
          title: normalized.title || 'Untitled Project',
          description: normalized.description || '',
          created: normalized.created,
          last_modified: normalized.lastModified,
          data: JSON.stringify(normalized),
        });
      }
    });

    insertManyTx(projects);
  };

  return {
    type: 'sqlite',
    ensureSchema,
    countProjects,
    getAllProjects,
    upsertProject,
    deleteProject,
    insertMany,
  };
};

const createTursoAdapter = () => {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error('TURSO_DATABASE_URL is required when using Turso');
  }

  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const ensureSchema = async () => {
    await client.execute(TABLE_SQL);
  };

  const countProjects = async () => {
    const result = await client.execute('SELECT COUNT(*) as count FROM projects');
    const row = result.rows?.[0] || {};
    return Number(row.count ?? row['COUNT(*)'] ?? 0);
  };

  const getAllProjects = async () => {
    const result = await client.execute('SELECT data FROM projects ORDER BY last_modified DESC');
    return result.rows.map((row) => normalizeProject(JSON.parse(row.data)));
  };

  const upsertProject = async (project) => {
    const now = Date.now();
    const toPersist = {
      ...normalizeProject(project),
      created: project.created || now,
      lastModified: now,
    };

    const sql = `
      INSERT INTO projects (id, title, description, created, last_modified, data)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title,
        description=excluded.description,
        created=excluded.created,
        last_modified=excluded.last_modified,
        data=excluded.data
    `;

    await client.execute({
      sql,
      args: [
        toPersist.id,
        toPersist.title || 'Untitled Project',
        toPersist.description || '',
        toPersist.created,
        toPersist.lastModified,
        JSON.stringify(toPersist),
      ],
    });

    return toPersist;
  };

  const deleteProject = async (id) => {
    await client.execute({ sql: 'DELETE FROM projects WHERE id = ?', args: [id] });
  };

  const insertMany = async (projects) => {
    if (!projects.length) return;

    const sql = `
      INSERT OR REPLACE INTO projects (id, title, description, created, last_modified, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const statements = projects.map((project) => {
      const normalized = normalizeProject(project);
      return {
        sql,
        args: [
          normalized.id,
          normalized.title || 'Untitled Project',
          normalized.description || '',
          normalized.created,
          normalized.lastModified,
          JSON.stringify(normalized),
        ],
      };
    });

    await client.batch(statements, 'write');
  };

  return {
    type: 'turso',
    ensureSchema,
    countProjects,
    getAllProjects,
    upsertProject,
    deleteProject,
    insertMany,
  };
};

export const dbClient = process.env.TURSO_DATABASE_URL ? createTursoAdapter() : createSqliteAdapter();
