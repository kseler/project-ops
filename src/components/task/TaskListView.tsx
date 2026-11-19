import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { hasErrors, validateTask, validateTaskList } from '@/lib/validation';
import {
  removeTaskListFromCache,
  updateTaskListInCache,
  useDeleteTaskList,
  useUpdateTaskList,
} from '@/queries/taskLists';
import { taskKeys, useCreateTask, useTasksByTaskList } from '@/queries/tasks';
import { addToast } from '@/services/toast';
import type { Task, TaskList } from '@/types';

import { ConfirmModal } from '../ui/ConfirmModal';
import { TaskItem } from './TaskItem';

interface Props {
  taskList: TaskList;
}

export function TaskListView({ taskList }: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [taskErrors, setTaskErrors] = useState<{ name?: string; dueDate?: string }>({});

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(taskList.name);
  const [nameError, setNameError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cancelNameEditRef = useRef(false);

  const queryClient = useQueryClient();
  const {data: tasks} = useTasksByTaskList(taskList.id);

  const createTaskMutation = useCreateTask();
  const updateTaskListMutation = useUpdateTaskList();
  const deleteTaskListMutation = useDeleteTaskList();

  const openNameEdit = () => {
    setName(taskList.name);
    setNameError('');
    setEditingName(true);
  };

  const cancelNameEdit = () => {
    setName(taskList.name);
    setNameError('');
    setEditingName(false);
  };

  const saveName = () => {
    const errors = validateTaskList({ name });
    if (errors.name) {
      setNameError(errors.name);
      return;
    }

    setEditingName(false);
    if (name.trim() === taskList.name) return;

    updateTaskListMutation.mutate({ id: taskList.id, name: name.trim() }, {
      onSuccess: (updated) => {
        updateTaskListInCache(queryClient, taskList.projectId, updated);
        addToast('Task list renamed');
      },
      onError: () => {
        setName(taskList.name);
        addToast('Failed to rename task list', 'error');
      },
    });
  };

  const confirmAndDelete = () => {
    deleteTaskListMutation.mutate(taskList.id, {
      onSuccess: () => {
        removeTaskListFromCache(queryClient, taskList.projectId, taskList.id);
        queryClient.removeQueries({ queryKey: taskKeys.byTaskList(taskList.id) });
        // a drawer open on one of the deleted tasks refetches, gets 404 and closes
        queryClient.invalidateQueries({ queryKey: taskKeys.details() });
        queryClient.setQueryData<Task[]>(taskKeys.byProject(taskList.projectId), (current) =>
          current?.filter((task) => task.taskListId !== taskList.id),
        );
        setConfirmDelete(false);
        addToast('Task list deleted');
      },
      onError: () => {
        setConfirmDelete(false);
        addToast('Failed to delete task list', 'error');
      },
    });
  };

  const handleAdd = async () => {
    const errors = validateTask({ name: newName, startDate: newStartDate, dueDate: newDueDate });
    if (hasErrors(errors)) { setTaskErrors(errors); return; }

    await createTaskMutation.mutateAsync({
      taskListId: taskList.id,
      name: newName.trim(),
      startDate: newStartDate || undefined,
      dueDate: newDueDate || undefined,
    }, {
      onSuccess: () => addToast('Task created'),
      onSettled: () => resetForm(),
    });
  };

  const resetForm = () => {
    setAdding(false);
    setNewName('');
    setNewStartDate('');
    setNewDueDate('');
    setTaskErrors({});
  };

  const done = tasks?.filter((t) => t.status === 'done')?.length ?? 0;

  const busy = updateTaskListMutation.isPending || deleteTaskListMutation.isPending;

  return (
    <div className={`bg-white border border-slate-200 rounded-lg overflow-hidden ${busy ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="group flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {editingName ? (
            <div className="flex-1 min-w-0">
              <input
                autoFocus
                value={name}
                onChange={(e) => { setName(e.target.value); if (nameError) setNameError(''); }}
                onBlur={() => {
                  if (cancelNameEditRef.current) {
                    cancelNameEditRef.current = false;
                    cancelNameEdit();
                    return;
                  }
                  saveName();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') {
                    cancelNameEditRef.current = true;
                    e.currentTarget.blur();
                  }
                }}
                aria-label="Task list name"
                className={`w-full text-sm font-semibold text-slate-800 bg-transparent border-b focus:outline-none py-0.5 ${nameError ? 'border-red-300' : 'border-indigo-300'}`}
              />
              {nameError && <p className="text-xs text-red-500 mt-0.5">{nameError}</p>}
            </div>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-slate-800 truncate">{taskList.name}</h3>
              <span className="text-xs text-slate-400 shrink-0">
                {done}/{tasks?.length ?? 0}
              </span>
              <button
                onClick={openNameEdit}
                disabled={busy}
                title="Rename task list"
                className="shrink-0 text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Pencil size={12} />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            title="Delete task list"
            className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setAdding(true)}
            title="Add task"
            className="text-slate-400 hover:text-indigo-500 transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Tasks */}
      <div className="divide-y divide-slate-50">
        {tasks?.length === 0 && !adding && (
          <p className="px-4 py-4 text-xs text-slate-400">No tasks yet.</p>
        )}
        {tasks?.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </div>

      {adding && (
        <div className="px-3 py-2 border-t border-slate-100 space-y-2">
          <div>
            <input
              autoFocus
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setTaskErrors((e) => ({ ...e, name: undefined })); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') resetForm();
              }}
              placeholder="Task name…"
              className={`w-full text-sm px-2 py-1.5 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-300 ${taskErrors.name ? 'border-red-300' : 'border-slate-200'}`}
            />
            {taskErrors.name && <p className="text-xs text-red-500 mt-0.5">{taskErrors.name}</p>}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              Start
              <input
                type="date"
                value={newStartDate}
                max={newDueDate || undefined}
                onChange={(e) => setNewStartDate(e.target.value)}
                className="text-sm px-1.5 py-0.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700"
              />
            </label>
            <div className="flex flex-col gap-0.5">
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                Due
                <input
                  type="date"
                  value={newDueDate}
                  min={newStartDate || undefined}
                  onChange={(e) => { setNewDueDate(e.target.value); setTaskErrors((e) => ({ ...e, dueDate: undefined })); }}
                  className={`text-sm px-1.5 py-0.5 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700 ${taskErrors.dueDate ? 'border-red-300' : 'border-slate-200'}`}
                />
              </label>
              {taskErrors.dueDate && <p className="text-xs text-red-500">{taskErrors.dueDate}</p>}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={createTaskMutation.isPending}
              className="text-xs px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={resetForm}
              className="text-xs px-3 py-1 text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete task list"
          message={`"${taskList.name}" and all ${tasks?.length ?? 0} of its tasks will be permanently deleted.`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmAndDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
