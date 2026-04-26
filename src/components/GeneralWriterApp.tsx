'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Edit2, FileText, History, Plus, Save, Sparkles, Trash2, X } from 'lucide-react';
import { Button } from '@/components/Button';
import { HistoryViewer } from '@/components/HistoryViewer';
import { ProjectDashboard } from '@/components/ProjectDashboard';
import { SectionEditor } from '@/components/SectionEditor';
import { WritingBriefEditor } from '@/components/WritingBriefEditor';
import { createNewProject, deleteProject, generateId, getProjects, saveProject } from '@/services/storageService';
import { AppView, Project, Section } from '@/types';
import { getBibliographyOrder } from '@/utils/citationUtils';
import { calculateTextStats } from '@/utils/textStats';

const GENERAL_PROJECT_TYPE = 'GENERAL';

type WriterPanel = 'DRAFT' | 'BRIEF' | 'HISTORY';

const createDraftSection = (title = 'Section 1'): Section => ({
  id: generateId(),
  title,
  content: '',
  userNotes: '',
  versions: [],
  lastModified: Date.now(),
  useReferences: false,
  includeInWordCount: true,
  currentVersionId: generateId(),
  currentVersionBase: '',
  currentVersionStartedAt: Date.now(),
  lastLlmContent: null,
  changeEvents: [],
  commentThreads: [],
  draftingContext: {
    briefBlockIds: [],
    sectionIds: [],
    includeCurrentContent: true,
  },
});

const GeneralWriterApp: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);

  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');

  const [activePanel, setActivePanel] = useState<WriterPanel>('DRAFT');
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);

  const sortProjects = (items: Project[]) => [...items].sort((a, b) => b.lastModified - a.lastModified);
  const upsertProject = (items: Project[], project: Project) => sortProjects([project, ...items.filter(p => p.id !== project.id)]);

  const activeSection = useMemo(
    () => currentProject?.sections.find((section) => section.id === activeSectionId) ?? null,
    [currentProject, activeSectionId]
  );
  const bibliographyOrder = useMemo(
    () => (currentProject ? getBibliographyOrder(currentProject.sections) : []),
    [currentProject]
  );
  const draftStats = useMemo(
    () => (activeSection ? calculateTextStats(activeSection.content) : { words: 0, charsWithSpaces: 0, charsWithoutSpaces: 0 }),
    [activeSection]
  );
  const projectTotals = useMemo(
    () =>
      currentProject?.sections.reduce(
        (acc, section) => {
          const stats = calculateTextStats(section.content);
          acc.words += stats.words;
          acc.charsWithSpaces += stats.charsWithSpaces;
          acc.charsWithoutSpaces += stats.charsWithoutSpaces;
          return acc;
        },
        { words: 0, charsWithSpaces: 0, charsWithoutSpaces: 0 }
      ) ?? { words: 0, charsWithSpaces: 0, charsWithoutSpaces: 0 },
    [currentProject]
  );
  const dashboardStats = useMemo(() => {
    const totalDrafts = projects.reduce((sum, project) => sum + project.sections.length, 0);
    const latestUpdate = projects[0]?.lastModified;

    return [
      { label: 'Workspace', value: 'General Writing' },
      { label: 'Projects', value: `${projects.length}` },
      { label: 'Drafts', value: `${totalDrafts}` },
      { label: 'Latest edit', value: latestUpdate ? new Date(latestUpdate).toLocaleDateString() : 'No projects yet' },
    ];
  }, [projects]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setProjectError(null);
      try {
        const loaded = await getProjects();
        if (!isMounted) return;
        const general = loaded.filter((project) => project.projectType === GENERAL_PROJECT_TYPE);
        setProjects(sortProjects(general));
      } catch (e) {
        console.error('Failed to load projects from database', e);
        if (isMounted) setProjectError('Failed to load projects from local database.');
      } finally {
        if (isMounted) setIsLoadingProjects(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, []);

  const handleCreateProjectClick = () => {
    setNewProjectTitle('');
    setIsCreatingProject(true);
  };

  const handleConfirmCreateProject = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newProjectTitle.trim()) return;

    const newProject = createNewProject(newProjectTitle, 'General writing project', {
      projectType: GENERAL_PROJECT_TYPE,
    });
    newProject.sections = [createDraftSection('Section 1')];

    try {
      const saved = await saveProject(newProject);
      setProjects(prev => upsertProject(prev, saved));
      setCurrentProject(saved);
      setActiveSectionId(saved.sections[0]?.id || null);
      setActivePanel('BRIEF');
      setView(AppView.PROJECT);
    } catch (err) {
      console.error('Failed to create project', err);
      alert('Failed to create project. Please try again.');
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure? This cannot be undone.')) {
      try {
        await deleteProject(id);
        setProjects(prev => prev.filter(p => p.id !== id));
        if (currentProject?.id === id) {
          setCurrentProject(null);
          setActiveSectionId(null);
          setView(AppView.DASHBOARD);
        }
      } catch (err) {
        console.error('Failed to delete project', err);
        alert('Failed to delete project.');
      }
    }
  };

  const handleUpdateProject = (updatedProject: Project) => {
    const projectWithTimestamp = { ...updatedProject, lastModified: Date.now() };
    setCurrentProject(projectWithTimestamp);
    saveProject(projectWithTimestamp)
      .then((saved) => {
        setCurrentProject(saved);
        if (saved.projectType === GENERAL_PROJECT_TYPE) {
          setProjects(prev => upsertProject(prev, saved));
        }
      })
      .catch((err) => {
        console.error('Failed to save project', err);
        alert('Failed to save project changes.');
      });
  };

  const handleUpdateSection = (updatedSection: Section) => {
    if (!currentProject) return;
    const updatedSections = currentProject.sections.map(s =>
      s.id === updatedSection.id ? updatedSection : s
    );
    handleUpdateProject({
      ...currentProject,
      sections: updatedSections,
      lastModified: Date.now(),
    });
  };

  const handleCreateDraftSection = () => {
    if (!currentProject) return;
    const nextSection = createDraftSection(newSectionName.trim() || `Section ${currentProject.sections.length + 1}`);
    const nextProject = {
      ...currentProject,
      sections: [nextSection, ...currentProject.sections],
    };
    handleUpdateProject(nextProject);
    setActiveSectionId(nextSection.id);
    setActivePanel('DRAFT');
    setIsAddingSection(false);
    setNewSectionName('');
  };

  const handleStartEditSection = (event: React.MouseEvent, section: Section) => {
    event.stopPropagation();
    setEditingSectionId(section.id);
    setEditingTitle(section.title);
  };

  const handleSaveEditSection = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!editingSectionId || !editingTitle.trim() || !currentProject) return;

    handleUpdateProject({
      ...currentProject,
      sections: currentProject.sections.map((section) =>
        section.id === editingSectionId ? { ...section, title: editingTitle.trim() } : section
      ),
    });
    setEditingSectionId(null);
    setEditingTitle('');
  };

  const handleDeleteSection = (event: React.MouseEvent, sectionId: string) => {
    event.stopPropagation();
    if (!currentProject) return;
    if (!confirm('Delete this section? content will be lost.')) return;

    const nextSections = currentProject.sections
      .filter((section) => section.id !== sectionId)
      .map((section) => ({
        ...section,
        draftingContext: section.draftingContext
          ? {
              ...section.draftingContext,
              sectionIds: section.draftingContext.sectionIds.filter((id) => id !== sectionId),
            }
          : section.draftingContext,
      }));

    handleUpdateProject({
      ...currentProject,
      sections: nextSections,
    });

    if (activeSectionId === sectionId) {
      setActiveSectionId(nextSections[0]?.id || null);
      setActivePanel(nextSections.length > 0 ? 'DRAFT' : 'BRIEF');
    }
  };

  const openProject = (project: Project) => {
    setCurrentProject(project);
    setActiveSectionId(project.sections[0]?.id || null);
    setActivePanel('DRAFT');
    setView(AppView.PROJECT);
  };

  if (view === AppView.DASHBOARD) {
    return (
      <>
        <ProjectDashboard
          workspace="writing"
          badge="General Writing"
          title="General writing studio"
          description="Keep briefs, quick drafts, and everyday writing separate from manuscript work."
          createLabel="New Writing Project"
          projects={projects}
          isLoading={isLoadingProjects}
          projectError={projectError}
          emptyTitle="No writing projects yet"
          emptyDescription="Create one to start drafting without mixing it into your manuscript workspace."
          stats={dashboardStats}
          getProjectDescription={(project) => project.description || 'General writing project'}
          getProjectMetricLabel={(project) => `${project.sections.length} ${project.sections.length === 1 ? 'draft' : 'drafts'}`}
          onCreate={handleCreateProjectClick}
          onOpen={openProject}
          onDelete={handleDeleteProject}
        />

        {isCreatingProject && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">New project</p>
                  <h2 className="text-xl font-bold text-slate-900">Name your writing project</h2>
                </div>
                <button onClick={() => setIsCreatingProject(false)} className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-100">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleConfirmCreateProject} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Project Title</label>
                  <input
                    autoFocus
                    type="text"
                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all"
                    placeholder="e.g., Product launch email series"
                    value={newProjectTitle}
                    onChange={e => setNewProjectTitle(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="secondary" onClick={() => setIsCreatingProject(false)} className="px-4">Cancel</Button>
                  <Button type="submit" disabled={!newProjectTitle.trim()} className="px-4">Create Project</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  if (!currentProject) return null;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-transparent">
      <div className="max-w-[95vw] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white/80 border border-slate-200 rounded-2xl shadow-sm px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setView(AppView.DASHBOARD)} className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
              <ArrowLeft size={18} className="text-slate-700" />
            </button>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Writing Project</p>
              <h1 className="font-semibold text-slate-900 leading-tight break-words line-clamp-2 max-w-full sm:max-w-2xl" title={currentProject.title}>
                {currentProject.title}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="px-3 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-blue-300 hover:text-blue-700 transition-colors"
            >
              Manuscript Hub
            </Link>
            <span className="text-xs text-slate-500 flex items-center bg-slate-100 rounded-full px-3 py-1">
              <Save size={14} className="mr-1" /> Auto-saving
            </span>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          <div className="lg:w-72 w-full bg-white/80 border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 space-y-6 max-h-[70vh] lg:max-h-[calc(100vh-240px)] overflow-y-auto">
              <div className="space-y-3">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Workspace</h2>
                <button
                  onClick={() => setActivePanel('DRAFT')}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center shadow-sm ${activePanel === 'DRAFT'
                      ? 'bg-blue-600 text-white shadow-blue-200'
                      : 'text-slate-700 bg-slate-50 hover:bg-slate-100'
                    }`}
                >
                  <FileText size={16} className="mr-2" /> Section Editor
                </button>
                <button
                  onClick={() => setActivePanel('BRIEF')}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center shadow-sm ${activePanel === 'BRIEF'
                      ? 'bg-blue-600 text-white shadow-blue-200'
                      : 'text-slate-700 bg-slate-50 hover:bg-slate-100'
                    }`}
                >
                  <Sparkles size={16} className="mr-2" /> Writing Brief
                </button>
                <button
                  disabled={!activeSection}
                  onClick={() => setActivePanel('HISTORY')}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${activePanel === 'HISTORY'
                      ? 'bg-blue-600 text-white shadow-blue-200'
                      : 'text-slate-700 bg-slate-50 hover:bg-slate-100'
                    }`}
                >
                  <History size={16} className="mr-2" /> Version History
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Text Sections</h2>
                  <span className="text-[10px] text-slate-500">{currentProject.sections.length}</span>
                </div>
                <nav className="space-y-1">
                  {currentProject.sections.map((section) => (
                    <div key={section.id} className="group flex items-center gap-1 relative">
                      {editingSectionId === section.id ? (
                        <form
                          className="flex items-center flex-1 gap-1 px-2 py-1 bg-white border border-blue-300 rounded-md shadow-sm"
                          onSubmit={handleSaveEditSection}
                        >
                          <input
                            autoFocus
                            className="flex-1 min-w-0 text-sm outline-none bg-transparent"
                            value={editingTitle}
                            onChange={(event) => setEditingTitle(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Escape') {
                                setEditingSectionId(null);
                                setEditingTitle('');
                              }
                            }}
                          />
                          <button type="submit" className="text-green-600 hover:bg-green-50 p-1 rounded">
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSectionId(null);
                              setEditingTitle('');
                            }}
                            className="text-red-600 hover:bg-red-50 p-1 rounded"
                          >
                            <X size={14} />
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setActiveSectionId(section.id);
                              setActivePanel('DRAFT');
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors truncate ${
                              activeSectionId === section.id && activePanel !== 'BRIEF'
                                ? 'bg-blue-100 text-blue-700'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                            title={section.title}
                          >
                            {section.title}
                          </button>
                          <div className={`absolute right-1 flex items-center bg-white/90 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity ${activeSectionId === section.id ? 'opacity-100' : ''}`}>
                            <button onClick={(event) => handleStartEditSection(event, section)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded" title="Rename">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={(event) => handleDeleteSection(event, section.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded" title="Delete">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {isAddingSection ? (
                    <div className="flex items-center gap-1 px-2 py-1 mt-2 bg-white border border-blue-300 rounded-md shadow-sm">
                      <input
                        autoFocus
                        placeholder={`Section ${currentProject.sections.length + 1}`}
                        className="flex-1 min-w-0 text-sm outline-none bg-transparent"
                        value={newSectionName}
                        onChange={(event) => setNewSectionName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') handleCreateDraftSection();
                          if (event.key === 'Escape') {
                            setIsAddingSection(false);
                            setNewSectionName('');
                          }
                        }}
                      />
                      <button onClick={handleCreateDraftSection} className="text-green-600 hover:bg-green-50 p-1 rounded">
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingSection(false);
                          setNewSectionName('');
                        }}
                        className="text-red-600 hover:bg-red-50 p-1 rounded"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setIsAddingSection(true);
                        setNewSectionName('');
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:text-slate-700 flex items-center hover:bg-slate-50 rounded-md transition-colors mt-1"
                    >
                      <Plus size={14} className="mr-2" /> Add Section
                    </button>
                  )}
                </nav>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 tracking-wider uppercase">Current Section</h3>
                  <span className="text-[10px] text-slate-500">{activeSection ? activeSection.title : 'None yet'}</span>
                </div>
                <dl className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Words</dt>
                    <dd className="font-semibold text-slate-900">{draftStats.words.toLocaleString()}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Chars (with spaces)</dt>
                    <dd className="font-semibold text-slate-900">{draftStats.charsWithSpaces.toLocaleString()}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Chars (no spaces)</dt>
                    <dd className="font-semibold text-slate-900">{draftStats.charsWithoutSpaces.toLocaleString()}</dd>
                  </div>
                </dl>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 tracking-wider uppercase">Project Totals</h3>
                  <span className="text-[10px] text-slate-500">{currentProject.sections.length} sections</span>
                </div>
                <dl className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Words</dt>
                    <dd className="font-semibold text-slate-900">{projectTotals.words.toLocaleString()}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Chars (with spaces)</dt>
                    <dd className="font-semibold text-slate-900">{projectTotals.charsWithSpaces.toLocaleString()}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Chars (no spaces)</dt>
                    <dd className="font-semibold text-slate-900">{projectTotals.charsWithoutSpaces.toLocaleString()}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-[70vh] overflow-hidden">
            {activePanel === 'BRIEF' && (
              <WritingBriefEditor
                project={currentProject}
                onUpdateProject={handleUpdateProject}
                onOpenDraft={() => setActivePanel('DRAFT')}
              />
            )}

            {activePanel === 'DRAFT' && activeSection && (
              <SectionEditor
                section={activeSection}
                project={currentProject}
                onUpdateSection={handleUpdateSection}
                onViewHistory={() => setActivePanel('HISTORY')}
                defaultShowDetails={false}
              />
            )}

            {activePanel === 'DRAFT' && !activeSection && (
              <div className="h-full flex items-center justify-center bg-white border border-dashed border-slate-200 rounded-2xl">
                <div className="text-center space-y-3 p-6">
                  <h3 className="text-lg font-semibold text-slate-800">Create your first section</h3>
                  <p className="text-sm text-slate-500">Start building this writing project one section at a time.</p>
                  <Button
                    onClick={() => {
                      setIsAddingSection(true);
                      setNewSectionName('');
                    }}
                  >
                    Add Section
                  </Button>
                </div>
              </div>
            )}

            {activePanel === 'HISTORY' && activeSection && (
              <HistoryViewer
                section={activeSection}
                bibliographyOrder={bibliographyOrder}
                references={currentProject.references}
                onClose={() => setActivePanel('DRAFT')}
                onRestore={(version) => {
                  handleUpdateSection({
                    ...activeSection,
                    content: version.content,
                    userNotes: version.notes,
                    lastModified: Date.now(),
                    currentVersionBase: version.content,
                    currentVersionStartedAt: Date.now(),
                    currentVersionId: generateId(),
                    lastLlmContent: null,
                    changeEvents: [],
                    commentThreads: Array.isArray(version.commentThreads) ? version.commentThreads : [],
                    versions: [
                      {
                        ...version,
                        id: generateId(),
                        timestamp: Date.now(),
                        commitMessage: `Restored from ${new Date(version.timestamp).toLocaleDateString()}`,
                        source: 'USER',
                      },
                      ...activeSection.versions,
                    ],
                  });
                  setActivePanel('DRAFT');
                }}
              />
            )}

            {activePanel === 'HISTORY' && !activeSection && (
              <div className="h-full flex items-center justify-center bg-white border border-dashed border-slate-200 rounded-2xl">
                <div className="text-center space-y-2 p-6">
                  <h3 className="text-lg font-semibold text-slate-800">No section selected</h3>
                  <p className="text-sm text-slate-500">Pick a section from the sidebar to review its version history.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralWriterApp;
