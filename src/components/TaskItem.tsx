import { Calendar, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { deleteTask, updateTask } from '../lib/api';
import type { Task } from '../lib/types';

const priorityDot: Record<Task['priority'], string> = {
  high: 'bg-red-400',
  medium: 'bg-amber-400',
  low: 'bg-slate-300',
};

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]}`;
}

function isOverdue(dueDate: string, status: Task['status']): boolean {
  if (status === 'done') return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

interface Props {
  task: Task;
  onUpdate: (updated: Task) => void;
  onDelete: (id: string) => void;
}

export function TaskItem({ task, onUpdate, onDelete }: Props) {
  const [busy, setBusy] = useState(false);
  const [editingDates, setEditingDates] = useState(false);
  const [startDate, setStartDate] = useState(task.startDate ?? '');
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');

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

  const openDateEdit = () => {
    setStartDate(task.startDate ?? '');
    setDueDate(task.dueDate ?? '');
    setEditingDates(true);
  };

  const saveDates = async () => {
    setEditingDates(false);
    const nextStart = startDate || undefined;
    const nextDue = dueDate || undefined;
    if (nextStart === task.startDate && nextDue === task.dueDate) return;
    try {
      const updated = await updateTask(task.id, {
        startDate: nextStart,
        dueDate: nextDue,
      });
      onUpdate(updated);
    } catch {
      /* ignore */
    }
  };

  const cancelDateEdit = () => {
    setStartDate(task.startDate ?? '');
    setDueDate(task.dueDate ?? '');
    setEditingDates(false);
  };

  const hasDate = task.startDate || task.dueDate;
  const overdue = task.dueDate ? isOverdue(task.dueDate, task.status) : false;

  const dateLabel = hasDate
    ? task.startDate && task.dueDate
      ? `${fmtDate(task.startDate)} – ${fmtDate(task.dueDate)}`
      : task.dueDate
        ? fmtDate(task.dueDate)
        : fmtDate(task.startDate!)
    : null;

  return (
    <div
      className={`px-3 py-2 rounded-md group hover:bg-slate-50 ${busy ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-3 py-0.5">
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

        <button
          onClick={openDateEdit}
          title={hasDate ? 'Edit dates' : 'Set dates'}
          className={`shrink-0 flex items-center gap-1 text-xs rounded px-1.5 py-0.5 transition-colors ${
            hasDate
              ? overdue
                ? 'text-red-400 hover:bg-red-50'
                : 'text-slate-400 hover:text-indigo-500 hover:bg-indigo-50'
              : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-indigo-400 hover:bg-indigo-50'
          }`}
        >
          <Calendar size={10} />
          {dateLabel ?? '+'}
        </button>

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

      {editingDates && (
        <div className="mt-1.5 pl-7 flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            Start
            <input
              type="date"
              value={startDate}
              max={dueDate || undefined}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs px-1.5 py-0.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            Due
            <input
              type="date"
              value={dueDate}
              min={startDate || undefined}
              onChange={(e) => setDueDate(e.target.value)}
              className="text-xs px-1.5 py-0.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700"
            />
          </label>
          <div className="flex gap-1">
            <button
              onClick={saveDates}
              className="text-xs px-2.5 py-0.5 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Save
            </button>
            <button
              onClick={cancelDateEdit}
              className="text-xs px-2 py-0.5 text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
