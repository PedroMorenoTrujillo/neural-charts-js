import type { PlanFrame } from '@neural-charts/core';
import type { ChartOptions } from './types.js';

// MediaQueryList.matches stays live; share one query per Window without a listener.
const motionPreferences=new WeakMap<Window,MediaQueryList>();
function prefersReducedMotion(window:Window):boolean{
  let query=motionPreferences.get(window);if(!query){query=window.matchMedia('(prefers-reduced-motion: reduce)');motionPreferences.set(window,query);}return query.matches;
}

/** Owns at most one Web Animation. No timers, DOM copies or geometry interpolation. */
export function chartMotion(window: Window, target: HTMLElement, getFrame: () => PlanFrame) {
  let current: Animation | undefined, initialized = false, disposed = false;
  const cancel = () => { current?.cancel(); current = undefined; };
  return {
    apply(options: ChartOptions, changed: boolean): void {
      cancel(); const initial = !initialized; initialized = true;
      if (disposed || !changed || !options.animation?.enabled || prefersReducedMotion(window) || typeof target.animate !== 'function') return;
      const duration = options.animation.duration ?? (initial ? 240 : 160);
      if (!duration) return;
      const frame = getFrame();
      const marks = target.querySelector<SVGGElement>('[data-layer="marks"]');
      if (!marks || !frame.observations.length) return;
      const geometry = marks.querySelector<SVGGElement>('[data-layer="geometry"]') ?? marks;
      let keyframes: Keyframe[];
      if (frame.family === 'bar' || frame.family === 'column') {
        const horizontal = frame.family === 'bar';
        const zero = horizontal ? frame.labels.find(tick => tick.value === 0)?.x : frame.grid.find(tick => tick.value === 0)?.y;
        const bounds = geometry.getBBox();
        const origin = horizontal ? `${(zero ?? 0) - bounds.x}px 0px` : `0px ${(zero ?? frame.height) - bounds.y}px`;
        keyframes = [
          { transformBox: 'fill-box', transformOrigin: origin, transform: horizontal ? 'scaleX(0)' : 'scaleY(0)' },
          { transformBox: 'fill-box', transformOrigin: origin, transform: 'scale(1)' },
        ];
      } else if (['pie', 'donut', 'variablepie', 'sunburst', 'radar', 'polar', 'gauge', 'radialbar', 'windrose'].includes(frame.family)) {
        keyframes = [{ clipPath: 'circle(0%)' }, { clipPath: 'circle(72%)' }];
      } else if (['line', 'spline', 'area', 'areaspline', 'streamgraph', 'mixed', 'fan'].includes(frame.family)) {
        const start = options.direction === 'rtl' ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)';
        keyframes = [{ clipPath: start }, { clipPath: 'inset(0)' }];
      } else {
        keyframes = [{ opacity: initial ? 0 : .55 }, { opacity: 1 }];
      }
      const animation = geometry.animate(keyframes, { duration, easing: 'linear' });
      current = animation;
      animation.onfinish = () => { if (current === animation) current = undefined; animation.cancel(); };
    },
    cancel,
    destroy(): void { disposed = true; cancel(); },
  };
}
