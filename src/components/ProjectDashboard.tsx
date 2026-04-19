'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/Button';
import { Project } from '@/types';
import { ChevronRight, Clock3, FileText, Sparkles, Trash2 } from 'lucide-react';

type WorkspaceKind = 'manuscript' | 'writing';

interface DashboardStat {
  label: string;
  value: string;
}

interface ProjectDashboardProps {
  workspace: WorkspaceKind;
  badge: string;
  title: string;
  description: string;
  createLabel: string;
  projects: Project[];
  isLoading: boolean;
  projectError: string | null;
  emptyTitle: string;
  emptyDescription: string;
  stats: DashboardStat[];
  getProjectDescription: (project: Project) => string;
  getProjectMetricLabel: (project: Project) => string;
  onCreate: () => void;
  onOpen: (project: Project) => void;
  onDelete: (event: React.MouseEvent<HTMLButtonElement>, id: string) => void;
}

const workspaceTabs = [
  { href: '/', label: 'Manuscripts', match: (pathname: string) => pathname === '/' },
  { href: '/writing', label: 'General Writing', match: (pathname: string) => pathname.startsWith('/writing') },
] as const;

const workspaceTheme = {
  manuscript: {
    background:
      'radial-gradient(circle at 14% 18%, rgba(59,130,246,0.20), transparent 24%),' +
      'radial-gradient(circle at 84% 12%, rgba(16,185,129,0.12), transparent 22%),' +
      'radial-gradient(circle at 52% 82%, rgba(56,189,248,0.14), transparent 28%)',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-100',
    accentClass: 'from-blue-600 via-sky-500 to-cyan-400',
    iconWrapClass: 'from-blue-500/15 to-sky-500/10 text-blue-700 border-blue-100',
    activeTabClass: 'bg-slate-900 text-white shadow-lg shadow-slate-900/10',
    inactiveTabClass: 'text-slate-600 hover:text-slate-900 hover:bg-white/90',
    listTitle: 'Recent manuscripts',
    emptyToneClass: 'from-blue-50 to-sky-50',
  },
  writing: {
    background:
      'radial-gradient(circle at 12% 20%, rgba(14,165,233,0.18), transparent 24%),' +
      'radial-gradient(circle at 82% 10%, rgba(16,185,129,0.14), transparent 22%),' +
      'radial-gradient(circle at 48% 82%, rgba(99,102,241,0.12), transparent 28%)',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    accentClass: 'from-emerald-500 via-sky-500 to-cyan-400',
    iconWrapClass: 'from-emerald-500/15 to-sky-500/10 text-emerald-700 border-emerald-100',
    activeTabClass: 'bg-slate-900 text-white shadow-lg shadow-slate-900/10',
    inactiveTabClass: 'text-slate-600 hover:text-slate-900 hover:bg-white/90',
    listTitle: 'Recent writing projects',
    emptyToneClass: 'from-emerald-50 to-sky-50',
  },
} as const;

const WorkspaceTabs = ({ workspace }: { workspace: WorkspaceKind }) => {
  const pathname = usePathname();
  const theme = workspaceTheme[workspace];

  return (
    <div className="inline-flex w-full max-w-full rounded-2xl border border-white/80 bg-white/70 p-1 shadow-sm backdrop-blur md:w-auto">
      {workspaceTabs.map((tab) => {
        const isActive = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 rounded-xl px-4 py-2 text-center text-sm font-semibold transition-all md:flex-none ${
              isActive ? theme.activeTabClass : theme.inactiveTabClass
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
};

const formatProjectCount = (count: number) => `${count} ${count === 1 ? 'project' : 'projects'}`;

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
  workspace,
  badge,
  title,
  description,
  createLabel,
  projects,
  isLoading,
  projectError,
  emptyTitle,
  emptyDescription,
  stats,
  getProjectDescription,
  getProjectMetricLabel,
  onCreate,
  onOpen,
  onDelete,
}) => {
  const theme = workspaceTheme[workspace];
  const ProjectIcon = workspace === 'manuscript' ? FileText : Sparkles;

  return (
    <div className="min-h-[calc(100vh-4rem)] relative overflow-hidden">
      <div className="absolute inset-0 opacity-80" style={{ backgroundImage: theme.background }} />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/65 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl">
          <div className={`h-1.5 bg-gradient-to-r ${theme.accentClass}`} />
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${theme.badgeClass}`}>
                      {badge}
                    </p>
                    <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                      {title}
                    </h1>
                  </div>
                  <p className="max-w-3xl text-sm leading-6 text-slate-600">
                    {description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <WorkspaceTabs workspace={workspace} />
                  <Button onClick={onCreate} size="md" className="rounded-xl px-5 shadow-lg shadow-slate-900/10">
                    {createLabel}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-3 py-2 text-sm shadow-sm"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {stat.label}
                    </span>
                    <span className="font-semibold text-slate-900">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {projectError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {projectError}
          </div>
        )}

        <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/65 shadow-[0_20px_70px_-45px_rgba(15,23,42,0.4)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 border-b border-slate-200/80 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Project index</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{theme.listTitle}</h2>
            </div>
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-sm font-medium text-slate-600 shadow-sm">
              {formatProjectCount(projects.length)}
            </div>
          </div>

          <div className="p-3 sm:p-4">
            {isLoading && (
              <div className="rounded-[1.75rem] border-2 border-dashed border-slate-200 bg-white/70 px-6 py-16 text-center text-slate-500">
                Loading projects from local database...
              </div>
            )}

            {!isLoading && projects.length === 0 && (
              <div
                className={`rounded-[1.75rem] border border-slate-200 bg-gradient-to-br ${theme.emptyToneClass} px-6 py-16 text-center shadow-inner`}
              >
                <p className="text-lg font-semibold text-slate-800">{emptyTitle}</p>
                <p className="mt-2 text-sm text-slate-600">{emptyDescription}</p>
              </div>
            )}

            {!isLoading && projects.length > 0 && (
              <div className="space-y-3">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpen(project)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onOpen(project);
                      }
                    }}
                    className="group relative overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/85 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
                  >
                    <div className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${theme.accentClass}`} />
                    <div className="flex flex-col gap-4 px-5 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className={`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border bg-gradient-to-br ${theme.iconWrapClass}`}>
                          <ProjectIcon size={20} />
                        </div>
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-lg font-semibold text-slate-900">{project.title}</h3>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {badge}
                            </span>
                          </div>
                          <p className="max-w-2xl text-sm leading-6 text-slate-600">
                            {getProjectDescription(project)}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium">
                              <Clock3 size={13} />
                              Edited {new Date(project.lastModified).toLocaleDateString()}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 font-medium">
                              {getProjectMetricLabel(project)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 md:justify-end">
                        <button
                          onClick={(event) => onDelete(event, project.id)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                          aria-label={`Delete ${project.title}`}
                        >
                          <Trash2 size={16} />
                        </button>
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm">
                          Open
                          <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
