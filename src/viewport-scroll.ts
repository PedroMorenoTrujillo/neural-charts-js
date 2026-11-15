import type { PlanViewportState } from '@neural-charts/core';

/** Read the magnification from the applied viewport, in the scale's own units. */
export function viewportZoomLevel(state: PlanViewportState): number {
  let level = 1;
  for (const axis of ['x', 'y'] as const) {
    if (state.axes !== axis && state.axes !== 'xy') continue;
    const bounds = state.bounds[axis], window = state.value[axis];
    if (!window) continue;
    if (bounds.type === 'category' && 'firstId' in window) {
      const start = bounds.ids.indexOf(window.firstId), end = bounds.ids.indexOf(window.lastId);
      if (start >= 0 && end >= start) level = Math.max(level, bounds.ids.length / (end - start + 1));
    } else if (bounds.type !== 'category' && bounds.domain && 'length' in window) {
      const coordinate = bounds.type === 'log' ? Math.log : (value: number) => value;
      const ratio = (coordinate(bounds.domain[1]) - coordinate(bounds.domain[0])) /
        (coordinate(window[1]) - coordinate(window[0]));
      if (Number.isFinite(ratio)) level = Math.max(level, ratio);
    }
  }
  return level;
}

/** Translate the horizontal thumb position into a Core pan intent, including transposed plots. */
export function horizontalViewportScroll(state: PlanViewportState, transposed: boolean) {
  const axis = transposed ? 'y' : 'x';
  if (state.axes !== axis && state.axes !== 'xy') return;
  const bounds = state.bounds[axis], reversed = state.reversed[axis];
  let start: number, span: number, full: number, step: number, panSpan: number;
  if (bounds.type === 'category') {
    const value = state.value.x;
    if (!value || !('firstId' in value)) return;
    start = bounds.ids.indexOf(value.firstId);
    const end = bounds.ids.indexOf(value.lastId);
    if (start < 0 || end < start) return;
    span = end - start + 1;
    full = bounds.ids.length;
    step = 1;
    panSpan = span === 1 ? 1 : span - 1 + 2 * bounds.edgeSpacing;
  } else {
    const window = state.displayed[axis], domain = bounds.domain;
    if (!window || !domain) return;
    const coordinate = bounds.type === 'log' ? Math.log : (value: number) => value;
    start = coordinate(window[0]) - coordinate(domain[0]);
    span = coordinate(window[1]) - coordinate(window[0]);
    full = coordinate(domain[1]) - coordinate(domain[0]);
    step = (full - span) / 1000;
    panSpan = span;
  }
  const travel = full - span;
  if (!(span > 0 && travel > full * 1e-12 && step > 0) || !Number.isFinite(full)) return;
  const max = bounds.type === 'category' ? travel : 1000;
  const offset = Math.max(0, Math.min(max, start / step));
  return {
    axis, max, position: Math.round(reversed ? max - offset : offset), visible: span / full,
    delta: (position: number) => ((reversed ? max - position : position) * step - start) / panSpan,
  };
}
