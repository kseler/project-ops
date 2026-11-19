import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GanttDependencies, type TaskRowIndex } from '@/components/project/GanttDependencies';
import { getDependencyPath, getEntryRect } from '@/lib/ganttUtils';
import type { Task, TaskDependency } from '@/types';

const renderStart = new Date(2026, 5, 1);

const makeTask = (id: string, startDate?: string, dueDate?: string): Task => ({
  id,
  taskListId: 'tl1',
  name: id,
  status: 'todo',
  priority: 'medium',
  startDate,
  dueDate,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const a = makeTask('a', '2026-06-01', '2026-06-03');
const b = makeTask('b', '2026-06-06', '2026-06-08');
const undated = makeTask('undated');

const taskRows: TaskRowIndex = new Map([
  ['a', { task: a, rowIndex: 1 }],
  ['b', { task: b, rowIndex: 3 }],
  ['undated', { task: undated, rowIndex: 4 }],
]);

const dep = (id: string, taskId: string, dependentTaskId: string): TaskDependency => ({
  id,
  taskId,
  dependentTaskId,
  createdAt: '2026-01-01T00:00:00.000Z',
});

function renderLayer(dependencies: TaskDependency[]) {
  return render(
    <div style={{ position: 'relative' }}>
      <GanttDependencies
        dependencies={dependencies}
        taskRows={taskRows}
        renderStart={renderStart}
        width={2000}
        height={400}
      />
    </div>,
  );
}

describe('GanttDependencies', () => {
  it('draws one path per dependency from the bars\' positions, with an arrow at the end', () => {
    const { container } = renderLayer([dep('d1', 'a', 'b')]);

    const path = container.querySelector('path[data-dependency-id="d1"]')!;
    const expected = getDependencyPath(getEntryRect(a, renderStart, 1)!, getEntryRect(b, renderStart, 3)!);
    expect(path.getAttribute('d')).toBe(expected);

    const markerId = container.querySelector('marker')!.id;
    expect(path.getAttribute('marker-end')).toBe(`url(#${markerId})`);
    expect(markerId).toMatch(/^[a-zA-Z0-9_-]+$/);
  });

  it('sits above the bars without catching the pointer', () => {
    const { container } = renderLayer([dep('d1', 'a', 'b')]);

    expect(container.querySelector('svg')).toHaveClass('absolute', 'z-20', 'pointer-events-none');
  });

  it('skips dependencies whose tasks have no bar or are not in the chart', () => {
    const { container } = renderLayer([dep('d1', 'a', 'undated'), dep('d2', 'a', 'missing')]);

    expect(container.querySelector('svg')).toBeNull();
  });
});
