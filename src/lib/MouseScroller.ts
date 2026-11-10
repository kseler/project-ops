export interface MouseScrollerOptions {
  direction: 'horizontal' | 'vertical';
  /** px from the edge where scrolling starts, default 60 */
  threshold?: number;
  /** max px scrolled per frame, default 12 */
  speed?: number;
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

  private mouseX = 0;
  private mouseY = 0;
  private rafId: number | null = null;
  private active = false;

  constructor(el: HTMLElement, options: MouseScrollerOptions) {
    this.el = el;
    this.direction = options.direction;
    this.threshold = options.threshold ?? 60;
    this.speed = options.speed ?? 12;
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
    const { threshold, speed } = this;

    if (this.direction === 'horizontal') {
      const rel = this.mouseX - rect.left;
      if (rel >= 0 && rel < threshold) {
        this.el.scrollLeft -= speed * (1 - rel / threshold);
      } else if (rel > rect.width - threshold && rel <= rect.width) {
        this.el.scrollLeft += speed * (1 - (rect.width - rel) / threshold);
      }
    } else {
      const rel = this.mouseY - rect.top;
      if (rel >= 0 && rel < threshold) {
        this.el.scrollTop -= speed * (1 - rel / threshold);
      } else if (rel > rect.height - threshold && rel <= rect.height) {
        this.el.scrollTop += speed * (1 - (rect.height - rel) / threshold);
      }
    }

    this.rafId = requestAnimationFrame(this.tick);
  };
}
