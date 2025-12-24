import { DEFAULT_SETTINGS, DEFAULT_WRITING_BRIEF, generateId, normalizeProject, normalizeProjects } from '@/lib/projects';
import type { Project, ProjectType, WritingBrief } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';
export { generateId };

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
  return normalizeProjects(data);
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

export const createNewProject = (
  title: string,
  description: string,
  options?: { projectType?: ProjectType; writingBrief?: WritingBrief }
): Project => {
  return {
    id: generateId(),
    title,
    description,
    created: Date.now(),
    lastModified: Date.now(),
    projectType: options?.projectType ?? 'MANUSCRIPT',
    writingBrief: options?.writingBrief ?? { ...DEFAULT_WRITING_BRIEF },
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
