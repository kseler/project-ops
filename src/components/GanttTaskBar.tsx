import { GripVertical } from 'lucide-react';
import type { CSSProperties } from 'react';

import { toISO } from '../lib/ganttUtils';
import type { Task } from '../lib/types';
import { DragHandle } from './DragHandle';

interface Props {
  task: Task;
  style: CSSProperties;
}

function entryClass(task: Task, todayStr: string): string {
  if (task.status === 'done') return 'bg-slate-300 text-slate-500';
  if (task.dueDate && task.dueDate < todayStr) return 'bg-red-400 text-white';
  if (task.status === 'in-progress') return 'bg-indigo-500 text-white';
  return 'bg-indigo-300 text-indigo-900';
}

const todayStr = toISO(new Date());

export function GanttTaskBar({ task, style }: Props) {
  const dragObject = task as unknown as Record<string, unknown>;

  return (
    <DragHandle
      dragId="task-move"
      object={dragObject}
      style={style}
      title={`${task.name}${task.startDate ? ` · ${task.startDate}` : ''} → ${task.dueDate ?? ''}`}
      className={`rounded text-xs flex items-center select-none group cursor-grab ${entryClass(task, todayStr)}`}
    >
      <DragHandle
        dragId="task-resize-left"
        object={dragObject}
        className="absolute left-0 top-0 bottom-0 w-3 flex items-center justify-center cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-opacity z-10"
      >
        <GripVertical size={9} />
      </DragHandle>

      <span className="truncate px-3">{task.name}</span>

      <DragHandle
        dragId="task-resize-right"
        object={dragObject}
        className="absolute right-0 top-0 bottom-0 w-3 flex items-center justify-center cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-opacity z-10"
      >
        <GripVertical size={9} />
      </DragHandle>
    </DragHandle>
  );
}
