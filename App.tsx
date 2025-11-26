

import React, { useState, useEffect } from 'react';
import { Project, AppView, SectionView, Section } from './types';
import { getProjects, saveProject, createNewProject, deleteProject, generateId } from './services/storageService';
import { exportProjectToWord } from './services/exportService';
import { DEFAULT_SECTIONS } from './constants';
import { Button } from './components/Button';
import { SectionEditor } from './components/SectionEditor';
import { ReferenceManager } from './components/ReferenceManager';
import { FigureGenerator } from './components/FigureGenerator';
import { HistoryViewer } from './components/HistoryViewer';
import { MetadataEditor } from './components/MetadataEditor';
import { Plus, Layout, Settings, FileText, Trash2, ArrowLeft, BookOpen, Image, Save, X, Edit2, Check, Download, Info } from 'lucide-react';

const App: React.FC = () => {
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
  
  // Load initial data
  useEffect(() => {
    setProjects(getProjects());
  }, []);

  const handleCreateProjectClick = () => {
    setNewProjectTitle('');
    setIsCreatingProject(true);
  };

  const handleConfirmCreateProject = (e?: React.FormEvent) => {
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
      useReferences: true
    }));
    
    saveProject(newProject);
    setProjects(getProjects());
    setCurrentProject(newProject);
    setActiveSectionId(newProject.sections[0].id);
    setView(AppView.PROJECT);
    setIsCreatingProject(false);
  };

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if(confirm("Are you sure? This cannot be undone.")) {
      deleteProject(id);
      setProjects(getProjects());
    }
  };

  const handleUpdateProject = (updatedProject: Project) => {
    setCurrentProject(updatedProject);
    saveProject(updatedProject);
    setProjects(getProjects()); // Sync list
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
      useReferences: true
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


  // Dashboard View
  if (view === AppView.DASHBOARD) {
    return (
      <div className="min-h-screen bg-slate-100 p-8 relative">
        <div className="max-w-5xl mx-auto">
          <header className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">ManuscriptAI</h1>
              <p className="text-slate-500 mt-1">Your intelligent research assistant</p>
            </div>
            <Button onClick={handleCreateProjectClick} size="lg">
              <Plus className="mr-2" size={20} /> New Project
            </Button>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <div 
                key={project.id} 
                onClick={() => {
                  setCurrentProject(project);
                  setActiveSectionId(project.sections[0]?.id || null);
                  setView(AppView.PROJECT);
                }}
                className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                    <FileText size={24} />
                  </div>
                  <button onClick={(e) => handleDeleteProject(e, project.id)} className="text-slate-300 hover:text-red-500">
                    <Trash2 size={18} />
                  </button>
                </div>
                <h3 className="font-semibold text-lg text-slate-800 mb-1">{project.title}</h3>
                <p className="text-sm text-slate-500 mb-4 truncate">{project.description}</p>
                <div className="flex items-center text-xs text-slate-400">
                  <ClockIcon size={14} className="mr-1" />
                  Edited {new Date(project.lastModified).toLocaleDateString()}
                </div>
              </div>
            ))}
            
            {projects.length === 0 && (
              <div className="col-span-full py-20 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <p>No projects yet. Create one to get started.</p>
              </div>
            )}
          </div>
        </div>

        {/* Create Project Modal */}
        {isCreatingProject && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
             <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
                 <div className="flex justify-between items-center mb-4">
                     <h2 className="text-xl font-bold text-slate-800">Create New Project</h2>
                     <button onClick={() => setIsCreatingProject(false)} className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-100">
                         <X size={24} />
                     </button>
                 </div>
                 <form onSubmit={handleConfirmCreateProject}>
                     <div className="mb-6">
                         <label className="block text-sm font-medium text-slate-700 mb-2">Project Title</label>
                         <input 
                             autoFocus
                             type="text" 
                             className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all"
                             placeholder="e.g., Quantum Entanglement in Neural Networks"
                             value={newProjectTitle}
                             onChange={e => setNewProjectTitle(e.target.value)}
                         />
                     </div>
                     <div className="flex justify-end gap-3">
                         <Button type="button" variant="secondary" onClick={() => setIsCreatingProject(false)}>Cancel</Button>
                         <Button type="submit" disabled={!newProjectTitle.trim()}>Create Project</Button>
                     </div>
                 </form>
             </div>
          </div>
        )}
      </div>
    );
  }

  // Project Workspace View
  if (!currentProject) return null;

  const activeSection = currentProject.sections.find(s => s.id === activeSectionId);

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Top Header */}
      <header className="h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-white z-10 shrink-0">
        <div className="flex items-center">
          <button onClick={() => setView(AppView.DASHBOARD)} className="p-2 hover:bg-slate-100 rounded-full mr-2">
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <h1 className="font-semibold text-slate-800 truncate max-w-md" title={currentProject.title}>
            {currentProject.title}
          </h1>
        </div>
        
        <div className="flex items-center space-x-2">
           <Button variant="secondary" size="sm" onClick={handleExport} className="hidden sm:flex items-center gap-2">
              <Download size={16} /> Export DOCX
           </Button>
           <div className="h-4 w-px bg-slate-300 mx-2"></div>
           <span className="text-xs text-slate-400 flex items-center">
             <Save size={14} className="mr-1" /> Auto-saving
           </span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-4 flex-1 overflow-y-auto">
             <div className="mb-6">
                 <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Manuscript Info</h2>
                 <button
                    onClick={() => setActiveTab(SectionView.METADATA)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                      activeTab === SectionView.METADATA
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-slate-600 hover:bg-slate-100'
                    }`}
                 >
                   <Info size={16} className="mr-2" /> Title & Authors
                 </button>
             </div>

             <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Sections</h2>
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
                            className={`flex-1 text-left px-3 py-2 rounded-md text-sm font-medium transition-colors truncate pr-16 ${
                            activeTab === SectionView.EDITOR && activeSectionId === section.id 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            {section.title}
                        </button>
                        <div className={`absolute right-1 flex items-center bg-slate-100/80 rounded backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity ${activeSectionId === section.id ? 'opacity-100 bg-blue-100' : ''}`}>
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
                        <button onClick={() => setIsAddingSection(false)} className="text-slate-400 hover:bg-slate-100 p-1 rounded"><X size={14} /></button>
                    </div>
               ) : (
                <button 
                    onClick={() => {
                        setIsAddingSection(true);
                        setNewSectionName('');
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:text-slate-600 flex items-center hover:bg-slate-50 rounded-md transition-colors mt-1"
                >
                    <Plus size={14} className="mr-2" /> Add Section
                </button>
               )}
             </nav>

             <div className="mt-8">
               <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tools</h2>
               <nav className="space-y-1">
                 <button
                    onClick={() => setActiveTab(SectionView.FIGURES)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                      activeTab === SectionView.FIGURES
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-slate-600 hover:bg-slate-100'
                    }`}
                 >
                   <Image size={16} className="mr-2" /> Figures
                 </button>
                 <button
                    onClick={() => setActiveTab('REFERENCES' as any)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                      (activeTab as any) === 'REFERENCES'
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-slate-600 hover:bg-slate-100'
                    }`}
                 >
                   <BookOpen size={16} className="mr-2" /> References
                 </button>
               </nav>
             </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
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
               onClose={() => setActiveTab(SectionView.EDITOR)}
               onRestore={(version) => {
                 handleUpdateSection({
                   ...activeSection,
                   content: version.content,
                   userNotes: version.notes,
                   lastModified: Date.now(),
                   versions: [
                     {...version, id: generateId(), timestamp: Date.now(), commitMessage: `Restored from ${new Date(version.timestamp).toLocaleDateString()}`},
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

          {(activeTab as any) === 'REFERENCES' && (
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
        </div>
      </div>
    </div>
  );
};

const ClockIcon = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

export default App;