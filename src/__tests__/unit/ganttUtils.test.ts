import { describe, expect, it } from 'vitest';

import {
  addDays,
  applyDragOffset,
  daysBetween,
  getEntryStyle,
  parseDate,
  SEGMENT_HEIGHT,
  SEGMENT_WIDTH,
  toISO,
} from '@/lib/ganttUtils';
import type { Task } from '@/lib/types';

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
