import type { GeneratedFigure, Project, ProjectSettings, Section } from '@/types';

export const DEFAULT_SETTINGS: ProjectSettings = {
  targetJournal: '',
  wordCountTarget: 3000,
  formattingRequirements: '',
  tone: 'Academic and formal',
};

export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID();
    } catch (_) {
      // ignore and fall through to fallback
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const FIGURE_TYPE_VALUES = new Set(['figure', 'table', 'supplemental']);

const sanitizeFigureType = (value: string | undefined) =>
  FIGURE_TYPE_VALUES.has(value as string) ? (value as GeneratedFigure['figureType']) : 'figure';

export const normalizeFigure = (figure: Partial<GeneratedFigure> = {}, index = 0): GeneratedFigure => {
  const figureType = sanitizeFigureType(figure.figureType);
  const defaultLabelPrefix = figureType === 'table' ? 'Table' : 'Figure';

  return {
    id: figure.id || generateId(),
    prompt: figure.prompt || '',
    base64: figure.base64,
    createdAt: figure.createdAt || Date.now(),
    title: figure.title || '',
    label: figure.label?.trim() || `${defaultLabelPrefix} ${index + 1}`,
    description: figure.description || '',
    includeInWordCount: figure.includeInWordCount === true,
    figureType,
    sourceType: figure.sourceType === 'UPLOAD' ? 'UPLOAD' : 'AI',
  };
};

const normalizeSection = (section: Partial<Section>, fallbackTime: number): Section => {
  const legacyLastModified = (section as any).last_modified as number | undefined;
  const sectionModified = section.lastModified || legacyLastModified || fallbackTime;
  const withDefaults: Section = {
    id: section.id || generateId(),
    title: section.title || 'Untitled Section',
    content: section.content || '',
    userNotes: section.userNotes || '',
    versions: Array.isArray(section.versions)
      ? section.versions.map((v) => ({ ...v, source: v?.source || 'USER' }))
      : [],
    lastModified: sectionModified,
    useReferences: section.useReferences !== undefined ? section.useReferences : true,
    includeInWordCount: section.includeInWordCount !== false,
    currentVersionId: section.currentVersionId || section.id || generateId(),
    currentVersionBase: section.currentVersionBase !== undefined ? section.currentVersionBase : section.content || '',
    currentVersionStartedAt: section.currentVersionStartedAt || sectionModified,
    lastLlmContent: section.lastLlmContent ?? null,
    changeEvents: Array.isArray((section as any).changeEvents) ? ((section as any).changeEvents as any) : [],
  };

  return withDefaults;
};

export const normalizeProject = (project: Partial<Project>): Project => {
  const legacyLastModified = (project as any).last_modified as number | undefined;
  const fallbackTime = project.lastModified || legacyLastModified || project.created || Date.now();
  const normalizedSections = Array.isArray(project.sections)
    ? project.sections.map((section) => normalizeSection(section, fallbackTime))
    : [];

  const normalized: Project = {
    ...project,
    id: project.id || generateId(),
    title: project.title || 'Untitled Project',
    description: project.description || '',
    created: project.created || fallbackTime,
    lastModified: project.lastModified || legacyLastModified || fallbackTime,
    settings: project.settings || { ...DEFAULT_SETTINGS },
    manuscriptMetadata: project.manuscriptMetadata || { authors: [], affiliations: [] },
    sections: normalizedSections,
    references: Array.isArray(project.references) ? project.references : [],
    figures: Array.isArray(project.figures)
      ? project.figures.map((fig, index) => normalizeFigure(fig as GeneratedFigure, index))
      : [],
  } as Project;

  return normalized;
};

export const normalizeProjects = (projects: Partial<Project>[]): Project[] => projects.map(normalizeProject);
