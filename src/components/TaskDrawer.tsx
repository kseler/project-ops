import { useQueryClient } from '@tanstack/react-query';
import { Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { taskKeys, updateTaskInCache, useDeleteTask, useTask, useUpdateTask } from '@/queries/tasks';
import { removeTaskFromCache } from '@/queries/tasks';

import { addToast } from '../lib/toast';
import type { Task, TaskPriority, TaskStatus } from '../lib/types';
import { validateTask } from '../lib/validation';
import { ConfirmModal } from './ConfirmModal';

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const priorityDot: Record<TaskPriority, string> = {
  high: 'bg-red-400',
  medium: 'bg-amber-400',
  low: 'bg-slate-300',
};

const statusColor: Record<TaskStatus, string> = {
  'todo': 'text-slate-500',
  'in-progress': 'text-indigo-600',
  'done': 'text-emerald-600',
};


// Turns on immediately with the source, but stays on for at least `minDuration`
// ms so fast operations don't just flash.
function useMinDurationFlag(active: boolean, minDuration = 600): boolean {
  const [show, setShow] = useState(false);
  const offAt = useRef<number | null>(null);

  useEffect(() => {
    if (active) {
      offAt.current = null;
      setShow(true);
    } else if (show) {
      offAt.current = Date.now() + minDuration;
      const remaining = offAt.current - Date.now();
      const id = setTimeout(() => setShow(false), remaining);
      return () => clearTimeout(id);
    }
  }, [active, minDuration, show]);

  return show;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider w-24 shrink-0">
      {children}
    </span>
  );
}

export function TaskDrawer() {
  const { id: projectId, taskId } = useParams<{ id: string; taskId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: task, isLoading, error } = useTask(taskId!);

  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();

  const showSaving = useMinDurationFlag(updateTaskMutation.isPending);

  // Local state for text fields (saved on blur)
  const [name, setName] = useState(task?.name ?? '');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [nameError, setNameError] = useState('');
  const [dueDateError, setDueDateError] = useState('');

  // Sync local state when task loads
  const lastTaskId = useRef<string | null>(null);
  useEffect(() => {
    if (!task) return;
    if (task.id !== lastTaskId.current) {
      lastTaskId.current = task.id;
      setName(task.name);
      setDescription(task.description ?? '');
      setAssignee(task.assignee ?? '');
      setNameError('');
      setDueDateError('');
    }
  }, [task]);

  const save = (patch: Partial<Task> & { id: string }) => {
    updateTaskMutation.mutate(patch, {
      onSuccess: (updated) => {
        updateTaskInCache(queryClient, taskKeys.byTaskList(updated.taskListId), updated);
      },
    });
  };

  const [confirmDelete, setConfirmDelete] = useState(false);

  const confirmAndDelete = () => {
    if (!task) return;
    deleteTaskMutation.mutate(task.id, {
      onSuccess: () => {
        removeTaskFromCache(queryClient, taskKeys.byTaskList(task.taskListId), task.id);
        setConfirmDelete(false);
        addToast('Task deleted');
        close();
      },
    });
  };

  const DURATION = 220;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const close = () => {
    setVisible(false);
    setTimeout(() => navigate(`/projects/${projectId}`), DURATION);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div
        className={`fixed top-0 right-0 h-full w-[520px] bg-white shadow-2xl z-50 flex flex-col
          transition-transform duration-[220ms] ease-out
          ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <span className="text-xs text-slate-400">Task details</span>
          <div className="flex items-center gap-1">
            {task && (
              <>
                {showSaving && (
                  <svg
                    className="animate-spin text-indigo-500 mr-1"
                    width={14} height={14}
                    viewBox="0 0 24 24" fill="none"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                )}
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleteTaskMutation.isPending}
                  title="Delete task"
                  className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-50 p-1"
                >
                  <Trash2 size={15} />
                </button>
              </>
            )}
            <button
              onClick={close}
              className="text-slate-400 hover:text-slate-700 transition-colors p-1"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
            Loading…
          </div>
        )}
        {error && (
          <div className="flex-1 flex items-center justify-center text-sm text-red-400">
            {error.message}
          </div>
        )}
        {task && (
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            <div>
              <textarea
                value={name}
                onChange={(e) => { setName(e.target.value); if (nameError) setNameError(''); }}
                onBlur={() => {
                  const errors = validateTask({ name });
                  if (errors.name) { setNameError(errors.name); return; }
                  if (name.trim() !== task.name)
                    save({ id: task.id, name: name.trim() });
                }}
                rows={2}
                className={`w-full text-lg font-semibold text-slate-900 resize-none focus:outline-none focus:ring-0 placeholder:text-slate-300 leading-snug ${nameError ? 'text-red-500' : ''}`}
                placeholder="Task name"
              />
              {nameError && <p className="text-xs text-red-500 mt-0.5">{nameError}</p>}
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                if (description !== (task.description ?? ''))
                  save({ id: task.id, description: description || undefined });
              }}
              rows={3}
              placeholder="Add description…"
              className="w-full text-sm text-slate-500 resize-none focus:outline-none placeholder:text-slate-300 leading-relaxed"
            />

            <div className="h-px bg-slate-100" />

            <div className="flex items-center gap-3">
              <FieldLabel>Status</FieldLabel>
              <div className="flex gap-1.5">
                {STATUS_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => save({ id: task.id, status: value })}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      task.status === value
                        ? 'bg-indigo-50 border-indigo-300 ' + statusColor[value]
                        : 'border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <FieldLabel>Priority</FieldLabel>
              <div className="flex gap-1.5">
                {PRIORITY_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => save({ id: task.id, priority: value })}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      task.priority === value
                        ? 'bg-slate-50 border-slate-300 text-slate-700'
                        : 'border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${priorityDot[value]}`} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <FieldLabel>Assignee</FieldLabel>
              <input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                onBlur={() => {
                  if (assignee !== (task.assignee ?? ''))
                    save({ id: task.id, assignee: assignee || undefined });
                }}
                placeholder="—"
                className="flex-1 text-sm text-slate-700 focus:outline-none placeholder:text-slate-300 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-300 transition-colors py-0.5"
              />
            </div>

            <div className="flex items-center gap-3">
              <FieldLabel>Start</FieldLabel>
              <input
                type="date"
                value={task.startDate ?? ''}
                max={task.dueDate ?? undefined}
                onChange={(e) => {
                  const newStart = e.target.value || undefined;
                  if (dueDateError) setDueDateError('');
                  save({ id: task.id, startDate: newStart });
                }}
                className="text-sm text-slate-700 focus:outline-none border-b border-transparent hover:border-slate-200 focus:border-indigo-300 transition-colors py-0.5 bg-transparent"
              />
            </div>

            <div className="flex items-start gap-3">
              <FieldLabel>Due</FieldLabel>
              <div className="flex flex-col gap-0.5">
                <input
                  type="date"
                  value={task.dueDate ?? ''}
                  min={task.startDate ?? undefined}
                  onChange={(e) => {
                    const newDue = e.target.value || undefined;
                    const errors = validateTask({ startDate: task.startDate ?? undefined, dueDate: newDue });
                    if (errors.dueDate) { setDueDateError(errors.dueDate); return; }
                    setDueDateError('');
                    save({ id: task.id, dueDate: newDue });
                  }}
                  className={`text-sm text-slate-700 focus:outline-none border-b transition-colors py-0.5 bg-transparent ${dueDateError ? 'border-red-300' : 'border-transparent hover:border-slate-200 focus:border-indigo-300'}`}
                />
                {dueDateError && <p className="text-xs text-red-500">{dueDateError}</p>}
              </div>
            </div>

          </div>
        )}

        {task && (
          <div className="px-5 py-4 border-t border-slate-100">
            <span className="text-xs text-slate-300">
              {showSaving ? 'Saving…' : 'Auto-saved'}
            </span>
          </div>
        )}
      </div>

      {confirmDelete && task && (
        <ConfirmModal
          title="Delete task"
          message={`"${task.name}" will be permanently deleted.`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmAndDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
