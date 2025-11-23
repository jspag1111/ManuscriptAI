
import { Project } from '../types';

const STORAGE_KEY = 'manuscript_ai_projects_v1';

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

export const getProjects = (): Project[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const projects = data ? JSON.parse(data) : [];
    
    // Migration: Ensure new fields exist on old projects
    return projects.map((p: any) => ({
      ...p,
      manuscriptMetadata: p.manuscriptMetadata || { authors: [], affiliations: [] },
      // Ensure settings exists if it was missing in very old versions
      settings: p.settings || {
        targetJournal: '',
        wordCountTarget: 3000,
        formattingRequirements: '',
        tone: 'Academic and formal',
      }
    }));
  } catch (e) {
    console.error("Failed to load projects", e);
    return [];
  }
};

export const saveProject = (project: Project): void => {
  const projects = getProjects();
  const index = projects.findIndex(p => p.id === project.id);
  
  if (index >= 0) {
    projects[index] = { ...project, lastModified: Date.now() };
  } else {
    projects.push({ ...project, lastModified: Date.now() });
  }
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error("Failed to save project - quota might be exceeded", e);
    // In a real app, handle quota exceeded
  }
};

export const deleteProject = (id: string): void => {
  const projects = getProjects();
  const filtered = projects.filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};

export const createNewProject = (title: string, description: string): Project => {
  return {
    id: generateId(),
    title,
    description,
    created: Date.now(),
    lastModified: Date.now(),
    settings: {
      targetJournal: '',
      wordCountTarget: 3000,
      formattingRequirements: '',
      tone: 'Academic and formal',
    },
    manuscriptMetadata: {
        authors: [],
        affiliations: []
    },
    sections: [],
    references: [],
    figures: [],
  };
};
