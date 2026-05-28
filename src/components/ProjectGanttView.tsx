import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { updateTask } from '../lib/api';
import {
  addDays,
  applyDragOffset,
  daysBetween,
  getEntryStyle,
  getTimelineGridStyle,
  SEGMENT_HEIGHT,
  SEGMENT_WIDTH,
} from '../lib/ganttUtils';
import { useProjectDetail } from '../lib/store';
import type { Task, TaskList } from '../lib/types';
import { useDragHandler } from '../lib/useDragHandler';
import { GanttTaskBar } from './GanttTaskBar';

// ─── Constants ────────────────────────────────────────────────────────────────

const LEFT_PANEL_WIDTH = 256;
const MONTH_ROW_HEIGHT = 22;
const DAY_ROW_HEIGHT = 22;
const DATE_HEADER_HEIGHT = MONTH_ROW_HEIGHT + DAY_ROW_HEIGHT;
const INITIAL_BUFFER_DAYS = 180;
const EXTEND_DAYS = 90;
const SCROLL_THRESHOLD = 400;
const DAY_BUFFER = 30;

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

const DRAG_IDS = ['task-move', 'task-resize-left', 'task-resize-right'] as const;

type Row = { kind: 'header'; taskList: TaskList } | { kind: 'task'; task: Task };

export function ProjectGanttView() {
  const { taskLists, patchTask } = useProjectDetail();

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);
  const [renderStart, setRenderStart] = useState(() =>
    addDays(today, -INITIAL_BUFFER_DAYS),
  );
  const [renderEnd, setRenderEnd] = useState(() => addDays(today, INITIAL_BUFFER_DAYS));

  const scrollRef = useRef<HTMLDivElement>(null);
  const adjusting = useRef(false);

  const rows = useMemo<Row[]>(
    () =>
      taskLists.flatMap((tl) => [
        { kind: 'header' as const, taskList: tl },
        ...tl.tasks.map((task) => ({ kind: 'task' as const, task })),
      ]),
    [taskLists],
  );

  const totalDays = useMemo(
    () => daysBetween(renderStart, renderEnd),
    [renderStart, renderEnd],
  );
  const timelineWidth = totalDays * SEGMENT_WIDTH;
  const timelineHeight = rows.length * SEGMENT_HEIGHT;

  const todayDayIndex = useMemo(
    () => daysBetween(renderStart, today),
    [renderStart, today],
  );
  const todayLeft = todayDayIndex * SEGMENT_WIDTH;

  const totalDaysRef = useRef(totalDays);
  totalDaysRef.current = totalDays;

  // ── Month segments ─────────────────────────────────────────────────────────
  const monthSegments = useMemo(() => {
    const segments: { left: number; width: number; label: string }[] = [];
    let segStart = 0;
    for (let day = 1; day <= totalDays; day++) {
      const prev = addDays(renderStart, day - 1);
      const curr = day < totalDays ? addDays(renderStart, day) : null;
      const changed =
        !curr ||
        curr.getMonth() !== prev.getMonth() ||
        curr.getFullYear() !== prev.getFullYear();
      if (changed) {
        segments.push({
          left: segStart * SEGMENT_WIDTH,
          width: (day - segStart) * SEGMENT_WIDTH,
          label: `${MONTHS[prev.getMonth()]} ${prev.getFullYear()}`,
        });
        segStart = day;
      }
    }
    return segments;
  }, [renderStart, totalDays]);

  // ── Day labels ─────────────────────────────────────────────────────────────
  const dayLabels = useMemo(() => {
    const labels: { left: number; label: string; isToday: boolean }[] = [];
    for (let day = 0; day < totalDays; day++) {
      labels.push({
        left: day * SEGMENT_WIDTH,
        label: String(addDays(renderStart, day).getDate()),
        isToday: day === todayDayIndex,
      });
    }
    return labels;
  }, [renderStart, totalDays, todayDayIndex]);

  const gridStyle = useMemo(
    () => getTimelineGridStyle(totalDays, rows.length),
    [totalDays, rows.length],
  );

  // ── Virtual window ─────────────────────────────────────────────────────────
  const [visiblePxRange, setVisiblePxRange] = useState<[number, number]>(() => {
    const centerPx = INITIAL_BUFFER_DAYS * SEGMENT_WIDTH;
    const approxViewportPx = 60 * SEGMENT_WIDTH;
    return [
      Math.max(0, centerPx - approxViewportPx / 2 - DAY_BUFFER * SEGMENT_WIDTH),
      centerPx + approxViewportPx / 2 + DAY_BUFFER * SEGMENT_WIDTH,
    ];
  });

  const visibleDayLabels = useMemo(
    () =>
      dayLabels.filter((d) => d.left >= visiblePxRange[0] && d.left <= visiblePxRange[1]),
    [dayLabels, visiblePxRange],
  );

  // ── Initial scroll ─────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = todayLeft - el.clientWidth / 2;
    setVisiblePxRange([
      Math.max(0, el.scrollLeft - DAY_BUFFER * SEGMENT_WIDTH),
      el.scrollLeft + el.clientWidth + DAY_BUFFER * SEGMENT_WIDTH,
    ]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll handler ─────────────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || adjusting.current) return;

    if (el.scrollLeft < SCROLL_THRESHOLD) {
      adjusting.current = true;
      flushSync(() => setRenderStart((prev) => addDays(prev, -EXTEND_DAYS)));
      el.scrollLeft += EXTEND_DAYS * SEGMENT_WIDTH;
      setVisiblePxRange([
        Math.max(0, el.scrollLeft - DAY_BUFFER * SEGMENT_WIDTH),
        el.scrollLeft + el.clientWidth + DAY_BUFFER * SEGMENT_WIDTH,
      ]);
      requestAnimationFrame(() => {
        adjusting.current = false;
      });
      return;
    }

    if (el.scrollLeft + el.clientWidth > el.scrollWidth - SCROLL_THRESHOLD) {
      setRenderEnd((prev) => addDays(prev, EXTEND_DAYS));
    }

    const { scrollLeft, clientWidth } = el;
    setVisiblePxRange((prev) => {
      if (scrollLeft >= prev[0] && scrollLeft + clientWidth <= prev[1]) return prev;
      return [
        Math.max(0, scrollLeft - DAY_BUFFER * SEGMENT_WIDTH),
        Math.min(
          totalDaysRef.current * SEGMENT_WIDTH,
          scrollLeft + clientWidth + DAY_BUFFER * SEGMENT_WIDTH,
        ),
      ];
    });
  }, []);

  // ── Drag ───────────────────────────────────────────────────────────────────
  // drag.object is a full Task snapshot captured at mousedown — no store lookup needed.
  // onDrag computes from the original dates + pointer delta and writes straight to the store.
  // onDragEnd uses the same snapshot + final delta to persist to the server.

  useDragHandler({
    onDragStart(drag) {
      return (DRAG_IDS as readonly string[]).includes(drag.dragId);
    },
    onDrag(drag) {
      const task = drag.object as Task;
      const offsetDays = Math.round(
        (drag.currentPointerX - drag.initialPointerX) / SEGMENT_WIDTH,
      );
      patchTask(applyDragOffset(task, drag.dragId, offsetDays));
    },
    onDragEnd(drag) {
      const task = drag.object as Task;
      const offsetDays = Math.round(
        (drag.currentPointerX - drag.initialPointerX) / SEGMENT_WIDTH,
      );
      if (offsetDays === 0) return;

      const updated = applyDragOffset(task, drag.dragId, offsetDays);

      if (updated === task) return;

      updateTask(task.id, { ...updated }).catch(console.error);
    },
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white">
      {/* ── Left panel ───────────────────────────────────────────────────────── */}
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

      {/* ── Timeline ─────────────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-x-auto" onScroll={handleScroll}>
        {/* Date header */}
        <div
          className="relative border-b border-slate-200"
          style={{ width: timelineWidth, height: DATE_HEADER_HEIGHT }}
        >
          {/* Month row */}
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

          {/* Day row — only visible window rendered */}
          <div
            className="absolute inset-x-0 bg-slate-50 border-b border-slate-200"
            style={{ top: MONTH_ROW_HEIGHT, height: DAY_ROW_HEIGHT }}
          >
            <div
              className="absolute inset-y-0 bg-indigo-100"
              style={{ left: todayLeft, width: SEGMENT_WIDTH }}
            />
            {visibleDayLabels.map(({ left, label, isToday }) => (
              <div
                key={left}
                className="absolute inset-y-0 flex items-center justify-center border-r border-slate-100"
                style={{ left, width: SEGMENT_WIDTH }}
              >
                <span
                  className={`text-xs leading-none ${isToday ? 'font-bold text-indigo-600' : 'text-slate-400'}`}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div style={gridStyle}>
          {/* Today column tint */}
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

          {/* Header row backgrounds */}
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
            return <GanttTaskBar key={row.task.id} task={row.task} style={style} />;
          })}
        </div>
      </div>
    </div>
  );
}
