import { useId } from 'react';

import { getDependencyPath, getEntryRect } from '@/lib/ganttUtils';
import type { Task, TaskDependency } from '@/types';

export type TaskRowIndex = Map<string, { task: Task; rowIndex: number }>;

interface Props {
  dependencies: TaskDependency[];
  taskRows: TaskRowIndex;
  renderStart: Date;
  width: number;
  height: number;
}

const ARROW_SIZE = 7;

// One SVG over the task bars with a <path> per dependency. It sits above the bars (z-20 inside the
// rows area, which is an isolated stacking context) and ignores the pointer so bars stay draggable.
export function GanttDependencies({ dependencies, taskRows, renderStart, width, height }: Props) {
  // useId can contain characters that are not valid inside url(#…)
  const markerId = `gantt-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const paths = dependencies.flatMap((dependency) => {
    const from = taskRows.get(dependency.taskId);
    const to = taskRows.get(dependency.dependentTaskId);
    if (!from || !to) return [];

    const fromRect = getEntryRect(from.task, renderStart, from.rowIndex);
    const toRect = getEntryRect(to.task, renderStart, to.rowIndex);
    if (!fromRect || !toRect) return [];

    return [{ id: dependency.id, d: getDependencyPath(fromRect, toRect) }];
  });

  if (paths.length === 0) return null;

  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      className="absolute left-0 top-0 z-20 pointer-events-none overflow-visible text-slate-400"
    >
      <defs>
        <marker
          id={markerId}
          viewBox={`0 0 ${ARROW_SIZE} ${ARROW_SIZE}`}
          refX={ARROW_SIZE}
          refY={ARROW_SIZE / 2}
          markerWidth={ARROW_SIZE}
          markerHeight={ARROW_SIZE}
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path d={`M 0 0 L ${ARROW_SIZE} ${ARROW_SIZE / 2} L 0 ${ARROW_SIZE} z`} fill="currentColor" />
        </marker>
      </defs>
      {paths.map(({ id, d }) => (
        <path
          key={id}
          d={d}
          data-dependency-id={id}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          markerEnd={`url(#${markerId})`}
        />
      ))}
    </svg>
  );
}
