import React, { useState } from 'react';
import { generateFigure } from '../services/geminiService';
import { generateId } from '../services/storageService';
import { GeneratedFigure, Project } from '../types';
import { Button } from './Button';
import { Image, Download, Trash2 } from 'lucide-react';

interface FigureGeneratorProps {
  project: Project;
  onUpdateProject: (p: Project) => void;
}

export const FigureGenerator: React.FC<FigureGeneratorProps> = ({ project, onUpdateProject }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      const base64 = await generateFigure(prompt);
      const newFigure: GeneratedFigure = {
        id: generateId(),
        prompt,
        base64,
        createdAt: Date.now(),
      };
      onUpdateProject({
        ...project,
        figures: [newFigure, ...project.figures]
      });
      setPrompt('');
    } catch (e) {
      alert("Failed to generate figure. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = (id: string) => {
    onUpdateProject({
      ...project,
      figures: project.figures.filter(f => f.id !== id)
    });
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto">
      <div className="bg-slate-50 border border-slate-200 p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
          <Image size={20} />
          AI Figure Generator
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Describe a chart, diagram, or scientific illustration you need. Powered by Gemini Nano.
        </p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. A bar chart comparing control vs treatment groups with error bars, blue and red theme..."
          className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] text-sm"
        />
        <div className="mt-4 flex justify-end">
          <Button onClick={handleGenerate} isLoading={isGenerating} disabled={!prompt.trim()}>
            Generate Figure
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {project.figures.map(fig => (
          <div key={fig.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="aspect-square w-full bg-slate-100 relative group">
              <img src={fig.base64} alt={fig.prompt} className="w-full h-full object-contain" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <a href={fig.base64} download={`figure-${fig.id}.png`} className="p-2 bg-white rounded-full text-slate-700 hover:text-blue-600">
                  <Download size={20} />
                </a>
                <button onClick={() => handleDelete(fig.id)} className="p-2 bg-white rounded-full text-slate-700 hover:text-red-600">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
            <div className="p-3">
              <p className="text-xs text-slate-500 truncate" title={fig.prompt}>{fig.prompt}</p>
              <p className="text-xs text-slate-400 mt-1">{new Date(fig.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
      </div>
      
      {project.figures.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          No figures generated yet.
        </div>
      )}
    </div>
  );
};