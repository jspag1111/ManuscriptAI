import type { GeneratedFigure, Project, ProjectSettings, ProjectType, Section, WritingBrief } from '@/types';

export const DEFAULT_SETTINGS: ProjectSettings = {
  targetJournal: '',
  wordCountTarget: 3000,
  formattingRequirements: '',
  tone: 'Academic and formal',
};

export const DEFAULT_WRITING_BRIEF: WritingBrief = {
  goals: '',
  audience: '',
  format: '',
  outline: '',
  tone: '',
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

const normalizeCommentAuthor = (raw: any): { userId: string; name?: string | null } => {
  const userId = typeof raw?.userId === 'string' && raw.userId.trim().length > 0 ? raw.userId : 'unknown';
  const name = typeof raw?.name === 'string' ? raw.name : null;
  return name ? { userId, name } : { userId, name: null };
};

const normalizeCommentThreads = (rawThreads: any, fallbackTime: number) => {
  if (!Array.isArray(rawThreads)) return [];
  return rawThreads
    .filter(Boolean)
    .map((raw) => {
      const createdAt = typeof raw?.createdAt === 'number' ? raw.createdAt : fallbackTime;
      const updatedAt = typeof raw?.updatedAt === 'number' ? raw.updatedAt : createdAt;
      const createdBy = normalizeCommentAuthor(raw?.createdBy);

      const anchorRaw = raw?.anchor;
      const anchor =
        anchorRaw &&
        typeof anchorRaw?.from === 'number' &&
        typeof anchorRaw?.to === 'number' &&
        anchorRaw.from < anchorRaw.to
          ? {
              from: anchorRaw.from,
              to: anchorRaw.to,
              text: typeof anchorRaw?.text === 'string' ? anchorRaw.text : '',
              orphaned: anchorRaw?.orphaned === true,
            }
          : null;

      const messages = Array.isArray(raw?.messages)
        ? raw.messages
            .filter(Boolean)
            .map((m: any) => ({
              id: typeof m?.id === 'string' && m.id ? m.id : generateId(),
              createdAt: typeof m?.createdAt === 'number' ? m.createdAt : createdAt,
              author: normalizeCommentAuthor(m?.author),
              content: typeof m?.content === 'string' ? m.content : '',
            }))
        : [];

      const aiEdits = Array.isArray(raw?.aiEdits)
        ? raw.aiEdits
            .filter(Boolean)
            .map((edit: any) => ({
              id: typeof edit?.id === 'string' && edit.id ? edit.id : generateId(),
              createdAt: typeof edit?.createdAt === 'number' ? edit.createdAt : updatedAt,
              model: typeof edit?.model === 'string' ? edit.model : 'unknown',
              changeEventId: typeof edit?.changeEventId === 'string' ? edit.changeEventId : '',
            }))
            .filter((edit: any) => edit.changeEventId)
        : [];

      const status: 'OPEN' | 'RESOLVED' = raw?.status === 'RESOLVED' ? 'RESOLVED' : 'OPEN';
      const resolvedAt = typeof raw?.resolvedAt === 'number' ? raw.resolvedAt : null;
      const resolvedBy = raw?.resolvedBy ? normalizeCommentAuthor(raw.resolvedBy) : null;

      return {
        id: typeof raw?.id === 'string' && raw.id ? raw.id : generateId(),
        createdAt,
        updatedAt,
        createdBy,
        anchor,
        excerpt: typeof raw?.excerpt === 'string' ? raw.excerpt : '',
        messages,
        status,
        resolvedAt,
        resolvedBy,
        aiEdits,
      };
    });
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
      ? section.versions.map((v) => {
          const raw = v as any;
          const normalizedChangeEvents = Array.isArray(raw?.changeEvents) ? raw.changeEvents : undefined;
          const normalizedBaseContent = typeof raw?.baseContent === 'string' ? raw.baseContent : undefined;
          const normalizedStartedAt = typeof raw?.versionStartedAt === 'number' ? raw.versionStartedAt : undefined;
          const normalizedCommentThreads = normalizeCommentThreads(raw?.commentThreads, fallbackTime);
          return {
            ...v,
            source: v?.source || 'USER',
            baseContent: normalizedBaseContent,
            changeEvents: normalizedChangeEvents,
            commentThreads: normalizedCommentThreads,
            versionStartedAt: normalizedStartedAt,
          };
        })
      : [],
    lastModified: sectionModified,
    useReferences: section.useReferences !== undefined ? section.useReferences : true,
    includeInWordCount: section.includeInWordCount !== false,
    currentVersionId: section.currentVersionId || section.id || generateId(),
    currentVersionBase: section.currentVersionBase !== undefined ? section.currentVersionBase : section.content || '',
    currentVersionStartedAt: section.currentVersionStartedAt || sectionModified,
    lastLlmContent: section.lastLlmContent ?? null,
    changeEvents: Array.isArray((section as any).changeEvents) ? ((section as any).changeEvents as any) : [],
    commentThreads: normalizeCommentThreads((section as any).commentThreads, sectionModified),
  };

  return withDefaults;
};

const normalizeWritingBrief = (brief?: Partial<WritingBrief> | null): WritingBrief => ({
  goals: typeof brief?.goals === 'string' ? brief.goals : '',
  audience: typeof brief?.audience === 'string' ? brief.audience : '',
  format: typeof brief?.format === 'string' ? brief.format : '',
  outline: typeof brief?.outline === 'string' ? brief.outline : '',
  tone: typeof brief?.tone === 'string' ? brief.tone : '',
});

const normalizeProjectType = (value: unknown): ProjectType =>
  value === 'GENERAL' ? 'GENERAL' : 'MANUSCRIPT';

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
    projectType: normalizeProjectType(project.projectType),
    writingBrief: normalizeWritingBrief(project.writingBrief ?? null),
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
