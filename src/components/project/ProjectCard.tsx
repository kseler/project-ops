import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

import type { Project } from '@/types';

const statusBadge: Record<Project['status'], string> = {
  active: 'bg-emerald-100 text-emerald-700',
  'on-hold': 'bg-amber-100 text-amber-700',
  completed: 'bg-slate-100 text-slate-600',
};

interface Props {
  project: Project;
}

export function ProjectCard({ project }: Props) {
  const progress =
    project.taskCount > 0
      ? Math.round((project.completedCount / project.taskCount) * 100)
      : 0;

  const due = new Date(project.dueDate);
  const isOverdue = due < new Date() && project.status !== 'completed';

  return (
    <Link
      to={`/projects/${project.id}`}
      className="block bg-white border border-slate-200 rounded-lg p-5 hover:border-indigo-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-slate-900 leading-snug">{project.name}</h3>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge[project.status]}`}
        >
          {project.status}
        </span>
      </div>

      {project.description && (
        <p className="text-xs text-slate-500 mb-3 line-clamp-2">{project.description}</p>
      )}

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400">Progress</span>
          <span className="text-xs font-medium text-slate-600">{progress}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{project.taskCount} task{project.taskCount !== 1 ? 's' : ''}</span>
        <span className={isOverdue ? 'text-red-500' : 'text-slate-400'}>
          Due {formatDistanceToNow(due, { addSuffix: true })}
          {isOverdue && ' · Overdue'}
        </span>
      </div>
    </Link>
  );
}
