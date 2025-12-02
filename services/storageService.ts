

import { Project, GeneratedFigure, FigureType } from '../types';

const API_BASE = '/api';

const DEFAULT_SETTINGS = {
  targetJournal: '',
  wordCountTarget: 3000,
  formattingRequirements: '',
  tone: 'Academic and formal',
};

// Helper for safe ID generation (fallback for non-secure contexts or missing API)
export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback if secure context check fails
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const sanitizeFigureType = (value: string | undefined): FigureType => {
  if (value === 'table' || value === 'supplemental') {
    return value;
  }
  return 'figure';
};

const normalizeFigure = (figure: any, index: number): GeneratedFigure => {
  const figureType = sanitizeFigureType(figure?.figureType);
  const defaultLabelPrefix = figureType === 'table' ? 'Table' : 'Figure';

  return {
    id: figure?.id || generateId(),
    prompt: figure?.prompt || '',
    base64: figure?.base64,
    createdAt: figure?.createdAt || Date.now(),
    title: figure?.title || '',
    label: figure?.label?.trim() || `${defaultLabelPrefix} ${index + 1}`,
    description: figure?.description || '',
    includeInWordCount: figure?.includeInWordCount === true,
    figureType,
    sourceType: figure?.sourceType === 'UPLOAD' ? 'UPLOAD' : 'AI',
  };
};

const normalizeProject = (project: Project): Project => ({
  ...project,
  manuscriptMetadata: project.manuscriptMetadata || { authors: [], affiliations: [] },
  settings: project.settings || { ...DEFAULT_SETTINGS },
  sections: Array.isArray(project.sections) ? project.sections.map((s: any) => ({
    ...s,
    useReferences: s.useReferences !== undefined ? s.useReferences : true,
    includeInWordCount: s.includeInWordCount !== false,
    currentVersionId: s.currentVersionId || s.id || generateId(),
    currentVersionBase: s.currentVersionBase !== undefined ? s.currentVersionBase : (s.content || ''),
    currentVersionStartedAt: s.currentVersionStartedAt || s.lastModified || Date.now(),
    lastLlmContent: s.lastLlmContent ?? null,
    versions: Array.isArray(s.versions) ? s.versions.map((v: any) => ({
      ...v,
      source: v?.source || 'USER'
    })) : []
  })) : [],
  references: Array.isArray(project.references) ? project.references : [],
  figures: Array.isArray(project.figures) ? project.figures.map((fig: any, index: number) => normalizeFigure(fig, index)) : [],
});

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'API request failed');
  }
  return response.json();
};

export const getProjects = async (): Promise<Project[]> => {
  const response = await fetch(`${API_BASE}/projects`);
  const data = await handleResponse(response);
  return data.map((p: Project) => normalizeProject(p));
};

export const saveProject = async (project: Project): Promise<Project> => {
  const response = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(project)
  });

  const saved = await handleResponse(response);
  return normalizeProject(saved);
};

export const deleteProject = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    throw new Error('Failed to delete project');
  }
};

export const createNewProject = (title: string, description: string): Project => {
  return {
    id: generateId(),
    title,
    description,
    created: Date.now(),
    lastModified: Date.now(),
    settings: { ...DEFAULT_SETTINGS },
    manuscriptMetadata: {
        authors: [],
        affiliations: []
    },
    sections: [],
    references: [],
    figures: [],
  };
};
