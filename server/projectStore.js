import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getSupabaseServiceRoleClient, hasSupabaseConfig } from '../lib/supabaseServerClient.js';

const TABLE_NAME = 'projects';
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

const getClient = (clientOverride) => clientOverride ?? getSupabaseServiceRoleClient();

let defaultSeedPromise = null;

const ensureSeeded = async (clientOverride) => {
  if (clientOverride) return;
  if (!hasSupabaseConfig()) return;
  if (!defaultSeedPromise) {
    defaultSeedPromise = seedFromExampleData().catch((error) => {
      console.warn('Skipping seed due to Supabase error', error);
      return null;
    });
  }
  await defaultSeedPromise;
};

const seedFromExampleData = async (clientOverride) => {
  const client = getClient(clientOverride);
  const { count, error } = await client
    .from(TABLE_NAME)
    .select('id', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Failed to read Supabase projects table: ${error.message}`);
  }

  if ((count ?? 0) > 0) {
    return false;
  }

  const examplePath = EXAMPLE_PATHS.find((p) => fs.existsSync(p));
  if (!examplePath) {
    console.warn('No example data file found. Skipping seed.');
    return false;
  }

  const raw = fs.readFileSync(examplePath, 'utf-8');
  const projects = JSON.parse(raw);
  const payload = projects.map((project) => {
    const normalized = normalizeProject(project);
    return {
      id: normalized.id,
      title: normalized.title || 'Untitled Project',
      description: normalized.description || '',
      created: normalized.created,
      last_modified: normalized.lastModified,
      data: normalized,
    };
  });

  const { error: upsertError } = await client.from(TABLE_NAME).upsert(payload);
  if (upsertError) {
    throw new Error(`Failed to seed projects: ${upsertError.message}`);
  }

  console.log(`Seeded ${projects.length} project(s) from ${path.basename(examplePath)}`);
  return true;
};

const getProjects = async (clientOverride) => {
  const client = getClient(clientOverride);
  await ensureSeeded(clientOverride);
  const { data, error } = await client
    .from(TABLE_NAME)
    .select('data, last_modified')
    .order('last_modified', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }

  return (data || []).map((row) => normalizeProject(row.data));
};

const saveProject = async (project, clientOverride) => {
  const client = getClient(clientOverride);
  await ensureSeeded(clientOverride);

  const incoming = normalizeProject(project);
  const now = Date.now();
  const toPersist = {
    ...incoming,
    created: incoming.created || now,
    lastModified: now,
  };

  const { data, error } = await client
    .from(TABLE_NAME)
    .upsert({
      id: toPersist.id,
      title: toPersist.title || 'Untitled Project',
      description: toPersist.description || '',
      created: toPersist.created,
      last_modified: toPersist.lastModified,
      data: toPersist,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save project: ${error.message}`);
  }

  return normalizeProject(data.data);
};

const deleteProject = async (id, clientOverride) => {
  const client = getClient(clientOverride);
  await ensureSeeded(clientOverride);
  const { error } = await client.from(TABLE_NAME).delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete project: ${error.message}`);
  }
};

export { deleteProject, getProjects, normalizeProject, saveProject, seedFromExampleData, TABLE_NAME };
