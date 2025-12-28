import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { FullManuscriptView } from '@/components/FullManuscriptView';
import { SectionView, type Project } from '@/types';

const sectionEditorSpy = vi.fn();

vi.mock('@/components/SectionEditor', () => ({
  SectionEditor: (props: any) => {
    sectionEditorSpy(props);
    return (
      <div data-testid={`section-editor-${props.section.id}`}>
        <button type="button" onClick={props.onViewHistory}>
          View history
        </button>
      </div>
    );
  },
}));

const createProject = (): Project => ({
  id: 'project-1',
  title: 'Test project',
  description: 'Test',
  created: 1,
  lastModified: 1,
  settings: {
    targetJournal: '',
    wordCountTarget: 0,
    formattingRequirements: '',
    tone: '',
  },
  manuscriptMetadata: { authors: [], affiliations: [] },
  sections: [
    {
      id: 'sec-intro',
      title: 'Introduction',
      content: 'Intro',
      userNotes: '',
      versions: [],
      lastModified: 1,
      changeEvents: [],
      commentThreads: [],
    },
    {
      id: 'sec-methods',
      title: 'Methods',
      content: 'Methods',
      userNotes: '',
      versions: [],
      lastModified: 1,
      changeEvents: [],
      commentThreads: [],
    },
  ],
  references: [],
  figures: [],
});

describe('FullManuscriptView', () => {
  beforeEach(() => {
    sectionEditorSpy.mockClear();
  });

  it('renders all sections and wires embedded section editors', () => {
    const project = createProject();
    render(
      <FullManuscriptView
        project={project}
        onUpdateSection={vi.fn()}
        onOpenSection={vi.fn()}
      />
    );

    expect(screen.getByText('Full manuscript')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Introduction' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Methods' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Jump to section' })).toBeInTheDocument();

    expect(screen.getByTestId('section-editor-sec-intro')).toBeInTheDocument();
    expect(screen.getByTestId('section-editor-sec-methods')).toBeInTheDocument();

    expect(sectionEditorSpy).toHaveBeenCalledTimes(2);
    for (const call of sectionEditorSpy.mock.calls) {
      expect(call[0]).toMatchObject({ defaultShowDetails: false });
    }
  });

  it('opens a section in single-section view from the full manuscript view', async () => {
    const user = userEvent.setup();
    const project = createProject();
    const onOpenSection = vi.fn();

    render(
      <FullManuscriptView
        project={project}
        onUpdateSection={vi.fn()}
        onOpenSection={onOpenSection}
      />
    );

    const methodsSection = screen.getByRole('heading', { name: 'Methods' }).closest('section');
    expect(methodsSection).toBeTruthy();

    await user.click(within(methodsSection as HTMLElement).getByRole('button', { name: /open section/i }));
    expect(onOpenSection).toHaveBeenCalledWith('sec-methods');
  });

  it('routes history requests to the section versions view', async () => {
    const user = userEvent.setup();
    const project = createProject();
    const onOpenSection = vi.fn();

    render(
      <FullManuscriptView
        project={project}
        onUpdateSection={vi.fn()}
        onOpenSection={onOpenSection}
      />
    );

    await user.click(within(screen.getByTestId('section-editor-sec-methods')).getByRole('button', { name: 'View history' }));
    expect(onOpenSection).toHaveBeenCalledWith('sec-methods', SectionView.VERSIONS);
  });
});
