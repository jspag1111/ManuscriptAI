
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
}

export interface SectionVersion {
  id: string;
  timestamp: number;
  content: string;
  notes: string; // The prompts/notes used to generate this
  commitMessage?: string;
}

export interface Section {
  id: string;
  title: string;
  content: string; // Current content
  userNotes: string; // "What I want in this section"
  versions: SectionVersion[];
  lastModified: number;
}

export interface ProjectSettings {
  targetJournal: string;
  wordCountTarget: number;
  formattingRequirements: string;
  tone: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  created: number;
  lastModified: number;
  settings: ProjectSettings;
  sections: Section[];
  references: Reference[];
  figures: GeneratedFigure[];
}

export interface GeneratedFigure {
  id: string;
  prompt: string;
  base64: string;
  createdAt: number;
}

export interface PaperSearchResult {
  title: string;
  relevance: string;
  doi?: string;
  pmid?: string;
  url?: string;
  authors?: string;
  year?: string;
  abstract?: string;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  PROJECT = 'PROJECT',
}

export enum SectionView {
  EDITOR = 'EDITOR',
  VERSIONS = 'VERSIONS',
  FIGURES = 'FIGURES',
}