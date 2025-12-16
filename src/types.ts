

export interface Reference {
  id: string;
  title: string;
  authors: string;
  year: string;
  publication: string;
  doi?: string;
  summary?: string;
  abstract?: string;
  notes?: string;
  articleType?: string;
}

export type ChangeSource = 'LLM' | 'USER';

export type ChangeActor =
  | { type: 'USER'; userId: string; name?: string | null }
  | { type: 'LLM'; model: string };

export interface SectionChangeEvent {
  id: string;
  timestamp: number;
  actor: ChangeActor;
  selection?: { from: number; to: number } | null;
  /**
   * If present, indicates this edit was made while addressing a specific comment thread.
   * Kept optional for backwards compatibility with persisted events.
   */
  commentId?: string | null;
  /**
   * For LLM-attributed edits, stores the user-provided request/prompt (kept optional
   * for backwards compatibility with persisted events).
   */
  request?: string | null;
  steps: unknown[];
}

export type CommentThreadStatus = 'OPEN' | 'RESOLVED';

export interface SectionCommentAuthor {
  userId: string;
  name?: string | null;
}

export interface SectionCommentAnchor {
  from: number;
  to: number;
  /**
   * Snapshot of the referenced text at creation time (best-effort).
   * Used to help users understand what the comment referred to even if the doc changes.
   */
  text: string;
  /**
   * If true, the original anchor range no longer exists due to edits.
   */
  orphaned?: boolean;
}

export interface SectionCommentMessage {
  id: string;
  createdAt: number;
  author: SectionCommentAuthor;
  content: string;
}

export interface SectionCommentAiEdit {
  id: string;
  createdAt: number;
  model: string;
  changeEventId: string;
}

export interface SectionCommentThread {
  id: string;
  createdAt: number;
  updatedAt: number;
  createdBy: SectionCommentAuthor;
  anchor: SectionCommentAnchor | null;
  excerpt: string;
  messages: SectionCommentMessage[];
  status: CommentThreadStatus;
  resolvedAt?: number | null;
  resolvedBy?: SectionCommentAuthor | null;
  aiEdits?: SectionCommentAiEdit[];
}

export interface SectionVersion {
  id: string;
  timestamp: number;
  content: string;
  notes: string; // The prompts/notes used to generate this
  commitMessage?: string;
  source?: ChangeSource;
  baseContent?: string;
  changeEvents?: SectionChangeEvent[];
  commentThreads?: SectionCommentThread[];
  versionStartedAt?: number;
}

export interface Section {
  id: string;
  title: string;
  content: string; // Current content
  userNotes: string; // "What I want in this section"
  versions: SectionVersion[];
  lastModified: number;
  useReferences?: boolean;
  includeInWordCount?: boolean;
  currentVersionId?: string;
  currentVersionBase?: string;
  currentVersionStartedAt?: number;
  lastLlmContent?: string | null;
  changeEvents?: SectionChangeEvent[];
  commentThreads?: SectionCommentThread[];
}

export interface ProjectSettings {
  targetJournal: string;
  wordCountTarget: number;
  formattingRequirements: string;
  tone: string;
}

export interface Affiliation {
  id: string;
  institution: string;
  department?: string;
  city?: string;
  country?: string;
}

export interface Author {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  isCorresponding: boolean;
  affiliationIds: string[];
}

export interface ManuscriptMetadata {
  authors: Author[];
  affiliations: Affiliation[];
}

export interface Project {
  id: string;
  title: string;
  description: string;
  created: number;
  lastModified: number;
  settings: ProjectSettings;
  manuscriptMetadata: ManuscriptMetadata;
  sections: Section[];
  references: Reference[];
  figures: GeneratedFigure[];
}

export type FigureType = 'figure' | 'table' | 'supplemental';
export type FigureSourceType = 'AI' | 'UPLOAD';

export interface GeneratedFigure {
  id: string;
  prompt?: string;
  base64?: string;
  createdAt: number;
  title: string;
  label: string;
  description: string;
  includeInWordCount: boolean;
  figureType: FigureType;
  sourceType: FigureSourceType;
}

export interface PaperSearchResult {
  title: string;
  relevance?: string;
  doi?: string;
  pmid?: string;
  url?: string;
  authors?: string;
  year?: string;
  publication?: string; // Added journal/publication name
  abstract?: string;
  articleType?: string;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  PROJECT = 'PROJECT',
}

export enum SectionView {
  EDITOR = 'EDITOR',
  VERSIONS = 'VERSIONS',
  FIGURES = 'FIGURES',
  METADATA = 'METADATA',
  REFERENCES = 'REFERENCES',
  MANUSCRIPT = 'MANUSCRIPT',
}
