import { useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import {
  addDays,
  daysBetween,
  getEntryStyle,
  getTimelineGridStyle,
  SEGMENT_HEIGHT,
  SEGMENT_WIDTH,
  toISO,
} from '../lib/ganttUtils';
import type { Task, TaskList } from '../lib/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const LEFT_PANEL_WIDTH = 256;
const MONTH_ROW_HEIGHT = 22;
const DAY_ROW_HEIGHT = 22;
const DATE_HEADER_HEIGHT = MONTH_ROW_HEIGHT + DAY_ROW_HEIGHT;
const INITIAL_BUFFER_DAYS = 180;
const EXTEND_DAYS = 90;
const SCROLL_THRESHOLD = 400; // px from edge before extending the render range

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

type Row = { kind: 'header'; taskList: TaskList } | { kind: 'task'; task: Task };

function entryClass(task: Task, todayStr: string): string {
  if (task.status === 'done') return 'bg-slate-300 text-slate-500';
  if (task.dueDate && task.dueDate < todayStr) return 'bg-red-400 text-white';
  if (task.status === 'in-progress') return 'bg-indigo-500 text-white';
  return 'bg-indigo-300 text-indigo-900';
}

interface Props {
  taskLists: TaskList[];
}

export function ProjectGanttView({ taskLists }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toISO(today);

  const [renderStart, setRenderStart] = useState(() =>
    addDays(today, -INITIAL_BUFFER_DAYS),
  );
  const [renderEnd, setRenderEnd] = useState(() => addDays(today, INITIAL_BUFFER_DAYS));

  const scrollRef = useRef<HTMLDivElement>(null);
  const adjusting = useRef(false);

  // Flat row list — mirrors left panel rows 1:1 with timeline rows
  const rows: Row[] = taskLists.flatMap((tl) => [
    { kind: 'header' as const, taskList: tl },
    ...tl.tasks.map((task) => ({ kind: 'task' as const, task })),
  ]);

  const totalDays = daysBetween(renderStart, renderEnd);
  const timelineWidth = totalDays * SEGMENT_WIDTH;
  const timelineHeight = rows.length * SEGMENT_HEIGHT;
  const todayLeft = daysBetween(renderStart, today) * SEGMENT_WIDTH;

  // On mount: center today in the viewport
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = todayLeft - el.clientWidth / 2;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || adjusting.current) return;

    // Near left edge → extend rendering range to the left, compensate scrollLeft
    if (el.scrollLeft < SCROLL_THRESHOLD) {
      adjusting.current = true;
      flushSync(() => setRenderStart((prev) => addDays(prev, -EXTEND_DAYS)));
      el.scrollLeft += EXTEND_DAYS * SEGMENT_WIDTH;
      requestAnimationFrame(() => {
        adjusting.current = false;
      });
      return;
    }

    // Near right edge → extend rendering range to the right
    if (el.scrollLeft + el.clientWidth > el.scrollWidth - SCROLL_THRESHOLD) {
      setRenderEnd((prev) => addDays(prev, EXTEND_DAYS));
    }
  };

  // Month row: one segment per calendar month
  const monthSegments: { left: number; width: number; label: string }[] = [];
  let segStart = 0;
  for (let day = 1; day <= totalDays; day++) {
    const prev = addDays(renderStart, day - 1);
    const curr = day < totalDays ? addDays(renderStart, day) : null;
    const monthChanged =
      !curr ||
      curr.getMonth() !== prev.getMonth() ||
      curr.getFullYear() !== prev.getFullYear();
    if (monthChanged) {
      monthSegments.push({
        left: segStart * SEGMENT_WIDTH,
        width: (day - segStart) * SEGMENT_WIDTH,
        label: `${MONTHS[prev.getMonth()]} ${prev.getFullYear()}`,
      });
      segStart = day;
    }
  }

  // Day row: one cell per day
  const todayDayIndex = daysBetween(renderStart, today);
  const dayLabels: { left: number; label: string; isToday: boolean }[] = [];
  for (let day = 0; day < totalDays; day++) {
    dayLabels.push({
      left: day * SEGMENT_WIDTH,
      label: String(addDays(renderStart, day).getDate()),
      isToday: day === todayDayIndex,
    });
  }

  const gridStyle = getTimelineGridStyle(totalDays, rows.length);

  return (
    <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white">
      {/* Table */}
      <div
        style={{ width: LEFT_PANEL_WIDTH }}
        className="shrink-0 border-r border-slate-200 bg-white z-10"
      >
        <div
          style={{ height: DATE_HEADER_HEIGHT }}
          className="border-b border-slate-200 bg-slate-50"
        />

        {rows.map((row, i) => (
          <div
            key={i}
            style={{ height: SEGMENT_HEIGHT }}
            className={`flex items-center px-3 border-b border-slate-100 overflow-hidden ${
              row.kind === 'header' ? 'bg-slate-50' : 'bg-white'
            }`}
          >
            {row.kind === 'header' ? (
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
                {row.taskList.name}
              </span>
            ) : (
              <span className="text-sm text-slate-600 pl-3 truncate">
                {row.task.name}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div ref={scrollRef} className="flex-1 overflow-x-auto" onScroll={handleScroll}>
        <div
          className="relative border-b border-slate-200"
          style={{ width: timelineWidth, height: DATE_HEADER_HEIGHT }}
        >
          <div
            className="absolute inset-x-0 top-0 bg-slate-100 border-b border-slate-200"
            style={{ height: MONTH_ROW_HEIGHT }}
          >
            {monthSegments.map(({ left, width, label }) => (
              <div
                key={left}
                className="absolute inset-y-0 flex items-center px-2 border-r border-slate-200 overflow-hidden"
                style={{ left, width }}
              >
                <span className="text-xs font-semibold text-slate-600 truncate">
                  {label}
                </span>
              </div>
            ))}
          </div>

          <div
            className="absolute inset-x-0 bg-slate-50 border-b border-slate-200"
            style={{ top: MONTH_ROW_HEIGHT, height: DAY_ROW_HEIGHT }}
          >
            <div
              className="absolute inset-y-0 bg-indigo-100"
              style={{ left: todayLeft, width: SEGMENT_WIDTH }}
            />
            {dayLabels.map(({ left, label, isToday }) => (
              <div
                key={left}
                className="absolute inset-y-0 flex items-center justify-center border-r border-slate-100"
                style={{ left, width: SEGMENT_WIDTH }}
              >
                <span
                  className={`text-xs leading-none ${
                    isToday ? 'font-bold text-indigo-600' : 'text-slate-400'
                  }`}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div style={gridStyle}>
          <div
            className="absolute top-0 bg-indigo-50 pointer-events-none"
            style={{
              left: todayLeft,
              width: SEGMENT_WIDTH,
              height: timelineHeight,
              opacity: 0.6,
            }}
          />
          {/* Today center line */}
          <div
            className="absolute top-0 bg-indigo-300 pointer-events-none"
            style={{
              left: todayLeft + Math.floor(SEGMENT_WIDTH / 2),
              width: 1,
              height: timelineHeight,
            }}
          />

          {/* Header row backgrounds (rendered before entries so entries sit on top) */}
          {rows.map((row, i) =>
            row.kind === 'header' ? (
              <div
                key={`hbg-${i}`}
                className="absolute bg-slate-50 pointer-events-none"
                style={{
                  top: i * SEGMENT_HEIGHT,
                  left: 0,
                  width: timelineWidth,
                  height: SEGMENT_HEIGHT,
                }}
              />
            ) : null,
          )}

          {/* Task entries */}
          {rows.map((row, i) => {
            if (row.kind !== 'task') return null;
            const style = getEntryStyle(row.task, renderStart, i);
            if (!style) return null;
            return (
              <div
                key={row.task.id}
                style={style}
                title={`${row.task.name}${row.task.startDate ? ` · ${row.task.startDate}` : ''} → ${row.task.dueDate ?? ''}`}
                className={`rounded text-xs flex items-center px-2 overflow-hidden cursor-default select-none ${entryClass(row.task, todayStr)}`}
              >
                <span className="truncate">{row.task.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
