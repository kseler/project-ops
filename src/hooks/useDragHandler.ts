import { useEffect, useRef } from 'react';

export interface DragState<TObject = unknown>  {
  dragId: string;
  element: Element;
  object: TObject;
  initialPointerX: number;
  initialPointerY: number;
  currentPointerX: number;
  currentPointerY: number;
}

export interface DragHandlerCallbacks<TObject = unknown>  {
  onDragStart?: (drag: DragState<TObject>) => boolean;
  onDrag?: (drag: DragState<TObject>) => void;
  onDragEnd?: (drag: DragState<TObject>) => void;
}

const DRAG_THRESHOLD = 3;

export function useDragHandler<TObject = unknown>(callbacks: DragHandlerCallbacks<TObject>): void {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    type Pending = {
      element: Element;
      dragId: string;
      object: TObject;
      startX: number;
      startY: number;
    };

    let pending: Pending | null = null;
    let active: DragState<TObject>| null = null;

    function onMouseDown(e: MouseEvent) {
      let el: Element | null = e.target as Element;
      while (el) {
        const dragId = el.getAttribute('data-drag-id');
        if (dragId) {
          const raw = el.getAttribute('data-drag-object');
          pending = {
            element: el,
            dragId,
            object: raw ? (JSON.parse(raw)) : {},
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

        const drag: DragState<TObject> = {
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
