'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, FileText, History, Plus, Save, Sparkles, Trash2, X } from 'lucide-react';
import { Button } from '@/components/Button';
import { HistoryViewer } from '@/components/HistoryViewer';
import { SectionEditor } from '@/components/SectionEditor';
import { WritingBriefEditor } from '@/components/WritingBriefEditor';
import { createNewProject, deleteProject, generateId, getProjects, saveProject } from '@/services/storageService';
import { AppView, Project, Section } from '@/types';
import { getBibliographyOrder } from '@/utils/citationUtils';
import { calculateTextStats } from '@/utils/textStats';

const GENERAL_PROJECT_TYPE = 'GENERAL';

type WriterPanel = 'DRAFT' | 'BRIEF' | 'HISTORY';

const createDraftSection = (): Section => ({
  id: generateId(),
  title: 'Draft',
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
});

const GeneralWriterApp: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);

  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');

  const [activePanel, setActivePanel] = useState<WriterPanel>('DRAFT');
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
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
    newProject.sections = [createDraftSection()];

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

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
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
    const nextSection = createDraftSection();
    const nextProject = {
      ...currentProject,
      sections: [nextSection, ...currentProject.sections],
    };
    handleUpdateProject(nextProject);
    setActiveSectionId(nextSection.id);
    setActivePanel('DRAFT');
  };

  if (view === AppView.DASHBOARD) {
    return (
      <div className="min-h-[calc(100vh-4rem)] relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(circle at 12% 20%, rgba(14,165,233,0.18), transparent 26%),' +
              'radial-gradient(circle at 80% 10%, rgba(16,185,129,0.12), transparent 24%),' +
              'radial-gradient(circle at 45% 80%, rgba(99,102,241,0.12), transparent 30%)',
          }}
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
          <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full bg-white/70 border border-white/80 uppercase tracking-wider text-slate-700 shadow-sm">
                General Writing
              </p>
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold text-slate-900">Your flexible writing studio</h1>
                <p className="text-slate-600">Capture briefs, draft quickly, and refine any kind of document with the same editing tools.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="px-3 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-blue-300 hover:text-blue-700 transition-colors"
              >
                Go to Manuscripts
              </Link>
              <Button onClick={handleCreateProjectClick} size="lg" className="shadow-lg shadow-blue-500/20 px-4">
                <Plus className="mr-2" size={20} /> New Writing Project
              </Button>
            </div>
          </header>

          {projectError && (
            <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 shadow-sm">
              {projectError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoadingProjects && (
              <div className="col-span-full py-12 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-2xl bg-white/60">
                Loading projects from local database...
              </div>
            )}

            {!isLoadingProjects && projects.map(project => (
              <div
                key={project.id}
                onClick={() => {
                  setCurrentProject(project);
                  setActiveSectionId(project.sections[0]?.id || null);
                  setActivePanel('DRAFT');
                  setView(AppView.PROJECT);
                }}
                className="bg-white/80 p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer backdrop-blur group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-sky-500/15 to-emerald-500/10 text-sky-700 border border-sky-100">
                    <Sparkles size={22} />
                  </div>
                  <button onClick={(e) => handleDeleteProject(e, project.id)} className="text-slate-300 hover:text-red-500">
                    <Trash2 size={18} />
                  </button>
                </div>
                <h3 className="font-semibold text-lg text-slate-900 mb-1 truncate">{project.title}</h3>
                <p className="text-sm text-slate-500 mb-4 line-clamp-2">{project.description || 'Untitled writing brief'}</p>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Clock size={14} /> Edited {new Date(project.lastModified).toLocaleDateString()}</span>
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px]">{project.sections.length} draft</span>
                </div>
              </div>
            ))}

            {!isLoadingProjects && projects.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-2xl bg-white/60">
                <p className="text-lg font-semibold text-slate-700 mb-2">No writing projects yet</p>
                <p className="text-sm text-slate-500">Create one to start drafting.</p>
              </div>
            )}
          </div>
        </div>

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
      </div>
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
                  <FileText size={16} className="mr-2" /> Draft
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
                  onClick={() => setActivePanel('HISTORY')}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center shadow-sm ${activePanel === 'HISTORY'
                      ? 'bg-blue-600 text-white shadow-blue-200'
                      : 'text-slate-700 bg-slate-50 hover:bg-slate-100'
                    }`}
                >
                  <History size={16} className="mr-2" /> Version History
                </button>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 tracking-wider uppercase">Draft Stats</h3>
                  <span className="text-[10px] text-slate-500">{activeSection ? 'Active' : 'None yet'}</span>
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
                  <h3 className="text-lg font-semibold text-slate-800">Create your first draft</h3>
                  <p className="text-sm text-slate-500">Start with a blank document and draft with the full editor.</p>
                  <Button onClick={handleCreateDraftSection}>Create Draft</Button>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralWriterApp;
