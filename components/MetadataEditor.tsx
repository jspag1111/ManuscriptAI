
import React, { useState } from 'react';
import { Project, Author, Affiliation } from '../types';
import { generateId } from '../services/storageService';
import { Button } from './Button';
import { User, Users, Building, FileText, Check, Trash2, Plus, Star } from 'lucide-react';

interface MetadataEditorProps {
  project: Project;
  onUpdateProject: (p: Project) => void;
}

export const MetadataEditor: React.FC<MetadataEditorProps> = ({ project, onUpdateProject }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'journal'>('info');

  const updateMetadata = (updates: Partial<typeof project.manuscriptMetadata>) => {
    onUpdateProject({
      ...project,
      manuscriptMetadata: {
        ...project.manuscriptMetadata,
        ...updates
      }
    });
  };

  const updateSettings = (updates: Partial<typeof project.settings>) => {
      onUpdateProject({
          ...project,
          settings: {
              ...project.settings,
              ...updates
          }
      });
  };

  const addAffiliation = () => {
    const newAff: Affiliation = {
      id: generateId(),
      institution: '',
    };
    updateMetadata({ affiliations: [...project.manuscriptMetadata.affiliations, newAff] });
  };

  const updateAffiliation = (id: string, field: keyof Affiliation, value: string) => {
    const updated = project.manuscriptMetadata.affiliations.map(a => 
      a.id === id ? { ...a, [field]: value } : a
    );
    updateMetadata({ affiliations: updated });
  };

  const removeAffiliation = (id: string) => {
    updateMetadata({ 
      affiliations: project.manuscriptMetadata.affiliations.filter(a => a.id !== id),
      // Also remove this affiliation from authors
      authors: project.manuscriptMetadata.authors.map(au => ({
          ...au,
          affiliationIds: au.affiliationIds.filter(aid => aid !== id)
      }))
    });
  };

  const addAuthor = () => {
    const newAuthor: Author = {
      id: generateId(),
      firstName: '',
      lastName: '',
      isCorresponding: false,
      affiliationIds: []
    };
    updateMetadata({ authors: [...project.manuscriptMetadata.authors, newAuthor] });
  };

  const updateAuthor = (id: string, updates: Partial<Author>) => {
    const updated = project.manuscriptMetadata.authors.map(a => 
      a.id === id ? { ...a, ...updates } : a
    );
    updateMetadata({ authors: updated });
  };
  
  const removeAuthor = (id: string) => {
      updateMetadata({ authors: project.manuscriptMetadata.authors.filter(a => a.id !== id) });
  };

  const toggleAuthorAffiliation = (authorId: string, affId: string) => {
      const author = project.manuscriptMetadata.authors.find(a => a.id === authorId);
      if (!author) return;

      const hasAff = author.affiliationIds.includes(affId);
      const newAffs = hasAff 
        ? author.affiliationIds.filter(id => id !== affId)
        : [...author.affiliationIds, affId];
      
      updateAuthor(authorId, { affiliationIds: newAffs });
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="p-6 pb-0">
         <h3 className="text-lg font-semibold text-slate-800 flex items-center mb-4">
            <FileText size={20} className="mr-2" />
            Manuscript Configuration
         </h3>
         <div className="flex space-x-1 bg-white p-1 rounded-lg border border-slate-200 mb-6 max-w-md">
             <button 
                onClick={() => setActiveTab('info')}
                className={`flex-1 flex items-center justify-center py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'info' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
             >
                <Users size={16} className="mr-2" /> Authors & Affiliations
             </button>
             <button 
                onClick={() => setActiveTab('journal')}
                className={`flex-1 flex items-center justify-center py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'journal' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
             >
                <Building size={16} className="mr-2" /> Journal Requirements
             </button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {activeTab === 'info' && (
          <div className="space-y-8 max-w-4xl">
             
             {/* General Info */}
             <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <FileText size={18} className="text-blue-500" />
                    General Information
                </h4>
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Manuscript Title</label>
                        <input 
                            className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                            value={project.title}
                            onChange={(e) => onUpdateProject({ ...project, title: e.target.value })}
                        />
                    </div>
                </div>
             </div>

             {/* Affiliations */}
             <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Building size={18} className="text-blue-500" />
                        Affiliations
                    </h4>
                    <Button size="sm" variant="secondary" onClick={addAffiliation}>
                        <Plus size={14} className="mr-1" /> Add
                    </Button>
                </div>
                
                {project.manuscriptMetadata.affiliations.length === 0 && (
                    <p className="text-sm text-slate-400 italic mb-4">Add affiliations (universities, institutes) here first.</p>
                )}

                <div className="space-y-3">
                    {project.manuscriptMetadata.affiliations.map((aff, index) => (
                        <div key={aff.id} className="flex gap-2 items-start bg-slate-50 p-3 rounded border border-slate-100">
                             <span className="text-slate-400 font-mono text-xs pt-2.5 w-6 text-center">{index + 1}</span>
                             <div className="flex-1 grid grid-cols-2 gap-2">
                                <input 
                                    placeholder="Institution / University" 
                                    className="col-span-2 p-2 border rounded text-sm"
                                    value={aff.institution}
                                    onChange={(e) => updateAffiliation(aff.id, 'institution', e.target.value)}
                                />
                                <input 
                                    placeholder="Department" 
                                    className="p-2 border rounded text-sm"
                                    value={aff.department || ''}
                                    onChange={(e) => updateAffiliation(aff.id, 'department', e.target.value)}
                                />
                                <input 
                                    placeholder="City, Country" 
                                    className="p-2 border rounded text-sm"
                                    value={aff.city || ''}
                                    onChange={(e) => updateAffiliation(aff.id, 'city', e.target.value)}
                                />
                             </div>
                             <button onClick={() => removeAffiliation(aff.id)} className="text-slate-400 hover:text-red-500 p-2">
                                 <Trash2 size={16} />
                             </button>
                        </div>
                    ))}
                </div>
             </div>

             {/* Authors */}
             <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                        <User size={18} className="text-blue-500" />
                        Authors
                    </h4>
                    <Button size="sm" onClick={addAuthor}>
                        <Plus size={14} className="mr-1" /> Add Author
                    </Button>
                </div>

                <div className="space-y-4">
                    {project.manuscriptMetadata.authors.map((author, index) => (
                        <div key={author.id} className="bg-slate-50 p-4 rounded border border-slate-100">
                             <div className="flex gap-3 mb-3">
                                <div className="flex-1 grid grid-cols-2 gap-3">
                                    <input 
                                        placeholder="First Name" 
                                        className="p-2 border rounded text-sm"
                                        value={author.firstName}
                                        onChange={(e) => updateAuthor(author.id, { firstName: e.target.value })}
                                    />
                                    <input 
                                        placeholder="Last Name" 
                                        className="p-2 border rounded text-sm"
                                        value={author.lastName}
                                        onChange={(e) => updateAuthor(author.id, { lastName: e.target.value })}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => updateAuthor(author.id, { isCorresponding: !author.isCorresponding })}
                                        className={`p-2 rounded border text-xs font-medium flex items-center gap-1 transition-colors ${author.isCorresponding ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                                        title="Toggle Corresponding Author"
                                    >
                                        <Star size={14} fill={author.isCorresponding ? "currentColor" : "none"} />
                                        Corr.
                                    </button>
                                    <button onClick={() => removeAuthor(author.id)} className="text-slate-400 hover:text-red-500 p-2">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                             </div>
                             
                             {author.isCorresponding && (
                                 <div className="mb-3">
                                     <input 
                                        placeholder="Email Address (Required for Corresponding Author)" 
                                        className="w-full p-2 border rounded text-sm bg-yellow-50/50"
                                        value={author.email || ''}
                                        onChange={(e) => updateAuthor(author.id, { email: e.target.value })}
                                    />
                                 </div>
                             )}

                             <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Affiliations</label>
                                <div className="flex flex-wrap gap-2">
                                    {project.manuscriptMetadata.affiliations.map((aff, i) => (
                                        <button 
                                            key={aff.id}
                                            onClick={() => toggleAuthorAffiliation(author.id, aff.id)}
                                            className={`text-xs px-2 py-1 rounded border transition-colors ${
                                                author.affiliationIds.includes(aff.id)
                                                ? 'bg-blue-100 border-blue-200 text-blue-700'
                                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                                            }`}
                                        >
                                            {i + 1}. {aff.institution || 'Untitled'}
                                        </button>
                                    ))}
                                    {project.manuscriptMetadata.affiliations.length === 0 && (
                                        <span className="text-xs text-slate-400 italic">No affiliations available. Add them above.</span>
                                    )}
                                </div>
                             </div>
                        </div>
                    ))}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'journal' && (
            <div className="space-y-6 max-w-3xl">
                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                    <h4 className="font-semibold text-slate-800 mb-4">Target Journal Settings</h4>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Target Journal Name</label>
                            <input 
                                className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. Nature, Science, PLOS One"
                                value={project.settings.targetJournal}
                                onChange={(e) => updateSettings({ targetJournal: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Word Count Target</label>
                            <input 
                                type="number"
                                className="w-full max-w-xs p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                value={project.settings.wordCountTarget}
                                onChange={(e) => updateSettings({ wordCountTarget: parseInt(e.target.value) || 0 })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Specific Formatting Requirements</label>
                            <p className="text-xs text-slate-500 mb-2">Paste specific guidelines here (e.g., &quot;Abstract max 250 words&quot;, &quot;Harvard citation style&quot;). The AI will use this when drafting sections.</p>
                            <textarea 
                                className="w-full p-3 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 h-32"
                                value={project.settings.formattingRequirements}
                                onChange={(e) => updateSettings({ formattingRequirements: e.target.value })}
                                placeholder="- Abstract must be unstructured&#10;- Figures must be cited in text as Fig. X&#10;- Use active voice"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tone & Style</label>
                            <select 
                                className="w-full max-w-xs p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                value={project.settings.tone}
                                onChange={(e) => updateSettings({ tone: e.target.value })}
                            >
                                <option value="Academic and formal">Academic and formal (Default)</option>
                                <option value="Concise and technical">Concise and technical</option>
                                <option value="Accessible and narrative">Accessible and narrative</option>
                                <option value="Persuasive and bold">Persuasive and bold</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
