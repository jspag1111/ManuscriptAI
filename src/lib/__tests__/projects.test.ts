import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, DEFAULT_WRITING_BRIEF, normalizeProject } from '../projects';

import type { Project } from '@/types';

const baseSection = {
  id: 's1',
  title: 'Intro',
  content: 'Hello',
  userNotes: '',
  versions: [],
  lastModified: 1,
};

const baseProject: Partial<Project> = {
  title: 'Test',
  description: 'Desc',
  sections: [baseSection],
  figures: [
    {
      id: 'f1',
      title: '',
      label: '',
      description: '',
      figureType: 'table',
    },
  ],
};

describe('normalizeProject', () => {
  it('fills defaults to keep client and API in sync', () => {
    const normalized = normalizeProject(baseProject);

    expect(normalized.settings).toEqual(DEFAULT_SETTINGS);
    expect(normalized.projectType).toBe('MANUSCRIPT');
    expect(normalized.writingBrief).toEqual(DEFAULT_WRITING_BRIEF);
    expect(normalized.manuscriptMetadata).toEqual({ authors: [], affiliations: [] });
    expect(normalized.sections[0].useReferences).toBe(true);
    expect(normalized.sections[0].includeInWordCount).toBe(true);
    expect(normalized.sections[0].currentVersionId).toBeTruthy();
    expect(normalized.sections[0].currentVersionBase).toBe('Hello');
    expect(normalized.sections[0].changeEvents).toEqual([]);
    expect(normalized.figures[0].label).toBe('Table 1');
    expect(normalized.figures[0].includeInWordCount).toBe(false);
    expect(normalized.pubmedArticles).toEqual([]);
    expect(normalized.pubmedChats).toEqual([]);
    expect(normalized.pubmedActiveChatId).toBeNull();
  });
});
