'use client';

import React, { useCallback } from 'react';
import { ArrowUpRight, ChevronDown, FileText } from 'lucide-react';
import { Button } from '@/components/Button';
import { SectionEditor } from '@/components/SectionEditor';
import { SectionView, type Project, type Section } from '@/types';

interface FullManuscriptViewProps {
  project: Project;
  onUpdateSection: (section: Section) => void;
  onOpenSection: (sectionId: string, view?: SectionView) => void;
}

export const FullManuscriptView: React.FC<FullManuscriptViewProps> = ({
  project,
  onUpdateSection,
  onOpenSection,
}) => {
  const handleJumpToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(`full-manuscript-section-${sectionId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div className="h-full flex flex-col bg-white/90 border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-white/70 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
            <FileText size={18} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Full manuscript</p>
            <h2 className="text-base sm:text-lg font-semibold text-slate-900">
              Review and edit every section in one place
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              aria-label="Jump to section"
              className="appearance-none pr-9 pl-3 py-2 text-sm rounded-xl bg-white border border-slate-200 text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue=""
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                handleJumpToSection(id);
              }}
            >
              <option value="" disabled>
                Jump to section…
              </option>
              {project.sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Back to top
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8">
        {project.sections.map((section) => (
          <section
            key={section.id}
            id={`full-manuscript-section-${section.id}`}
            className="space-y-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-slate-900 truncate" title={section.title}>
                  {section.title}
                </h3>
                <p className="text-xs text-slate-500">
                  Comments, AI edits, and tracked changes stay synced to this section.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onOpenSection(section.id)}
                className="inline-flex items-center gap-2"
              >
                Open section <ArrowUpRight size={16} />
              </Button>
            </div>

            <div className="h-[78vh] min-h-[560px]">
              <SectionEditor
                section={section}
                project={project}
                onUpdateSection={onUpdateSection}
                onViewHistory={() => onOpenSection(section.id, SectionView.VERSIONS)}
                defaultShowDetails={false}
              />
            </div>
          </section>
        ))}

        {project.sections.length === 0 && (
          <div className="p-10 text-center rounded-2xl bg-slate-50 border border-slate-200 text-slate-600">
            No sections yet. Add sections in the sidebar to build your manuscript.
          </div>
        )}
      </div>
    </div>
  );
};
