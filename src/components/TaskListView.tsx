import { Plus } from 'lucide-react';
import { useState } from 'react';

import { createTask } from '../lib/api';
import type { Task, TaskList } from '../lib/types';
import { TaskItem } from './TaskItem';

interface Props {
  taskList: TaskList;
  onTasksChange: (taskListId: string, tasks: Task[]) => void;
}

export function TaskListView({ taskList, onTasksChange }: Props) {
  const [tasks, setTasks] = useState<Task[]>(taskList.tasks);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (updated: Task[]) => {
    setTasks(updated);
    onTasksChange(taskList.id, updated);
  };

  const handleAdd = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      const task = await createTask(taskList.id, { name: newName.trim() });
      update([...tasks, task]);
      setNewName('');
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = (updated: Task) =>
    update(tasks.map((t) => (t.id === updated.id ? updated : t)));

  const handleDelete = (id: string) => update(tasks.filter((t) => t.id !== id));

  const done = tasks.filter((t) => t.status === 'done').length;

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-800">{taskList.name}</h3>
          <span className="text-xs text-slate-400">
            {done}/{tasks.length}
          </span>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="text-slate-400 hover:text-indigo-500 transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Tasks */}
      <div className="divide-y divide-slate-50">
        {tasks.length === 0 && !adding && (
          <p className="px-4 py-4 text-xs text-slate-400">No tasks yet.</p>
        )}
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Add task inline */}
      {adding && (
        <div className="px-3 py-2 border-t border-slate-100">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') {
                setAdding(false);
                setNewName('');
              }
            }}
            placeholder="Task name…"
            className="w-full text-sm px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleAdd}
              disabled={busy}
              className="text-xs px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => {
                setAdding(false);
                setNewName('');
              }}
              className="text-xs px-3 py-1 text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
