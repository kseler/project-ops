import { GanttChart } from 'lucide-react';

import type { TaskList } from '../lib/types';

interface Props {
  taskLists: TaskList[];
}

export function ProjectGanttView({ taskLists: _ }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-slate-300 select-none">
      <GanttChart size={48} strokeWidth={1.25} />
      <p className="mt-4 text-sm font-medium text-slate-400">Gantt view coming soon</p>
      <p className="mt-1 text-xs text-slate-300">Task timelines will be displayed here.</p>
    </div>
  );
}
