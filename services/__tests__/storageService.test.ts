import { createNewProject, deleteProject, generateId, getProjects, saveProject } from '../storageService';
import type { Project, Section } from '../../types';

describe('storageService', () => {
  beforeEach(() => {
    localStorage.clear();
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

  it('saves, retrieves, and deletes projects in localStorage', () => {
    const base = createNewProject('Persisted', 'Check');
    const section: Section = {
      id: 'section-1',
      title: 'Intro',
      content: 'Body',
      userNotes: 'Notes',
      versions: [],
      lastModified: 1,
    };

    const project: Project = { ...base, sections: [section] };
    saveProject(project);

    const stored = getProjects()[0];
    expect(stored.sections[0].useReferences).toBe(true);
    expect(stored.manuscriptMetadata).toBeDefined();

    deleteProject(project.id);
    expect(getProjects()).toHaveLength(0);
  });

  it('updates existing projects when saving', async () => {
    const project = createNewProject('Update', 'Project');
    saveProject(project);

    const firstSaved = getProjects()[0];
    const initialModified = firstSaved.lastModified;

    const updated: Project = { ...firstSaved, title: 'Updated Title' };
    await new Promise((resolve) => setTimeout(resolve, 5));
    saveProject(updated);

    const retrieved = getProjects()[0];
    expect(retrieved.title).toBe('Updated Title');
    expect(retrieved.lastModified).toBeGreaterThan(initialModified);
  });
});
