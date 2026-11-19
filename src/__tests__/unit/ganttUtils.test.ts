import { describe, expect, it } from 'vitest';

import {
  addDays,
  applyDragOffset,
  daysBetween,
  DEPENDENCY_ENTRY,
  DEPENDENCY_EXIT,
  getDependencyPath,
  getDependencyPoints,
  getEntryRect,
  getEntryStyle,
  parseDate,
  SEGMENT_HEIGHT,
  SEGMENT_WIDTH,
  toISO,
  toRoundedPath,
} from '@/lib/ganttUtils';
import type { Task } from '@/types';

const baseTask: Task = {
  id: 't1',
  taskListId: 'tl1',
  name: 'Test task',
  status: 'todo',
  priority: 'medium',
  startDate: '2026-06-01',
  dueDate: '2026-06-10',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('addDays', () => {
  it('adds positive days', () => {
    expect(toISO(addDays(new Date(2026, 0, 1), 10))).toBe('2026-01-11');
  });

  it('subtracts days with a negative value', () => {
    expect(toISO(addDays(new Date(2026, 0, 10), -5))).toBe('2026-01-05');
  });

  it('crosses a month boundary', () => {
    expect(toISO(addDays(new Date(2026, 0, 28), 5))).toBe('2026-02-02');
  });
});

describe('daysBetween', () => {
  it('returns positive days from earlier to later date', () => {
    expect(daysBetween(new Date(2026, 0, 1), new Date(2026, 0, 11))).toBe(10);
  });

  it('returns 0 for the same date', () => {
    const d = new Date(2026, 0, 1);
    expect(daysBetween(d, d)).toBe(0);
  });

  it('returns negative days when b is before a', () => {
    expect(daysBetween(new Date(2026, 0, 11), new Date(2026, 0, 1))).toBe(-10);
  });
});

describe('parseDate', () => {
  it('parses YYYY-MM-DD without a timezone shift', () => {
    const d = parseDate('2026-06-15');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // 0-indexed
    expect(d.getDate()).toBe(15);
  });

  it('handles month boundaries', () => {
    const d = parseDate('2026-01-01');
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });
});

describe('toISO', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toISO(new Date(2026, 5, 5))).toBe('2026-06-05');
  });

  it('zero-pads month and day', () => {
    expect(toISO(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
});

describe('applyDragOffset', () => {
  it('returns the original task when offsetDays is 0', () => {
    const result = applyDragOffset({ ...baseTask }, 'task-move', 0);
    expect(result).toEqual(expect.objectContaining({ startDate: '2026-06-01', dueDate: '2026-06-10' }));
  });

  it('returns the original task when task has no dueDate', () => {
    const task = { ...baseTask, dueDate: undefined };
    const result = applyDragOffset(task, 'task-move', 5);
    expect(result).toBe(task);
  });

  it('move shifts both startDate and dueDate by the offset', () => {
    const result = applyDragOffset({ ...baseTask }, 'task-move', 3);
    expect(result.startDate).toBe('2026-06-04');
    expect(result.dueDate).toBe('2026-06-13');
  });

  it('resize-left shifts only startDate', () => {
    const result = applyDragOffset({ ...baseTask }, 'task-resize-left', 2);
    expect(result.startDate).toBe('2026-06-03');
    expect(result.dueDate).toBe('2026-06-10');
  });

  it('resize-left does not move startDate past dueDate', () => {
    const result = applyDragOffset({ ...baseTask }, 'task-resize-left', 20);
    expect(result).toEqual(expect.objectContaining({ startDate: '2026-06-01', dueDate: '2026-06-10' }));
  });

  it('resize-right shifts only dueDate', () => {
    const result = applyDragOffset({ ...baseTask }, 'task-resize-right', 5);
    expect(result.startDate).toBe('2026-06-01');
    expect(result.dueDate).toBe('2026-06-15');
  });

  it('resize-right does not move dueDate before startDate', () => {
    const result = applyDragOffset({ ...baseTask }, 'task-resize-right', -20);
    expect(result).toEqual(expect.objectContaining({ startDate: '2026-06-01', dueDate: '2026-06-10' }));
  });
});

describe('getEntryStyle', () => {
  const renderStart = parseDate('2026-06-01');

  it('returns null when task has no dates', () => {
    const task = { ...baseTask, startDate: undefined, dueDate: undefined };
    expect(getEntryStyle(task, renderStart, 0)).toBeNull();
  });

  it('returns a one-day-wide bar for a task with only dueDate', () => {
    const task = { ...baseTask, startDate: undefined, dueDate: '2026-06-01' };
    const style = getEntryStyle(task, renderStart, 0);
    expect(style).not.toBeNull();
    expect(style!.width).toBe(SEGMENT_WIDTH - 4);
  });

  it('calculates correct left position based on offset from renderStart', () => {
    const task = { ...baseTask, startDate: '2026-06-06', dueDate: '2026-06-10' };
    const style = getEntryStyle(task, renderStart, 0);
    // 5 days offset → 5 * SEGMENT_WIDTH + 2
    expect(style!.left).toBe(5 * SEGMENT_WIDTH + 2);
  });

  it('calculates correct top position based on rowIndex', () => {
    const style = getEntryStyle(baseTask, renderStart, 2);
    expect(style!.top).toBe(2 * SEGMENT_HEIGHT + 5);
  });

  it('calculates width spanning the full date range', () => {
    // startDate=Jun 1, dueDate=Jun 10 → 9 days span → (9+1) * SEGMENT_WIDTH - 4
    const style = getEntryStyle(baseTask, renderStart, 0);
    expect(style!.width).toBe(10 * SEGMENT_WIDTH - 4);
  });
});

describe('getEntryRect', () => {
  const renderStart = new Date(2026, 4, 30); // 30 May 2026

  it('matches the bar style so arrows line up with bars', () => {
    const rect = getEntryRect(baseTask, renderStart, 3)!;
    const style = getEntryStyle(baseTask, renderStart, 3)!;

    expect(style).toEqual({ position: 'absolute', ...rect });
  });

  it('places the bar inside its day cells and row', () => {
    const rect = getEntryRect(baseTask, renderStart, 3)!;

    expect(rect.left).toBe(2 * SEGMENT_WIDTH + 2);
    expect(rect.width).toBe(10 * SEGMENT_WIDTH - 4);
    expect(rect.top).toBe(3 * SEGMENT_HEIGHT + 5);
    expect(rect.height).toBe(SEGMENT_HEIGHT - 10);
  });

  it('returns null for a task without dates', () => {
    expect(getEntryRect({ ...baseTask, startDate: undefined, dueDate: undefined }, renderStart, 0)).toBeNull();
  });
});


describe('getDependencyPoints', () => {
  const bar = (left: number, row: number, width = 80) => ({
    left,
    width,
    top: row * SEGMENT_HEIGHT + 5,
    height: SEGMENT_HEIGHT - 10,
  });
  const cy = (row: number) => row * SEGMENT_HEIGHT + SEGMENT_HEIGHT / 2;

  it('is a straight line between bars on the same row', () => {
    expect(getDependencyPoints(bar(0, 2), bar(200, 2))).toEqual([[80, cy(2)], [200, cy(2)]]);
  });

  it('turns just after the blocker and runs into the dependent bar', () => {
    expect(getDependencyPoints(bar(0, 0), bar(200, 3))).toEqual([
      [80, cy(0)],
      [80 + DEPENDENCY_EXIT, cy(0)],
      [80 + DEPENDENCY_EXIT, cy(3)],
      [200, cy(3)],
    ]);
  });

  it('routes through the gap above the dependent row when it starts before the blocker ends', () => {
    const rowTop = 3 * SEGMENT_HEIGHT;
    expect(getDependencyPoints(bar(100, 0), bar(40, 3))).toEqual([
      [180, cy(0)],
      [180 + DEPENDENCY_EXIT, cy(0)],
      [180 + DEPENDENCY_EXIT, rowTop],
      [40 - DEPENDENCY_ENTRY, rowTop],
      [40 - DEPENDENCY_ENTRY, cy(3)],
      [40, cy(3)],
    ]);
  });

  it('routes through the gap below the dependent row when going up', () => {
    const rowBottom = 2 * SEGMENT_HEIGHT;
    expect(getDependencyPoints(bar(100, 4), bar(40, 1))[2]).toEqual([180 + DEPENDENCY_EXIT, rowBottom]);
  });

  it('takes the detour when the bars are closer than exit + entry', () => {
    const tooClose = 80 + DEPENDENCY_EXIT + DEPENDENCY_ENTRY - 1;
    expect(getDependencyPoints(bar(0, 0), bar(tooClose, 2))).toHaveLength(6);
  });

  it('always leaves room for the arrowhead before the dependent bar', () => {
    const cases = [[bar(0, 0), bar(300, 5)], [bar(300, 5), bar(0, 0)], [bar(0, 1), bar(10, 1)], [bar(0, 0), bar(110, 2)]];
    for (const [from, to] of cases) {
      const points = getDependencyPoints(from, to);
      const [lastX] = points[points.length - 1];
      const [beforeX] = points[points.length - 2];
      expect(lastX).toBe(to.left);
      expect(lastX - beforeX).toBeGreaterThanOrEqual(DEPENDENCY_ENTRY);
    }
  });
});

describe('toRoundedPath', () => {
  it('draws a plain line when there are no corners', () => {
    expect(toRoundedPath([[0, 10], [100, 10]], 6)).toBe('M 0 10 L 100 10');
  });

  it('rounds each corner with a curve of the given radius', () => {
    expect(toRoundedPath([[0, 0], [20, 0], [20, 40], [60, 40]], 6)).toBe(
      'M 0 0 L 14 0 Q 20 0 20 6 L 20 34 Q 20 40 26 40 L 60 40',
    );
  });

  it('shrinks the radius on short segments so curves never overlap', () => {
    // the vertical segment is only 4px, so each corner gets at most 2px
    expect(toRoundedPath([[0, 0], [20, 0], [20, 4], [60, 4]], 6)).toBe(
      'M 0 0 L 18 0 Q 20 0 20 2 L 20 2 Q 20 4 22 4 L 60 4',
    );
  });

  it('is what getDependencyPath draws', () => {
    const from = { left: 0, top: 5, width: 80, height: 26 };
    const to = { left: 200, top: 77, width: 80, height: 26 };
    expect(getDependencyPath(from, to)).toBe(toRoundedPath(getDependencyPoints(from, to), 6));
  });
});
