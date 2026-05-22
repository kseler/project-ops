import { ArrowLeft, GanttChart, LayoutList } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ProjectGanttView } from '../components/ProjectGanttView';
import { ProjectListView } from '../components/ProjectListView';
import { getProject, getTaskLists } from '../lib/api';
import type { Project, Task, TaskList } from '../lib/types';

type View = 'list' | 'gantt';

const statusBadge: Record<Project['status'], string> = {
  active: 'bg-emerald-100 text-emerald-700',
  'on-hold': 'bg-amber-100 text-amber-700',
  completed: 'bg-slate-100 text-slate-600',
};

const views: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: 'list', label: 'List', icon: <LayoutList size={13} /> },
  { id: 'gantt', label: 'Gantt', icon: <GanttChart size={13} /> },
];

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');

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

  const handleTaskListAdded = (list: TaskList) => setTaskLists((prev) => [...prev, list]);

  const handleTasksChange = (taskListId: string, tasks: Task[]) =>
    setTaskLists((prev) =>
      prev.map((tl) => (tl.id === taskListId ? { ...tl, tasks } : tl)),
    );

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

      <div className="mb-6">
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

      <div className="flex items-center gap-1 mb-6 border-b border-slate-100">
        {views.map(({ id: vid, label, icon }) => (
          <button
            key={vid}
            onClick={() => setView(vid)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              view === vid
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {view === 'list' && (
        <ProjectListView
          projectId={id!}
          taskLists={taskLists}
          onTaskListAdded={handleTaskListAdded}
          onTasksChange={handleTasksChange}
        />
      )}
      {view === 'gantt' && <ProjectGanttView taskLists={taskLists} />}
    </div>
  );
}
