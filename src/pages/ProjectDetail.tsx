import { ArrowLeft, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { TaskListView } from '../components/TaskListView';
import { createTaskList, getProject, getTaskLists } from '../lib/api';
import type { Project, Task, TaskList } from '../lib/types';

const statusBadge: Record<Project['status'], string> = {
  active: 'bg-emerald-100 text-emerald-700',
  'on-hold': 'bg-amber-100 text-amber-700',
  completed: 'bg-slate-100 text-slate-600',
};

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([getProject(id), getTaskLists(id)])
      .then(([proj, lists]) => {
        setProject(proj);
        setTaskLists(lists);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddList = async () => {
    if (!newListName.trim() || !id || busy) return;
    setBusy(true);
    try {
      const list = await createTaskList(id, newListName.trim());
      setTaskLists((prev) => [...prev, list]);
      setNewListName('');
      setAddingList(false);
    } finally {
      setBusy(false);
    }
  };

  const handleTasksChange = (taskListId: string, tasks: Task[]) => {
    setTaskLists((prev) =>
      prev.map((tl) => (tl.id === taskListId ? { ...tl, tasks } : tl)),
    );
  };

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading…</div>;
  if (error) return <div className="p-8 text-sm text-red-400">{error}</div>;
  if (!project) return null;

  const totalTasks = taskLists.flatMap((tl) => tl.tasks).length;
  const doneTasks = taskLists
    .flatMap((tl) => tl.tasks)
    .filter((t) => t.status === 'done').length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="px-8 py-8">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> Projects
      </Link>

      <div className="flex items-start justify-between mb-2">
        <h1 className="text-xl font-bold text-slate-900 leading-tight">{project.name}</h1>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge[project.status]}`}
        >
          {project.status}
        </span>
      </div>
      <p className="text-sm text-slate-500 mb-5">{project.description}</p>

      <div className="mb-7">
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>
            {doneTasks} of {totalTasks} tasks complete
          </span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="space-y-4">
        {taskLists.map((tl) => (
          <TaskListView key={tl.id} taskList={tl} onTasksChange={handleTasksChange} />
        ))}
      </div>

      <div className="mt-4">
        {addingList ? (
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <input
              autoFocus
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddList();
                if (e.key === 'Escape') {
                  setAddingList(false);
                  setNewListName('');
                }
              }}
              placeholder="List name…"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleAddList}
                disabled={busy}
                className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                Add list
              </button>
              <button
                onClick={() => {
                  setAddingList(false);
                  setNewListName('');
                }}
                className="text-xs px-3 py-1.5 text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingList(true)}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors"
          >
            <Plus size={14} /> Add task list
          </button>
        )}
      </div>
    </div>
  );
}
