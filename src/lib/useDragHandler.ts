import { useEffect, useRef } from 'react';

export interface DragObject {
  [key: string]: unknown;
}

export interface DragState {
  dragId: string;
  element: Element;
  object: DragObject;
  initialPointerX: number;
  initialPointerY: number;
  currentPointerX: number;
  currentPointerY: number;
}

export interface DragHandlerCallbacks {
  onDragStart?: (drag: DragState) => boolean;
  onDrag?: (drag: DragState) => void;
  onDragEnd?: (drag: DragState) => void;
}

const DRAG_THRESHOLD = 3;

export function useDragHandler(callbacks: DragHandlerCallbacks): void {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    type Pending = {
      element: Element;
      dragId: string;
      object: DragObject;
      startX: number;
      startY: number;
    };

    let pending: Pending | null = null;
    let active: DragState | null = null;

    function onMouseDown(e: MouseEvent) {
      let el: Element | null = e.target as Element;
      while (el) {
        const dragId = el.getAttribute('data-drag-id');
        if (dragId) {
          const raw = el.getAttribute('data-drag-object');
          pending = {
            element: el,
            dragId,
            object: raw ? (JSON.parse(raw) as DragObject) : {},
            startX: e.clientX,
            startY: e.clientY,
          };
          return;
        }
        el = el.parentElement;
      }
    }

    function onMouseMove(e: MouseEvent) {
      if (!pending && !active) return;

      if (pending) {
        const dx = Math.abs(e.clientX - pending.startX);
        const dy = Math.abs(e.clientY - pending.startY);
        if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) return;

        const drag: DragState = {
          dragId: pending.dragId,
          element: pending.element,
          object: pending.object,
          initialPointerX: pending.startX,
          initialPointerY: pending.startY,
          currentPointerX: e.clientX,
          currentPointerY: e.clientY,
        };
        pending = null;

        const accepted = cbRef.current.onDragStart?.(drag) ?? true;
        if (!accepted) return;

        active = drag;
        document.body.style.userSelect = 'none';
      }

      if (active) {
        active = { ...active, currentPointerX: e.clientX, currentPointerY: e.clientY };
        cbRef.current.onDrag?.(active);
        e.preventDefault();
      }
    }

    function onMouseUp(e: MouseEvent) {
      if (active) {
        active = { ...active, currentPointerX: e.clientX, currentPointerY: e.clientY };
        cbRef.current.onDragEnd?.(active);
        document.body.style.userSelect = '';
        active = null;
      }
      pending = null;
    }

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
    };
  }, []);
}
