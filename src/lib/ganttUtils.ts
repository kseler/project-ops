import type { CSSProperties } from 'react';

import type { Task } from './types';

export const SEGMENT_WIDTH = 40; // px per day
export const SEGMENT_HEIGHT = 36; // px per row — must match left-panel row height

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Whole days from a to b (b - a). Negative if b is before a. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Parse YYYY-MM-DD without timezone shift. */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Initial rendering start/end dates centered on today.
 * Buffer is at least 180 days, or 3× the viewport in days — whichever is larger.
 */
export function getRenderingDates(viewportWidth: number): { start: Date; end: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bufferDays = Math.max(Math.ceil((viewportWidth / SEGMENT_WIDTH) * 3), 180);
  return {
    start: addDays(today, -bufferDays),
    end: addDays(today, bufferDays),
  };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

/**
 * CSS style for the timeline grid container.
 * Uses two repeating-linear-gradients to draw:
 *   - 1px vertical lines every SEGMENT_WIDTH px  (day columns)
 *   - 1px horizontal lines every SEGMENT_HEIGHT px (row separators)
 */
export function getTimelineGridStyle(totalDays: number, rowCount: number): CSSProperties {
  const vLine = `repeating-linear-gradient(
    to right,
    transparent,
    transparent ${SEGMENT_WIDTH - 1}px,
    #e2e8f0 ${SEGMENT_WIDTH - 1}px,
    #e2e8f0 ${SEGMENT_WIDTH}px
  )`;
  const hLine = `repeating-linear-gradient(
    to bottom,
    transparent,
    transparent ${SEGMENT_HEIGHT - 1}px,
    #e2e8f0 ${SEGMENT_HEIGHT - 1}px,
    #e2e8f0 ${SEGMENT_HEIGHT}px
  )`;
  return {
    backgroundImage: `${vLine}, ${hLine}`,
    width: totalDays * SEGMENT_WIDTH,
    height: rowCount * SEGMENT_HEIGHT,
    position: 'relative',
    flexShrink: 0,
  };
}

/**
 * Apply a day offset to a task's dates based on the drag handle being used.
 * Returns the same task reference if no change would occur.
 */
export function applyDragOffset(task: Task, dragId: string, offsetDays: number): Task {
  if (Math.abs(offsetDays) === 0 || !task.dueDate) return task;

  // Safe mutation — drag.object is a JSON.parse copy, never the store reference.
  task.startDate ??= task.dueDate;

  if (dragId === 'task-move') {
    return {
      ...task,
      startDate: toISO(addDays(parseDate(task.startDate), offsetDays)),
      dueDate: toISO(addDays(parseDate(task.dueDate), offsetDays)),
    };
  }

  if (dragId === 'task-resize-left') {
    const newStart = addDays(parseDate(task.startDate ?? task.dueDate), offsetDays);
    const end = task.dueDate ? parseDate(task.dueDate) : null;
    if (end && newStart > end) return task;
    return { ...task, startDate: toISO(newStart) };
  }

  if (dragId === 'task-resize-right') {
    const start = parseDate(task.startDate ?? task.dueDate);
    const newEnd = addDays(parseDate(task.dueDate), offsetDays);
    if (start && newEnd < start) return task;
    return { ...task, dueDate: toISO(newEnd) };
  }

  return task;
}

/**
 * Absolute-position style for a task entry bar.
 * Returns null if the task has no dates (nothing to render).
 * For single-date tasks (dueDate only) the bar spans one day.
 */
export function getEntryStyle(
  task: Task,
  renderStart: Date,
  rowIndex: number,
): CSSProperties | null {
  if (!task.startDate && !task.dueDate) return null;

  const start = task.startDate ? parseDate(task.startDate) : parseDate(task.dueDate!);
  const end = task.dueDate ? parseDate(task.dueDate) : start;

  const left = daysBetween(renderStart, start) * SEGMENT_WIDTH + 2;
  const width = Math.max(daysBetween(start, end) + 1, 1) * SEGMENT_WIDTH - 4;
  const top = rowIndex * SEGMENT_HEIGHT + 5;
  const height = SEGMENT_HEIGHT - 10;

  return { position: 'absolute', left, top, width, height };
}
