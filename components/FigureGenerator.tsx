import React, { useRef, useState } from 'react';
import { generateId } from '../services/storageService';
import { FigureType, GeneratedFigure, Project } from '../types';
import { Button } from './Button';
import { Download, Trash2, Upload, Image as ImageIcon, X } from 'lucide-react';

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
  const [manualFigureType, setManualFigureType] = useState<FigureType>('figure');
  const [manualLabel, setManualLabel] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualInclude, setManualInclude] = useState(false);
  const [manualImage, setManualImage] = useState<string | null>(null);
  const [manualImageName, setManualImageName] = useState('');
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [previewFigure, setPreviewFigure] = useState<GeneratedFigure | null>(null);

  const nextIndex = project.figures.length + 1;
  const manualPlaceholderLabel = defaultLabelForType(manualFigureType, nextIndex);

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

  const replaceInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleReplaceImage = async (figureId: string, file?: File) => {
    if (!file) return;
    try {
      const encoded = await fileToBase64(file);
      updateFigure(figureId, {
        base64: encoded,
        sourceType: 'UPLOAD',
        createdAt: Date.now(),
      });
    } catch (error) {
      console.error(error);
      alert('Failed to update the attachment. Please try again.');
    } finally {
      if (replaceInputs.current[figureId]) {
        replaceInputs.current[figureId]!.value = '';
      }
    }
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto">
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
            Upload the asset and complete its caption so it is ready for export.
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

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <ImageIcon size={18} /> Project Figures & Tables
          </h3>
          <span className="text-sm text-slate-500">{project.figures.length} total</span>
        </div>

        {project.figures.length === 0 && (
          <div className="border border-dashed border-slate-200 rounded-lg p-8 text-center text-slate-400">
            No figures or tables yet. Upload one to get started.
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
                  <div className="bg-slate-50 flex flex-col items-center justify-center p-4 gap-2">
                    <img
                      src={fig.base64}
                      alt={fig.title || fig.prompt || fig.label || 'Figure preview'}
                      className="max-h-48 object-contain cursor-zoom-in"
                      onClick={() => setPreviewFigure(fig)}
                    />
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button
                        type="button"
                        className="px-2 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
                        onClick={() => setPreviewFigure(fig)}
                      >
                        View Full Size
                      </button>
                      <label className="px-2 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer">
                        Replace Image
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          ref={(el) => {
                            replaceInputs.current[fig.id] = el;
                          }}
                          onChange={(e) => handleReplaceImage(fig.id, e.target.files?.[0])}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="bg-slate-50 flex flex-col items-center justify-center p-6 text-xs text-slate-400 gap-2 cursor-pointer">
                    No image attached
                    <input
                      type="file"
                      accept="image/*"
                      className="text-sm"
                      onChange={(e) => handleReplaceImage(fig.id, e.target.files?.[0])}
                    />
                  </label>
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

      {previewFigure?.base64 && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto relative">
            <button
              className="absolute top-3 right-3 text-slate-500 hover:text-slate-800"
              onClick={() => setPreviewFigure(null)}
            >
              <X size={20} />
            </button>
            <div className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700">{previewFigure.label}</p>
                  {previewFigure.title && <p className="text-xs text-slate-500">{previewFigure.title}</p>}
                </div>
                <span className="text-xs uppercase tracking-wide text-slate-400">{figureTypeLabel(previewFigure.figureType)}</span>
              </div>
              <div className="bg-slate-50 rounded-md p-4 flex justify-center">
                <img src={previewFigure.base64} alt={previewFigure.label} className="max-h-[70vh] object-contain" />
              </div>
              {previewFigure.description && (
                <p className="text-xs text-slate-500">
                  <strong>Caption:</strong> {previewFigure.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
