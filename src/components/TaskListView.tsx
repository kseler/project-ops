import { Plus } from 'lucide-react';
import { useState } from 'react';

import { createTask } from '../lib/api';
import { useProjectDetail } from '../lib/store';
import type { TaskList } from '../lib/types';
import { TaskItem } from './TaskItem';

interface Props {
  taskList: TaskList;
}

export function TaskListView({ taskList }: Props) {
  const { addTask } = useProjectDetail();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      const task = await createTask(taskList.id, {
        name: newName.trim(),
        startDate: newStartDate || undefined,
        dueDate: newDueDate || undefined,
      });
      addTask(taskList.id, task);
      resetForm();
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setAdding(false);
    setNewName('');
    setNewStartDate('');
    setNewDueDate('');
  };

  const done = taskList.tasks.filter((t) => t.status === 'done').length;

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-800">{taskList.name}</h3>
          <span className="text-xs text-slate-400">
            {done}/{taskList.tasks.length}
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
        {taskList.tasks.length === 0 && !adding && (
          <p className="px-4 py-4 text-xs text-slate-400">No tasks yet.</p>
        )}
        {taskList.tasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </div>

      {adding && (
        <div className="px-3 py-2 border-t border-slate-100 space-y-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') resetForm();
            }}
            placeholder="Task name…"
            className="w-full text-sm px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />

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
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              Due
              <input
                type="date"
                value={newDueDate}
                min={newStartDate || undefined}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="text-sm px-1.5 py-0.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={busy}
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
    </div>
  );
}
