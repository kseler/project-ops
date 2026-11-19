import type { CSSProperties } from 'react';

import type { Task } from '../types';

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
export function getTimelineGridStyle(totalDays: number): CSSProperties {
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
    position: 'relative',
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
export interface EntryRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const ENTRY_INSET_X = 2;
const ENTRY_INSET_Y = 5;

// position of a task bar inside the timeline rows area; null when the task has no dates
export function getEntryRect(task: Task, renderStart: Date, rowIndex: number): EntryRect | null {
  if (!task.startDate && !task.dueDate) return null;

  const start = task.startDate ? parseDate(task.startDate) : parseDate(task.dueDate!);
  const end = task.dueDate ? parseDate(task.dueDate) : start;

  return {
    left: daysBetween(renderStart, start) * SEGMENT_WIDTH + ENTRY_INSET_X,
    width: Math.max(daysBetween(start, end) + 1, 1) * SEGMENT_WIDTH - ENTRY_INSET_X * 2,
    top: rowIndex * SEGMENT_HEIGHT + ENTRY_INSET_Y,
    height: SEGMENT_HEIGHT - ENTRY_INSET_Y * 2,
  };
}

export function getEntryStyle(
  task: Task,
  renderStart: Date,
  rowIndex: number,
): CSSProperties | null {
  const rect = getEntryRect(task, renderStart, rowIndex);
  return rect && { position: 'absolute', ...rect };
}

// straight run out of the blocking bar, and into the dependent bar (long enough for the arrowhead)
export const DEPENDENCY_EXIT = 10;
export const DEPENDENCY_ENTRY = 16;
export const DEPENDENCY_CORNER_RADIUS = 6;

export type Point = [x: number, y: number];

// Finish-to-start route: from the right edge of `from` (the blocking task) to the left edge of
// `to` (the dependent task), as the corners of a right-angled line. When the dependent bar starts
// too close to (or before) the end of the blocking bar, the line drops into the gap between rows
// and comes back so it still enters the dependent bar from the left.
export function getDependencyPoints(from: EntryRect, to: EntryRect): Point[] {
  const x1 = from.left + from.width;
  const y1 = from.top + from.height / 2;
  const x2 = to.left;
  const y2 = to.top + to.height / 2;

  if (x2 - x1 >= DEPENDENCY_EXIT + DEPENDENCY_ENTRY) {
    if (y1 === y2) return [[x1, y1], [x2, y2]];
    const elbowX = x1 + DEPENDENCY_EXIT;
    return [[x1, y1], [elbowX, y1], [elbowX, y2], [x2, y2]];
  }

  // the gap between rows next to the dependent bar: above it when going down, below it otherwise
  const gapY = y2 > y1
    ? to.top - ENTRY_INSET_Y
    : to.top + to.height + ENTRY_INSET_Y;
  const outX = x1 + DEPENDENCY_EXIT;
  const inX = x2 - DEPENDENCY_ENTRY;

  return [[x1, y1], [outX, y1], [outX, gapY], [inX, gapY], [inX, y2], [x2, y2]];
}

// Draws a right-angled line through `points` with each corner rounded by a quadratic curve.
// The radius shrinks on short segments so neighbouring curves never overlap.
export function toRoundedPath(points: Point[], radius: number): string {
  const [first, ...rest] = points;
  let d = `M ${first[0]} ${first[1]}`;

  for (let i = 0; i < rest.length - 1; i++) {
    const prev = points[i];
    const corner = rest[i];
    const next = rest[i + 1];

    const r = Math.min(radius, distance(prev, corner) / 2, distance(corner, next) / 2);
    const before = towards(corner, prev, r);
    const after = towards(corner, next, r);

    d += ` L ${before[0]} ${before[1]} Q ${corner[0]} ${corner[1]} ${after[0]} ${after[1]}`;
  }

  const last = rest[rest.length - 1];
  return `${d} L ${last[0]} ${last[1]}`;
}

const distance = ([ax, ay]: Point, [bx, by]: Point) => Math.abs(bx - ax) + Math.abs(by - ay);

// the point `length` px from `from` in the direction of `to` (segments are axis-aligned)
const towards = ([fx, fy]: Point, [tx, ty]: Point, length: number): Point => [
  fx + Math.sign(tx - fx) * length,
  fy + Math.sign(ty - fy) * length,
];

export function getDependencyPath(from: EntryRect, to: EntryRect): string {
  return toRoundedPath(getDependencyPoints(from, to), DEPENDENCY_CORNER_RADIUS);
}
