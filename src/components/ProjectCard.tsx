import { Link } from 'react-router-dom';

import type { Project } from '../lib/types';

const statusStyles: Record<Project['status'], string> = {
  active: 'bg-emerald-100 text-emerald-700',
  'on-hold': 'bg-amber-100 text-amber-700',
  completed: 'bg-slate-100 text-slate-600',
};

const statusLabels: Record<Project['status'], string> = {
  active: 'Active',
  'on-hold': 'On hold',
  completed: 'Completed',
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
      className="block bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md hover:border-slate-300 transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
          {project.name}
        </h3>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${statusStyles[project.status]}`}
        >
          {statusLabels[project.status]}
        </span>
      </div>

      <p className="text-sm text-slate-500 mb-4 line-clamp-2">{project.description}</p>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>
            {project.completedCount} / {project.taskCount} tasks
          </span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <p className={`text-xs ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
        Due{' '}
        {due.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
        {isOverdue && ' · Overdue'}
      </p>
    </Link>
  );
}
