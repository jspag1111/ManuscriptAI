
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DEFAULT_SECTIONS } from '@/constants';
import { Button } from '@/components/Button';
import { FigureGenerator } from '@/components/FigureGenerator';
import { FullManuscriptView } from '@/components/FullManuscriptView';
import { HistoryViewer } from '@/components/HistoryViewer';
import { MetadataEditor } from '@/components/MetadataEditor';
import { ProjectDashboard } from '@/components/ProjectDashboard';
import { ReferenceManager } from '@/components/ReferenceManager';
import { SectionEditor } from '@/components/SectionEditor';
import { createNewProject, deleteProject, generateId, getProjects, saveProject } from '@/services/storageService';
import { exportProjectToWord } from '@/services/exportService';
import { AppView, Project, Section, SectionView } from '@/types';
import { getBibliographyOrder } from '@/utils/citationUtils';
import { calculateTextStats } from '@/utils/textStats';
import { ArrowLeft, BookOpen, Check, Download, Edit2, FileText, Image as ImageIcon, Info, Plus, Save, Trash2, X } from 'lucide-react';

const ManuscriptApp: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);

  // Project Creation State
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');

  // Project View State
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SectionView>(SectionView.EDITOR);

  // Section Management State
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);
  const projectTotals = useMemo(() => {
    const empty = {
      words: 0,
      charsWithSpaces: 0,
      charsWithoutSpaces: 0,
      totalSections: 0,
      includedSections: 0,
      figureWords: 0,
      totalFigures: 0,
      includedFigures: 0,
    };
    if (!currentProject) {
      return empty;
    }

    const sectionTotals = currentProject.sections.reduce(
      (acc, section) => {
        const stats = calculateTextStats(section.content);
        const include = section.includeInWordCount !== false;
        acc.totalSections += 1;
        if (include) {
          acc.words += stats.words;
          acc.charsWithSpaces += stats.charsWithSpaces;
          acc.charsWithoutSpaces += stats.charsWithoutSpaces;
          acc.includedSections += 1;
        }
        return acc;
      },
      {
        words: 0,
        charsWithSpaces: 0,
        charsWithoutSpaces: 0,
        totalSections: 0,
        includedSections: 0,
      }
    );

    const figureTotals = currentProject.figures.reduce(
      (acc, fig) => {
        acc.totalFigures += 1;
        if (fig.includeInWordCount) {
          const text = [fig.label, fig.title, fig.description].filter(Boolean).join(' ').trim();
          const stats = calculateTextStats(text);
          acc.words += stats.words;
          acc.charsWithSpaces += stats.charsWithSpaces;
          acc.charsWithoutSpaces += stats.charsWithoutSpaces;
          acc.includedFigures += 1;
        }
        return acc;
      },
      {
        words: 0,
        charsWithSpaces: 0,
        charsWithoutSpaces: 0,
        totalFigures: 0,
        includedFigures: 0,
      }
    );

    return {
      words: sectionTotals.words + figureTotals.words,
      charsWithSpaces: sectionTotals.charsWithSpaces + figureTotals.charsWithSpaces,
      charsWithoutSpaces: sectionTotals.charsWithoutSpaces + figureTotals.charsWithoutSpaces,
      totalSections: sectionTotals.totalSections,
      includedSections: sectionTotals.includedSections,
      figureWords: figureTotals.words,
      totalFigures: figureTotals.totalFigures,
      includedFigures: figureTotals.includedFigures,
    };
  }, [currentProject]);

  const bibliographyOrder = useMemo(
    () => (currentProject ? getBibliographyOrder(currentProject.sections) : []),
    [currentProject]
  );
  const dashboardStats = useMemo(() => {
    const totalSections = projects.reduce((sum, project) => sum + project.sections.length, 0);
    const totalFigures = projects.reduce((sum, project) => sum + project.figures.length, 0);
    const latestUpdate = projects[0]?.lastModified;

    return [
      { label: 'Workspace', value: 'Manuscripts' },
      { label: 'Projects', value: `${projects.length}` },
      { label: 'Sections', value: `${totalSections}` },
      { label: 'Figures', value: `${totalFigures}` },
      { label: 'Latest edit', value: latestUpdate ? new Date(latestUpdate).toLocaleDateString() : 'No projects yet' },
    ];
  }, [projects]);

  const isManuscriptProject = (project: Project) => project.projectType !== 'GENERAL';
  const sortProjects = (items: Project[]) => [...items].sort((a, b) => b.lastModified - a.lastModified);
  const upsertProject = (items: Project[], project: Project) => sortProjects([project, ...items.filter(p => p.id !== project.id)]);

  // Load initial data
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setProjectError(null);
      try {
        const loaded = await getProjects();
        if (!isMounted) return;
        const manuscripts = loaded.filter(isManuscriptProject);
        setProjects(sortProjects(manuscripts));
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

    const newProject = createNewProject(newProjectTitle, "Draft manuscript");
    // Hydrate default sections
    newProject.sections = DEFAULT_SECTIONS.map(ds => ({
      id: generateId(),
      title: ds.title,
      content: '',
      userNotes: ds.defaultNotes,
      versions: [],
      lastModified: Date.now(),
      useReferences: true,
      includeInWordCount: true,
      currentVersionId: generateId(),
      currentVersionBase: '',
      currentVersionStartedAt: Date.now(),
      lastLlmContent: null,
      changeEvents: [],
      commentThreads: [],
    }));

    try {
      const saved = await saveProject(newProject);
      setProjects(prev => upsertProject(prev, saved));
      setCurrentProject(saved);
      setActiveSectionId(saved.sections[0]?.id || null);
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
    if (confirm("Are you sure? This cannot be undone.")) {
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
      setProjects(prev => (isManuscriptProject(saved) ? upsertProject(prev, saved) : prev));
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
      lastModified: Date.now()
    });
  };

  const handleExport = () => {
    if (currentProject) {
      exportProjectToWord(currentProject);
    }
  };

  // Section Management Handlers
  const handleAddSection = () => {
    if (!newSectionName.trim()) return;

    const newSec: Section = {
      id: generateId(),
      title: newSectionName,
      content: '',
      userNotes: '',
      versions: [],
      lastModified: Date.now(),
      useReferences: true,
      includeInWordCount: true,
      currentVersionId: generateId(),
      currentVersionBase: '',
      currentVersionStartedAt: Date.now(),
      lastLlmContent: null,
      changeEvents: [],
      commentThreads: [],
    };

    if (currentProject) {
      handleUpdateProject({
        ...currentProject,
        sections: [...currentProject.sections, newSec]
      });
      setActiveSectionId(newSec.id);
      setActiveTab(SectionView.EDITOR);
    }

    setIsAddingSection(false);
    setNewSectionName('');
  };

  const handleStartEditSection = (e: React.MouseEvent, section: Section) => {
    e.stopPropagation();
    setEditingSectionId(section.id);
    setEditingTitle(section.title);
  };

  const handleSaveEditSection = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (editingSectionId && editingTitle.trim() && currentProject) {
      const updatedSections = currentProject.sections.map(s =>
        s.id === editingSectionId ? { ...s, title: editingTitle } : s
      );
      handleUpdateProject({
        ...currentProject,
        sections: updatedSections
      });
      setEditingSectionId(null);
    }
  };

  const handleDeleteSection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!currentProject) return;

    if (confirm("Delete this section? content will be lost.")) {
      const updatedSections = currentProject.sections.filter(s => s.id !== id);
      handleUpdateProject({
        ...currentProject,
        sections: updatedSections
      });

      if (activeSectionId === id) {
        setActiveSectionId(updatedSections[0]?.id || null);
      }
    }
  };

  const handleToggleSectionInclusion = (id: string) => {
    if (!currentProject) return;
    const target = currentProject.sections.find(s => s.id === id);
    if (!target) return;
    const include = target.includeInWordCount !== false;
    handleUpdateSection({
      ...target,
      includeInWordCount: !include
    });
  };

  const handleToggleFigureInclusion = (id: string) => {
    if (!currentProject) return;
    const updatedFigures = currentProject.figures.map(fig =>
      fig.id === id ? { ...fig, includeInWordCount: !fig.includeInWordCount } : fig
    );
    handleUpdateProject({
      ...currentProject,
      figures: updatedFigures
    });
  };

  const openProject = (project: Project) => {
    setCurrentProject(project);
    setActiveSectionId(project.sections[0]?.id || null);
    setView(AppView.PROJECT);
  };


  // Dashboard View
  if (view === AppView.DASHBOARD) {
    return (
      <>
        <ProjectDashboard
          workspace="manuscript"
          badge="Manuscripts"
          title="Manuscript workspace"
          description="Keep long-form manuscript projects, sections, references, and figures in one focused area."
          createLabel="New Manuscript"
          projects={projects}
          isLoading={isLoadingProjects}
          projectError={projectError}
          emptyTitle="No manuscripts yet"
          emptyDescription="Create your first manuscript to start organizing sections, references, and figures in a dedicated workspace."
          stats={dashboardStats}
          getProjectDescription={(project) => project.description || 'Draft manuscript'}
          getProjectMetricLabel={(project) => `${project.sections.length} ${project.sections.length === 1 ? 'section' : 'sections'}`}
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
                  <h2 className="text-xl font-bold text-slate-900">Name your manuscript</h2>
                </div>
                <button onClick={() => setIsCreatingProject(false)} className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-100">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleConfirmCreateProject} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Project Title</label>
                  <input
                    autoFocus
                    type="text"
                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all"
                    placeholder="e.g., Quantum Entanglement in Neural Networks"
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

  // Project Workspace View
  if (!currentProject) return null;

  const activeSection = currentProject.sections.find(s => s.id === activeSectionId);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-transparent">
      <div className="max-w-[95vw] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {/* Top Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 border border-slate-200 rounded-2xl shadow-sm px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setView(AppView.DASHBOARD)} className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
              <ArrowLeft size={18} className="text-slate-700" />
            </button>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Project</p>
              <h1
                className="font-semibold text-slate-900 leading-tight break-words line-clamp-2 max-w-full sm:max-w-2xl"
                title={currentProject.title}
              >
                {currentProject.title}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleExport} className="flex items-center gap-2 shadow-sm">
              <Download size={16} /> Export DOCX
            </Button>
            <span className="text-xs text-slate-500 flex items-center bg-slate-100 rounded-full px-3 py-1">
              <Save size={14} className="mr-1" /> Auto-saving
            </span>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          {/* Sidebar */}
          <div className="lg:w-72 w-full bg-white/80 border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 space-y-6 max-h-[70vh] lg:max-h-[calc(100vh-240px)] overflow-y-auto">
              <div className="space-y-3">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Manuscript Info</h2>
                <button
                  onClick={() => setActiveTab(SectionView.MANUSCRIPT)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center shadow-sm ${activeTab === SectionView.MANUSCRIPT
                      ? 'bg-blue-600 text-white shadow-blue-200'
                      : 'text-slate-700 bg-slate-50 hover:bg-slate-100'
                    }`}
                >
                  <FileText size={16} className="mr-2" /> Full Manuscript
                </button>
                <button
                  onClick={() => setActiveTab(SectionView.METADATA)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center shadow-sm ${activeTab === SectionView.METADATA
                      ? 'bg-blue-600 text-white shadow-blue-200'
                      : 'text-slate-700 bg-slate-50 hover:bg-slate-100'
                    }`}
                >
                  <Info size={16} className="mr-2" /> Title & Authors
                </button>
              </div>

              <div className="space-y-2">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sections</h2>
                <nav className="space-y-1">
                  {currentProject.sections.map(section => (
                    <div key={section.id} className="group flex items-center gap-1 relative">
                      {editingSectionId === section.id ? (
                        <div className="flex items-center flex-1 gap-1 px-2 py-1 bg-white border border-blue-300 rounded-md shadow-sm">
                          <input
                            autoFocus
                            className="flex-1 min-w-0 text-sm outline-none bg-transparent"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditSection();
                              if (e.key === 'Escape') setEditingSectionId(null);
                            }}
                          />
                          <button onClick={handleSaveEditSection} className="text-green-600 hover:bg-green-50 p-1 rounded"><Check size={14} /></button>
                          <button onClick={() => setEditingSectionId(null)} className="text-red-600 hover:bg-red-50 p-1 rounded"><X size={14} /></button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setActiveSectionId(section.id);
                              setActiveTab(SectionView.EDITOR);
                            }}
                            className={`flex-1 text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors truncate pr-16 ${activeTab === SectionView.EDITOR && activeSectionId === section.id
                                ? 'bg-blue-50 text-blue-800 border border-blue-100'
                                : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                              }`}
                          >
                            {section.title}
                          </button>
                          <div className={`absolute right-1 flex items-center bg-white/80 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity ${activeSectionId === section.id ? 'opacity-100' : ''}`}>
                            <button onClick={(e) => handleStartEditSection(e, section)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded" title="Rename">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={(e) => handleDeleteSection(e, section.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded" title="Delete">
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
                        placeholder="New Section..."
                        className="flex-1 min-w-0 text-sm outline-none bg-transparent"
                        value={newSectionName}
                        onChange={(e) => setNewSectionName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddSection();
                          if (e.key === 'Escape') setIsAddingSection(false);
                        }}
                      />
                      <button onClick={handleAddSection} className="text-green-600 hover:bg-green-50 p-1 rounded"><Check size={14} /></button>
                      <button onClick={() => setIsAddingSection(false)} className="text-red-600 hover:bg-red-50 p-1 rounded"><X size={14} /></button>
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

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tools</h2>
                <nav className="space-y-1">
                  <button
                    onClick={() => setActiveTab(SectionView.FIGURES)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${activeTab === SectionView.FIGURES
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    <ImageIcon size={16} className="mr-2" /> Figures
                  </button>
                  <button
                    onClick={() => setActiveTab(SectionView.REFERENCES)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${activeTab === SectionView.REFERENCES
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    <BookOpen size={16} className="mr-2" /> References
                  </button>
                </nav>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 tracking-wider uppercase">Project Totals</h3>
                  <span className="text-[10px] text-slate-500">
                    {projectTotals.includedSections}/{projectTotals.totalSections} sections
                  </span>
                </div>
                <dl className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Words</dt>
                    <dd className="font-semibold text-slate-900">{projectTotals.words.toLocaleString()}</dd>
                  </div>
                  {currentProject.figures.length > 0 && (
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-600">+ Figure/Table Text</dt>
                      <dd className="font-semibold text-slate-800">{projectTotals.figureWords.toLocaleString()}</dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Chars (with spaces)</dt>
                    <dd className="font-semibold text-slate-900">{projectTotals.charsWithSpaces.toLocaleString()}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Chars (no spaces)</dt>
                    <dd className="font-semibold text-slate-900">{projectTotals.charsWithoutSpaces.toLocaleString()}</dd>
                  </div>
                </dl>
                <div className="pt-2 border-t border-slate-200 space-y-1">
                  <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Included Sections</p>
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {currentProject.sections.map(section => {
                      const include = section.includeInWordCount !== false;
                      return (
                        <label key={section.id} className="flex items-center gap-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={include}
                            onChange={() => handleToggleSectionInclusion(section.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="truncate">{section.title}</span>
                        </label>
                      );
                    })}
                    {currentProject.sections.length === 0 && (
                      <p className="text-[11px] text-slate-400">No sections available.</p>
                    )}
                  </div>
                </div>
                {currentProject.figures.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 space-y-1">
                    <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                      Figure/Table Captions
                      <span className="ml-1 font-normal text-slate-400">
                        ({projectTotals.includedFigures}/{currentProject.figures.length} counted)
                      </span>
                    </p>
                    <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                      {currentProject.figures.map((figure, index) => {
                        const label = figure.label || (figure.figureType === 'table'
                          ? `Table ${index + 1}`
                          : figure.figureType === 'supplemental'
                            ? `Supplemental ${index + 1}`
                            : `Figure ${index + 1}`);
                        return (
                          <label key={figure.id} className="flex items-center gap-2 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              checked={figure.includeInWordCount}
                              onChange={() => handleToggleFigureInclusion(figure.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="truncate">{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-h-[70vh] overflow-hidden">
            {activeTab === SectionView.EDITOR && activeSection && (
              <SectionEditor
                section={activeSection}
                project={currentProject}
                onUpdateSection={handleUpdateSection}
                onViewHistory={() => setActiveTab(SectionView.VERSIONS)}
              />
            )}

            {activeTab === SectionView.VERSIONS && activeSection && (
              <HistoryViewer
                section={activeSection}
                bibliographyOrder={bibliographyOrder}
                references={currentProject.references}
                onClose={() => setActiveTab(SectionView.EDITOR)}
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
                      ...activeSection.versions
                    ]
                  });
                  setActiveTab(SectionView.EDITOR);
                }}
              />
            )}

            {activeTab === SectionView.FIGURES && (
              <FigureGenerator
                project={currentProject}
                onUpdateProject={handleUpdateProject}
              />
            )}

            {activeTab === SectionView.REFERENCES && (
              <ReferenceManager
                project={currentProject}
                onUpdateProject={handleUpdateProject}
              />
            )}

            {activeTab === SectionView.METADATA && (
              <MetadataEditor
                project={currentProject}
                onUpdateProject={handleUpdateProject}
              />
            )}

            {activeTab === SectionView.MANUSCRIPT && (
              <FullManuscriptView
                project={currentProject}
                onUpdateSection={handleUpdateSection}
                onOpenSection={(sectionId, nextView) => {
                  setActiveSectionId(sectionId);
                  setActiveTab(nextView ?? SectionView.EDITOR);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManuscriptApp;
