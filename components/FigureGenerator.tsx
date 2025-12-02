import React, { useState } from 'react';
import { generateFigure } from '../services/geminiService';
import { generateId } from '../services/storageService';
import { FigureType, GeneratedFigure, Project } from '../types';
import { Button } from './Button';
import { Image, Download, Trash2, Upload } from 'lucide-react';

interface FigureGeneratorProps {
  project: Project;
  onUpdateProject: (p: Project) => void;
}

const figureTypeLabel = (type: FigureType) => {
  switch (type) {
    case 'table':
      return 'Table';
    case 'supplemental':
      return 'Supplemental';
    default:
      return 'Figure';
  }
};

const defaultLabelForType = (type: FigureType, index: number) => `${figureTypeLabel(type)} ${index}`;

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

export const FigureGenerator: React.FC<FigureGeneratorProps> = ({ project, onUpdateProject }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [manualFigureType, setManualFigureType] = useState<FigureType>('figure');
  const [manualLabel, setManualLabel] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualInclude, setManualInclude] = useState(false);
  const [manualImage, setManualImage] = useState<string | null>(null);
  const [manualImageName, setManualImageName] = useState('');
  const [isSavingManual, setIsSavingManual] = useState(false);

  const nextIndex = project.figures.length + 1;
  const manualPlaceholderLabel = defaultLabelForType(manualFigureType, nextIndex);

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
        title: '',
        label: defaultLabelForType('figure', nextIndex),
        description: '',
        includeInWordCount: false,
        figureType: 'figure',
        sourceType: 'AI',
      };
      onUpdateProject({
        ...project,
        figures: [newFigure, ...project.figures],
      });
      setPrompt('');
    } catch (error) {
      console.error(error);
      alert('Failed to generate figure. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = (id: string) => {
    onUpdateProject({
      ...project,
      figures: project.figures.filter((f) => f.id !== id),
    });
  };

  const updateFigure = (id: string, updates: Partial<GeneratedFigure>) => {
    onUpdateProject({
      ...project,
      figures: project.figures.map((fig) => (fig.id === id ? { ...fig, ...updates } : fig)),
    });
  };

  const handleManualFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setManualImage(null);
      setManualImageName('');
      return;
    }
    try {
      const encoded = await fileToBase64(file);
      setManualImage(encoded);
      setManualImageName(file.name);
    } catch (error) {
      console.error(error);
      alert('Unable to read the uploaded file. Please try a different image.');
    }
  };

  const resetManualForm = () => {
    setManualFigureType('figure');
    setManualLabel('');
    setManualTitle('');
    setManualDescription('');
    setManualInclude(false);
    setManualImage(null);
    setManualImageName('');
  };

  const handleAddManualFigure = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualImage && !manualDescription.trim() && !manualTitle.trim()) {
      alert('Add at least a title, description, or image for the figure/table.');
      return;
    }
    setIsSavingManual(true);
    try {
      const newFigure: GeneratedFigure = {
        id: generateId(),
        createdAt: Date.now(),
        prompt: '',
        base64: manualImage || undefined,
        title: manualTitle.trim(),
        label: manualLabel.trim() || manualPlaceholderLabel,
        description: manualDescription.trim(),
        includeInWordCount: manualInclude,
        figureType: manualFigureType,
        sourceType: 'UPLOAD',
      };

      onUpdateProject({
        ...project,
        figures: [newFigure, ...project.figures],
      });
      resetManualForm();
    } catch (error) {
      console.error(error);
      alert('Failed to add figure or table. Please try again.');
    } finally {
      setIsSavingManual(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-50 border border-slate-200 p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
            <Image size={20} />
            AI Figure Generator
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            Describe a chart, diagram, or illustration and we will draft an image to refine.
          </p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. A Kaplan-Meier survival curve with treatment vs placebo arms…"
            className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px] text-sm"
          />
          <div className="mt-4 flex justify-end">
            <Button onClick={handleGenerate} isLoading={isGenerating} disabled={!prompt.trim()}>
              Generate Figure
            </Button>
          </div>
        </div>

        <form
          onSubmit={handleAddManualFigure}
          className="bg-white border border-slate-200 p-6 rounded-lg shadow-sm space-y-4"
        >
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <Upload size={20} />
              Add Existing Figure/Table
            </h3>
            <p className="text-sm text-slate-500">
              Upload an existing asset or capture table metadata so it is included during export.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-sm text-slate-700 flex flex-col gap-1">
              Type
              <select
                className="border border-slate-300 rounded-md p-2 text-sm"
                value={manualFigureType}
                onChange={(e) => setManualFigureType(e.target.value as FigureType)}
              >
                <option value="figure">Figure</option>
                <option value="table">Table</option>
                <option value="supplemental">Supplemental</option>
              </select>
            </label>
            <label className="text-sm text-slate-700 flex flex-col gap-1">
              Label
              <input
                type="text"
                placeholder={manualPlaceholderLabel}
                value={manualLabel}
                onChange={(e) => setManualLabel(e.target.value)}
                className="border border-slate-300 rounded-md p-2 text-sm"
              />
            </label>
          </div>

          <label className="text-sm text-slate-700 flex flex-col gap-1">
            Title
            <input
              type="text"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              className="border border-slate-300 rounded-md p-2 text-sm"
              placeholder="e.g. CONSORT flow diagram"
            />
          </label>

          <label className="text-sm text-slate-700 flex flex-col gap-1">
            Description / Caption
            <textarea
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              className="border border-slate-300 rounded-md p-2 text-sm min-h-[100px]"
              placeholder="Describe the key takeaway or any notes required for submission."
            />
          </label>

          <label className="text-sm text-slate-700 flex flex-col gap-1">
            Attach Image (optional)
            <input type="file" accept="image/*" className="text-sm" onChange={handleManualFileChange} />
          </label>

          {manualImage && (
            <div className="border border-dashed border-slate-300 rounded-md p-3 flex items-center justify-between text-xs text-slate-600">
              <span>{manualImageName || 'Attached image'}</span>
              <button
                type="button"
                className="text-blue-600 hover:underline"
                onClick={() => {
                  setManualImage(null);
                  setManualImageName('');
                }}
              >
                Remove
              </button>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={manualInclude}
              onChange={(e) => setManualInclude(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Count this caption text toward the project word count
          </label>

          <div className="flex justify-end">
            <Button
              type="submit"
              isLoading={isSavingManual}
              disabled={isSavingManual || (!manualImage && !manualDescription.trim() && !manualTitle.trim())}
            >
              Add Figure/Table
            </Button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Project Figures & Tables</h3>
          <span className="text-sm text-slate-500">{project.figures.length} total</span>
        </div>

        {project.figures.length === 0 && (
          <div className="border border-dashed border-slate-200 rounded-lg p-8 text-center text-slate-400">
            No figures or tables yet. Generate one or upload an existing asset.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {project.figures.map((fig, index) => {
            const fallbackLabel = defaultLabelForType(fig.figureType, index + 1);
            return (
              <div key={fig.id} className="border border-slate-200 rounded-lg bg-white shadow-sm flex flex-col">
                <div className="border-b border-slate-100 px-4 py-2 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{fig.label || fallbackLabel}</span>
                  <span className="uppercase tracking-wide">{figureTypeLabel(fig.figureType)}</span>
                </div>

                {fig.base64 ? (
                  <div className="bg-slate-50 flex items-center justify-center p-4">
                    <img
                      src={fig.base64}
                      alt={fig.title || fig.prompt || fig.label || 'Figure preview'}
                      className="max-h-48 object-contain"
                    />
                  </div>
                ) : (
                  <div className="bg-slate-50 flex items-center justify-center p-6 text-xs text-slate-400">
                    No image attached
                  </div>
                )}

                <div className="p-4 space-y-3 flex-1">
                  <label className="text-xs text-slate-500 flex flex-col gap-1">
                    Label
                    <input
                      type="text"
                      value={fig.label}
                      onChange={(e) => updateFigure(fig.id, { label: e.target.value })}
                      className="border border-slate-300 rounded-md p-2 text-sm"
                    />
                  </label>
                  <label className="text-xs text-slate-500 flex flex-col gap-1">
                    Title
                    <input
                      type="text"
                      value={fig.title}
                      onChange={(e) => updateFigure(fig.id, { title: e.target.value })}
                      className="border border-slate-300 rounded-md p-2 text-sm"
                    />
                  </label>
                  <label className="text-xs text-slate-500 flex flex-col gap-1">
                    Description / Caption
                    <textarea
                      value={fig.description}
                      onChange={(e) => updateFigure(fig.id, { description: e.target.value })}
                      className="border border-slate-300 rounded-md p-2 text-sm min-h-[80px]"
                    />
                  </label>
                  <label className="text-xs text-slate-500 flex flex-col gap-1">
                    Type
                    <select
                      value={fig.figureType}
                      onChange={(e) => updateFigure(fig.id, { figureType: e.target.value as FigureType })}
                      className="border border-slate-300 rounded-md p-2 text-sm"
                    >
                      <option value="figure">Figure</option>
                      <option value="table">Table</option>
                      <option value="supplemental">Supplemental</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={fig.includeInWordCount}
                      onChange={(e) => updateFigure(fig.id, { includeInWordCount: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Include caption text in project word count
                  </label>
                </div>

                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
                  <span>{fig.sourceType === 'AI' ? 'AI generated' : 'Uploaded'}</span>
                  <div className="flex items-center gap-2">
                    {fig.base64 && (
                      <a
                        href={fig.base64}
                        download={`${(fig.label || 'figure').replace(/\s+/g, '-').toLowerCase()}.png`}
                        className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-slate-100"
                        title="Download"
                      >
                        <Download size={16} />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(fig.id)}
                      className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-slate-100"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
