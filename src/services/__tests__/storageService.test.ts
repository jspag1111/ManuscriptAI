import { vi } from 'vitest';
import { createNewProject, deleteProject, generateId, getProjects, saveProject } from '../storageService';
import type { Project } from '@/types';

const createFetchResponse = (data: any, ok = true): Response => ({
  ok,
  json: async () => data,
  text: async () => (typeof data === 'string' ? data : JSON.stringify(data)),
}) as unknown as Response;

describe('storageService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates a reasonably unique id', () => {
    const id = generateId();
    expect(id).toMatch(/[0-9a-f-]{8,}/i);
    expect(generateId()).not.toBe(id);
  });

  it('creates a new project with default fields', () => {
    const project = createNewProject('Title', 'Desc');
    expect(project).toMatchObject({
      title: 'Title',
      description: 'Desc',
      settings: expect.any(Object),
      manuscriptMetadata: { authors: [], affiliations: [] },
      sections: [],
      references: [],
      figures: [],
    });
    expect(project.id).toBeTruthy();
  });

  it('fetches projects from the API and normalizes defaults', async () => {
    const mockProject: Partial<Project> = {
      id: 'project-1',
      title: 'Persisted',
      description: 'Check',
      created: 1,
      lastModified: 1,
      sections: [
        { id: 'section-1', title: 'Intro', content: 'Body', userNotes: 'Notes', versions: [], lastModified: 1 }
      ],
      figures: [
        { id: 'fig-1', base64: 'data:image/png;base64,abc', createdAt: 1 }
      ]
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createFetchResponse([mockProject])));
    const projects = await getProjects();

    expect(fetch).toHaveBeenCalledWith('/api/projects');
    expect(projects[0].manuscriptMetadata).toEqual({ authors: [], affiliations: [] });
    expect(projects[0].sections[0].useReferences).toBe(true);
    expect(projects[0].figures[0]).toMatchObject({
      label: 'Figure 1',
      includeInWordCount: false,
      figureType: 'figure',
      sourceType: 'AI',
    });
  });

  it('posts project changes to the API and normalizes response', async () => {
    const project = createNewProject('Update', 'Project');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createFetchResponse({ ...project, references: undefined })));
    const saved = await saveProject(project);

    expect(fetch).toHaveBeenCalledWith('/api/projects', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(project)
    }));
    expect(saved.references).toEqual([]);
  });

  it('calls delete endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createFetchResponse({}, true)));
    await deleteProject('delete-me');
    expect(fetch).toHaveBeenCalledWith('/api/projects/delete-me', expect.objectContaining({ method: 'DELETE' }));
  });
});
