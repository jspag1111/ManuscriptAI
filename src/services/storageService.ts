import { DEFAULT_SETTINGS, DEFAULT_WRITING_BRIEF, generateId, normalizeProject, normalizeProjects } from '@/lib/projects';
import type { Project, ProjectType, WritingBrief } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';
export { generateId };

type StorageAuthOptions = {
  token?: string | null;
};

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const message = await response.text();
    let normalized = message;
    if (message) {
      try {
        const parsed = JSON.parse(message);
        if (parsed?.error) {
          normalized = parsed.error;
        }
      } catch {
        // Keep original message.
      }
    }
    if (response.status === 401) {
      normalized = 'Unauthorized';
    }
    throw new Error(normalized || 'API request failed');
  }
  return response.json();
};

const buildAuthHeaders = (options?: StorageAuthOptions, initHeaders?: HeadersInit) => {
  const headers = new Headers(initHeaders);
  if (options?.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }
  return headers;
};

const fetchWithAuth = (input: RequestInfo | URL, init: RequestInit = {}, options?: StorageAuthOptions) => {
  const headers = buildAuthHeaders(options, init.headers);
  return fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });
};

export const getProjects = async (options?: StorageAuthOptions): Promise<Project[]> => {
  const response = await fetchWithAuth(`${API_BASE}/projects`, {}, options);
  const data = await handleResponse(response);
  return normalizeProjects(data);
};

export const saveProject = async (project: Project, options?: StorageAuthOptions): Promise<Project> => {
  const response = await fetchWithAuth(`${API_BASE}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(project)
  }, options);

  const saved = await handleResponse(response);
  return normalizeProject(saved);
};

export const deleteProject = async (id: string, options?: StorageAuthOptions): Promise<void> => {
  const response = await fetchWithAuth(`${API_BASE}/projects/${id}`, {
    method: 'DELETE'
  }, options);
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
    pubmedArticles: [],
    pubmedChats: [],
    pubmedActiveChatId: null,
  };
};
