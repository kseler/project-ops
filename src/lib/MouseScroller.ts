export interface MouseScrollerOptions {
  direction: 'horizontal' | 'vertical';
  /** px from the edge where scrolling starts, default 60 */
  threshold?: number;
  /** max px scrolled per frame, default 12 */
  speed?: number;
  /** px at the start edge covered by sticky content (e.g. a frozen column), default 0 */
  insetStart?: number;
}

/**
 * Tracks the mouse against a scrollable element and auto-scrolls toward the
 * nearest edge while enabled.  Speed ramps linearly — fastest at the edge,
 * zero at the threshold boundary.
 *
 * Usage:
 *   const scroller = new MouseScroller(el, { direction: 'horizontal' });
 *   scroller.enable();   // start (e.g. on drag start)
 *   scroller.disable();  // stop  (e.g. on drag end)
 *   scroller.destroy();  // full teardown
 */
export class MouseScroller {
  private readonly el: HTMLElement;
  private readonly direction: 'horizontal' | 'vertical';
  private readonly threshold: number;
  private readonly speed: number;
  private readonly insetStart: number;

  private mouseX = 0;
  private mouseY = 0;
  private rafId: number | null = null;
  private active = false;

  constructor(el: HTMLElement, options: MouseScrollerOptions) {
    this.el = el;
    this.direction = options.direction;
    this.threshold = options.threshold ?? 60;
    this.speed = options.speed ?? 12;
    this.insetStart = options.insetStart ?? 0;
  }

  enable(): void {
    if (this.active) return;
    this.active = true;
    window.addEventListener('mousemove', this.onMouseMove);
    this.rafId = requestAnimationFrame(this.tick);
  }

  disable(): void {
    if (!this.active) return;
    this.active = false;
    window.removeEventListener('mousemove', this.onMouseMove);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy(): void {
    this.disable();
  }

  private onMouseMove = (e: MouseEvent): void => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  };

  private tick = (): void => {
    if (!this.active) return;

    const rect = this.el.getBoundingClientRect();
    const horizontal = this.direction === 'horizontal';
    const delta = this.scrollDelta(
      (horizontal ? this.mouseX - rect.left : this.mouseY - rect.top) - this.insetStart,
      (horizontal ? rect.width : rect.height) - this.insetStart,
    );

    if (delta !== 0) {
      if (horizontal) this.el.scrollLeft += delta;
      else this.el.scrollTop += delta;
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  // rel: pointer position measured from the start of the visible scroll area; size: that area's length
  private scrollDelta(rel: number, size: number): number {
    const { threshold, speed, insetStart } = this;

    if (rel < -insetStart || rel > size) return 0;
    // over the inset (sticky) area counts as past the start edge, so full speed
    if (rel < threshold) return -speed * Math.min(1, 1 - rel / threshold);
    if (rel > size - threshold) return speed * (1 - (size - rel) / threshold);
    return 0;
  }
}
