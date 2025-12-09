import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { normalizeProject } from './projects';
import type { Project } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'projects.sqlite');

let db: Database.Database | null = null;
let seeded = false;

const ensureSchema = (database: Database.Database) => {
  database.exec(`
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

const seedDatabase = (database: Database.Database) => {
  if (seeded) return;
  const row = database.prepare('SELECT COUNT(*) as count FROM projects').get();
  if (row?.count > 0) {
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
  const insert = database.prepare(`
    INSERT OR REPLACE INTO projects (id, title, description, created, last_modified, data)
    VALUES (@id, @title, @description, @created, @last_modified, @data)
  `);

  const insertMany = database.transaction((items: Partial<Project>[]) => {
    for (const item of items) {
      const normalized = normalizeProject(item);
      insert.run({
        id: normalized.id,
        title: normalized.title,
        description: normalized.description,
        created: normalized.created,
        last_modified: normalized.lastModified,
        data: JSON.stringify(normalized),
      });
    }
  });

  insertMany(projects);
  seeded = true;
};

const getDatabase = (): Database.Database => {
  if (!db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    ensureSchema(db);
  }

  if (!seeded) {
    seedDatabase(db);
  }

  return db;
};

const getAllProjects = (): Project[] => {
  const database = getDatabase();
  const rows = database.prepare('SELECT data FROM projects ORDER BY last_modified DESC').all();
  return rows.map((row) => normalizeProject(JSON.parse(row.data)));
};

const saveProjectRecord = (project: Partial<Project>): Project => {
  const database = getDatabase();
  const incoming = normalizeProject(project);
  const now = Date.now();
  const toPersist: Project = {
    ...incoming,
    created: incoming.created || now,
    lastModified: now,
  };

  database
    .prepare(`
      INSERT INTO projects (id, title, description, created, last_modified, data)
      VALUES (@id, @title, @description, @created, @last_modified, @data)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title,
        description=excluded.description,
        created=excluded.created,
        last_modified=excluded.last_modified,
        data=excluded.data
    `)
    .run({
      id: toPersist.id,
      title: toPersist.title,
      description: toPersist.description,
      created: toPersist.created,
      last_modified: toPersist.lastModified,
      data: JSON.stringify(toPersist),
    });

  return toPersist;
};

const deleteProjectRecord = (id: string) => {
  const database = getDatabase();
  database.prepare('DELETE FROM projects WHERE id = ?').run(id);
};

export const projectStore = {
  getAll: getAllProjects,
  save: saveProjectRecord,
  delete: deleteProjectRecord,
  dbPath: DB_PATH,
};
