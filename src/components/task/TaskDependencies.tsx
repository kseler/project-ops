import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import {
  addDependencyToCache,
  removeDependencyFromCache,
  replaceDependencyInCache,
  useCreateTaskDependency,
  useDeleteTaskDependency,
  useReverseTaskDependency,
  useTaskDependencies,
} from '@/queries/taskDependencies';
import { useTaskLists } from '@/queries/taskLists';
import { useTasksByProject } from '@/queries/tasks';
import { addToast } from '@/services/toast';
import type { Task, TaskDependency } from '@/types';

import { type DependencyDirection, DependencyTypeMenu } from './DependencyTypeMenu';
import { type TaskOption, TaskPicker } from './TaskPicker';

const PICKER_PLACEHOLDER: Record<DependencyDirection, string> = {
  blocking: 'Link a dependent task',
  waiting: 'Link a blocking task',
};

interface Props {
  task: Task;
  projectId: string;
}

export function TaskDependencies({ task, projectId }: Props) {
  const queryClient = useQueryClient();
  const { data: dependencies = [] } = useTaskDependencies(task.id);
  const { data: projectTasks = [] } = useTasksByProject(projectId);
  const { data: taskLists = [] } = useTaskLists(projectId);

  const createDependencyMutation = useCreateTaskDependency();
  const reverseDependencyMutation = useReverseTaskDependency();
  const deleteDependencyMutation = useDeleteTaskDependency();

  const [expanded, setExpanded] = useState(true);
  const [newDirection, setNewDirection] = useState<DependencyDirection>('blocking');
  const [error, setError] = useState('');

  const tasksById = new Map(projectTasks.map((t) => [t.id, t]));
  const listNames = new Map(taskLists.map((list) => [list.id, list.name]));

  // a dependency is stored one way (taskId blocks dependentTaskId); show it from this task's side
  const rows = dependencies.map((dependency) => {
    const isBlocking = dependency.taskId === task.id;
    return {
      dependency,
      direction: (isBlocking ? 'blocking' : 'waiting') as DependencyDirection,
      otherTask: tasksById.get(isBlocking ? dependency.dependentTaskId : dependency.taskId),
    };
  });

  const doneCount = rows.filter((row) => row.otherTask?.status === 'done').length;
  const linkedTaskIds = new Set(rows.map((row) => row.otherTask?.id));
  const pickerOptions: TaskOption[] = projectTasks
    .filter((t) => t.id !== task.id && !linkedTaskIds.has(t.id))
    .map((t) => ({ task: t, listName: listNames.get(t.taskListId) ?? '' }));

  const link = (other: Task) => {
    setError('');
    const pair = newDirection === 'blocking'
      ? { taskId: task.id, dependentTaskId: other.id }
      : { taskId: other.id, dependentTaskId: task.id };

    createDependencyMutation.mutate(pair, {
      onSuccess: (dependency) => addDependencyToCache(queryClient, dependency, projectId),
      onError: (err) => setError(err.message),
    });
  };

  const reverse = (dependency: TaskDependency) => {
    setError('');
    reverseDependencyMutation.mutate(dependency, {
      onSuccess: (reversed) => replaceDependencyInCache(queryClient, reversed, projectId),
      onError: (err) => setError(err.message),
    });
  };

  const remove = (dependency: TaskDependency) => {
    deleteDependencyMutation.mutate(dependency, {
      onSuccess: () => removeDependencyFromCache(queryClient, dependency, projectId),
      onError: () => addToast('Failed to remove dependency', 'error'),
    });
  };

  const busy = createDependencyMutation.isPending || reverseDependencyMutation.isPending;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors"
      >
        <ChevronDown size={14} className={`transition-transform ${expanded ? '' : '-rotate-90'}`} />
        Dependencies [{doneCount}/{rows.length}]
      </button>

      {expanded && (
        <div className="mt-2 space-y-1">
          <ul aria-label="Linked tasks" className="space-y-1">
            {rows.map(({ dependency, direction, otherTask }) => (
              <li key={dependency.id} className="group flex items-center gap-2 py-0.5">
                <DependencyTypeMenu
                  value={direction}
                  onChange={() => reverse(dependency)}
                  disabled={busy}
                />
                {otherTask ? (
                  <Link
                    to={`/projects/${projectId}/tasks/${otherTask.id}`}
                    title={otherTask.name}
                    className={`flex-1 min-w-0 truncate text-sm text-slate-700 hover:underline hover:text-indigo-600 ${
                      otherTask.status === 'done' ? 'line-through' : ''
                    }`}
                  >
                    {otherTask.name}
                  </Link>
                ) : (
                  <span className="flex-1 text-sm text-slate-300">…</span>
                )}
                <button
                  type="button"
                  onClick={() => remove(dependency)}
                  disabled={deleteDependencyMutation.isPending}
                  title="Remove dependency"
                  className="shrink-0 p-0.5 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all disabled:opacity-50"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 py-0.5">
            <DependencyTypeMenu value={newDirection} onChange={setNewDirection} disabled={busy} />
            <TaskPicker
              options={pickerOptions}
              placeholder={PICKER_PLACEHOLDER[newDirection]}
              onSelect={link}
              disabled={busy}
            />
          </div>

          {error && <p className="text-xs text-red-500 pl-8">{error}</p>}
        </div>
      )}
    </div>
  );
}
