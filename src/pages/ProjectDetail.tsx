import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, CalendarDays, GanttChart, LayoutList, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';

import { ProjectGanttView } from '@/components/project/ProjectGanttView';
import { ProjectListView } from '@/components/project/ProjectListView';
import { useProjectRealtime } from '@/hooks/useProjectRealtime';
import { hasErrors, validateProject } from '@/lib/validation';
import { useProject, useUpdateProject } from '@/queries/projects';
import { addToast } from '@/services/toast';
import type { Project } from '@/types';

type View = 'list' | 'gantt';

const statusBadge: Record<Project['status'], string> = {
  active: 'bg-emerald-100 text-emerald-700',
  'on-hold': 'bg-amber-100 text-amber-700',
  completed: 'bg-slate-100 text-slate-600',
};

const views: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: 'list', label: 'List', icon: <LayoutList size={13} /> },
  { id: 'gantt', label: 'Gantt', icon: <GanttChart size={13} /> },
];

export function ProjectDetail() {
  const { id: projectId } = useParams<{ id: string }>();
  const [view, setView] = useState<View>('list');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', dueDate: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: project, isLoading, error } = useProject(projectId);
  const updateProjectMutation = useUpdateProject(projectId!);

  useProjectRealtime(projectId);

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name,
        description: project.description ?? '',
        dueDate: project.dueDate
      });
    }
  }, [project]);

  function openEdit() {
    if (project) {
      setForm({
        name: project.name,
        description: project.description ?? '',
        dueDate: project.dueDate
      });
    }
    setErrors({});
    setEditing(true);
  }

  function handleSave() {
    const errs = validateProject({ name: form.name, dueDate: form.dueDate });

    if (hasErrors(errs)) {
      setErrors(errs);
      return;
    }

    updateProjectMutation.mutate(
      {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        dueDate: form.dueDate
      },
      {
        onSuccess: () => {
          setEditing(false);
          addToast('Project updated');
        },
        onError: () => addToast('Failed to update project', 'error'),
      },
    );
  }

  if (isLoading) return <div className="p-8 text-sm text-slate-400">Loading…</div>;
  if (error) return <div className="p-8 text-sm text-red-400">{error.message}</div>;
  if (!project) return null;

  const due = new Date(project.dueDate);
  const isOverdue = due < new Date() && project.status !== 'completed';

  return (
    <div className={view === 'gantt' ? 'h-full flex flex-col' : 'px-8 py-8'}>
      <div className={view === 'gantt' ? 'px-8 pt-8 shrink-0' : ''}>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 mb-6 transition-colors"
        >
          <ArrowLeft size={14} /> Projects
        </Link>

        {/* Display */}
        <div
          className={`transition-all duration-200 ease-out overflow-hidden ${
            editing ? 'opacity-0 max-h-0' : 'opacity-100 max-h-40'
          }`}
        >
          <div className="flex items-start justify-between mb-1">
            <h1 className="text-xl font-bold text-slate-900 leading-tight">{project.name}</h1>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge[project.status]}`}>
                {project.status}
              </span>
              <button
                onClick={openEdit}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                title="Edit project"
              >
                <Pencil size={13} />
              </button>
            </div>
          </div>
          {project.description && (
            <p className="text-sm text-slate-500 mb-2">{project.description}</p>
          )}
          <div className={`flex items-center gap-1.5 text-xs mb-5 ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
            <CalendarDays size={12} />
            <span>Due {formatDistanceToNow(due, { addSuffix: true })}{isOverdue && ' · Overdue'}</span>
          </div>
        </div>

        {/* Edit form */}
        <div
          className={`transition-all duration-200 ease-out overflow-hidden ${
            editing ? 'opacity-100 max-h-96' : 'opacity-0 max-h-0'
          }`}
        >
          <div className="space-y-3 mb-5">
            <div>
              <input
                className={`w-full text-xl font-bold bg-transparent border-b pb-0.5 outline-none transition-colors ${
                  errors.name
                    ? 'border-red-400 text-red-600'
                    : 'border-slate-300 focus:border-indigo-500 text-slate-900'
                }`}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Project name"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
            <textarea
              className="w-full text-sm text-slate-600 bg-transparent border border-slate-200 rounded-md px-2 py-1.5 outline-none focus:border-indigo-400 resize-none"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)"
            />
            <div>
              <input
                type="date"
                className={`text-sm border rounded-md px-2 py-1 outline-none transition-colors ${
                  errors.dueDate
                    ? 'border-red-400 text-red-600'
                    : 'border-slate-200 focus:border-indigo-400 text-slate-700'
                }`}
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
              {errors.dueDate && <p className="text-xs text-red-500 mt-1">{errors.dueDate}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={updateProjectMutation.isPending}
                className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {updateProjectMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 mb-6 border-b border-slate-100">
          {views.map(({ id: vid, label, icon }) => (
            <button
              key={vid}
              onClick={() => setView(vid)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                view === vid
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'list' && <ProjectListView projectId={projectId!} />}
      {view === 'gantt' && (
        <div className="flex-1 min-h-0 px-8 pb-8">
          <ProjectGanttView projectId={projectId!} />
        </div>
      )}

      <Outlet />
    </div>
  );
}
