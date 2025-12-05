import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'projects.sqlite');
const EXAMPLE_PATHS = [
  path.resolve(process.cwd(), 'example_data.json'),
  path.resolve(process.cwd(), 'example_data_2.json'),
];

const DEFAULT_SETTINGS = {
  targetJournal: '',
  wordCountTarget: 3000,
  formattingRequirements: '',
  tone: 'Academic and formal',
};

const FIGURE_TYPE_VALUES = new Set(['figure', 'table', 'supplemental']);

const ensureId = (project) => {
  if (project?.id) return project.id;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const sanitizeFigureType = (value) => {
  if (FIGURE_TYPE_VALUES.has(value)) {
    return value;
  }
  return 'figure';
};

const normalizeFigure = (figure = {}, index = 0) => {
  const figureType = sanitizeFigureType(figure.figureType);
  const defaultLabelPrefix = figureType === 'table' ? 'Table' : 'Figure';

  return {
    id: figure.id || ensureId(figure),
    prompt: figure.prompt || '',
    base64: figure.base64,
    createdAt: figure.createdAt || Date.now(),
    title: figure.title || '',
    label: (figure.label || '').trim() || `${defaultLabelPrefix} ${index + 1}`,
    description: figure.description || '',
    includeInWordCount: figure.includeInWordCount === true,
    figureType,
    sourceType: figure.sourceType === 'UPLOAD' ? 'UPLOAD' : 'AI',
  };
};

const normalizeProject = (project = {}) => {
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
        includeInWordCount: s.includeInWordCount !== false,
        currentVersionId: s.currentVersionId || s.id || ensureId(s),
        currentVersionBase: s.currentVersionBase !== undefined ? s.currentVersionBase : (s.content || ''),
        currentVersionStartedAt: s.currentVersionStartedAt || s.lastModified || fallbackTime,
        lastLlmContent: s.lastLlmContent ?? null,
        versions: Array.isArray(s.versions)
          ? s.versions.map((v) => ({
            ...v,
            source: v?.source || 'USER',
          }))
          : [],
      }))
      : [],
    references: Array.isArray(project.references) ? project.references : [],
    figures: Array.isArray(project.figures) ? project.figures.map((fig, index) => normalizeFigure(fig, index)) : [],
  };
};

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created INTEGER NOT NULL,
    last_modified INTEGER NOT NULL,
    data TEXT NOT NULL
  );
`);

const seedFromExampleData = () => {
  const row = db.prepare('SELECT COUNT(*) as count FROM projects').get();
  if (row?.count > 0) {
    return;
  }

  const examplePath = EXAMPLE_PATHS.find((p) => fs.existsSync(p));
  if (!examplePath) {
    console.warn('No example data file found. Skipping seed.');
    return;
  }

  try {
    const raw = fs.readFileSync(examplePath, 'utf-8');
    const projects = JSON.parse(raw);
    const insert = db.prepare(`
      INSERT OR REPLACE INTO projects (id, title, description, created, last_modified, data)
      VALUES (@id, @title, @description, @created, @last_modified, @data)
    `);

    const insertMany = db.transaction((items) => {
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

    insertMany(projects);
    console.log(`Seeded ${projects.length} project(s) from ${path.basename(examplePath)}`);
  } catch (error) {
    console.error('Failed to seed database from example data', error);
  }
};

const getProjects = () => {
  const rows = db.prepare('SELECT data FROM projects ORDER BY last_modified DESC').all();
  return rows.map((row) => normalizeProject(JSON.parse(row.data)));
};

const saveProject = (project) => {
  const incoming = normalizeProject(project);
  const now = Date.now();
  const toPersist = {
    ...incoming,
    created: incoming.created || now,
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

const deleteProject = (id) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
};

seedFromExampleData();

export { deleteProject, getProjects, normalizeProject, saveProject, seedFromExampleData, DB_PATH };
