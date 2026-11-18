import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MouseScroller } from '@/lib/MouseScroller';

let frames: FrameRequestCallback[] = [];

function runFrame() {
  const pending = frames;
  frames = [];
  pending.forEach((cb) => cb(0));
}

function makeScrollElement() {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ left: 100, top: 0, width: 1000, height: 400, right: 1100, bottom: 400 }) as DOMRect;
  el.scrollLeft = 500;
  return el;
}

function moveMouseTo(clientX: number) {
  window.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY: 200 }));
}

describe('MouseScroller (horizontal)', () => {
  beforeEach(() => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not scroll while the pointer is away from the edges', () => {
    const el = makeScrollElement();
    const scroller = new MouseScroller(el, { direction: 'horizontal', threshold: 60, speed: 12 });
    scroller.enable();
    moveMouseTo(600);
    runFrame();

    expect(el.scrollLeft).toBe(500);
    scroller.destroy();
  });

  it('scrolls faster the closer the pointer is to the edge', () => {
    const el = makeScrollElement();
    const scroller = new MouseScroller(el, { direction: 'horizontal', threshold: 60, speed: 12 });
    scroller.enable();

    moveMouseTo(1100 - 30); // halfway into the right threshold
    runFrame();
    expect(el.scrollLeft).toBe(506);

    moveMouseTo(1100); // right on the edge
    runFrame();
    expect(el.scrollLeft).toBe(518);
    scroller.destroy();
  });

  it('starts the left scroll zone after the inset (sticky column)', () => {
    const el = makeScrollElement();
    const scroller = new MouseScroller(el, { direction: 'horizontal', threshold: 60, speed: 12, insetStart: 256 });
    scroller.enable();

    moveMouseTo(100 + 256 + 100); // inside the timeline, beyond the threshold
    runFrame();
    expect(el.scrollLeft).toBe(500);

    moveMouseTo(100 + 256 + 30); // halfway into the threshold after the inset
    runFrame();
    expect(el.scrollLeft).toBe(494);
    scroller.destroy();
  });

  it('scrolls at full speed when the pointer is over the inset area', () => {
    const el = makeScrollElement();
    const scroller = new MouseScroller(el, { direction: 'horizontal', threshold: 60, speed: 12, insetStart: 256 });
    scroller.enable();

    moveMouseTo(100 + 50); // over the sticky column
    runFrame();
    expect(el.scrollLeft).toBe(488);
    scroller.destroy();
  });

  it('stops scrolling outside the element and after disable', () => {
    const el = makeScrollElement();
    const scroller = new MouseScroller(el, { direction: 'horizontal', threshold: 60, speed: 12, insetStart: 256 });
    scroller.enable();

    moveMouseTo(50); // left of the element entirely
    runFrame();
    expect(el.scrollLeft).toBe(500);

    scroller.disable();
    moveMouseTo(1100);
    runFrame();
    expect(el.scrollLeft).toBe(500);
  });
});
