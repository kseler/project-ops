import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { deleteTask, updateTask } from '../lib/api';
import type { Task } from '../lib/types';

const priorityDot: Record<Task['priority'], string> = {
  high: 'bg-red-400',
  medium: 'bg-amber-400',
  low: 'bg-slate-300',
};

interface Props {
  task: Task;
  onUpdate: (updated: Task) => void;
  onDelete: (id: string) => void;
}

export function TaskItem({ task, onUpdate, onDelete }: Props) {
  const [busy, setBusy] = useState(false);

  const toggleStatus = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const nextStatus =
        task.status === 'todo'
          ? 'in-progress'
          : task.status === 'in-progress'
            ? 'done'
            : 'todo';
      const updated = await updateTask(task.id, { status: nextStatus });
      onUpdate(updated);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteTask(task.id);
      onDelete(task.id);
    } catch {
      setBusy(false);
    }
  };

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-md group hover:bg-slate-50 ${busy ? 'opacity-60' : ''}`}
    >
      <button
        onClick={toggleStatus}
        className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
          task.status === 'done'
            ? 'bg-indigo-500 border-indigo-500'
            : task.status === 'in-progress'
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-slate-300 hover:border-indigo-400'
        }`}
        title={`Mark as ${task.status === 'todo' ? 'in-progress' : task.status === 'in-progress' ? 'done' : 'todo'}`}
      >
        {task.status === 'done' && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
            <path
              d="M1.5 5l2.5 2.5 4.5-4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {task.status === 'in-progress' && (
          <div className="w-2 h-2 rounded-full bg-indigo-400" />
        )}
      </button>

      <span
        className={`flex-1 text-sm ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700'}`}
      >
        {task.name}
      </span>

      <span
        className={`shrink-0 w-2 h-2 rounded-full ${priorityDot[task.priority]}`}
        title={task.priority}
      />

      <button
        onClick={handleDelete}
        className="shrink-0 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
