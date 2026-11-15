import type { PlanFrame, PlanViewportIntent, PlanViewportState } from '@neural-charts/core';
import type { ChartOptions } from './types.js';
import { plotBounds } from './svg.js';
import { bindListeners } from './listeners.js';

/** Physical coordinates only. Core transforms/clamps the represented data window. */
export function gestureIntent(state: PlanViewportState, bar: boolean, box: Readonly<{ left: number; top: number; width: number; height: number }>, x: number, y: number, dx: number, dy: number, factor: number): PlanViewportIntent {
  const axisX = bar ? 'y' : 'x', axisY = bar ? 'x' : 'y', positiveX = !state.reversed[axisX], positiveY = bar ? !state.reversed.x : state.reversed.y;
  const anchor: { x?: number; y?: number } = {}, delta: { x?: number; y?: number } = {}, clamp = (v: number) => Math.max(0, Math.min(1, v));
  if (state.axes === 'xy' || state.axes === axisX) { const f = clamp((x - box.left) / box.width); anchor[axisX] = positiveX ? f : 1 - f; delta[axisX] = -dx / box.width * (positiveX ? 1 : -1); }
  if (state.axes === 'xy' || state.axes === axisY) { const f = clamp((y - box.top) / box.height); anchor[axisY] = positiveY ? f : 1 - f; delta[axisY] = -dy / box.height * (positiveY ? 1 : -1); }
  return { type: 'transform', factor, anchor, delta };
}
export function viewportInput(target: HTMLElement, get: () => Readonly<{ frame: PlanFrame; options: ChartOptions }>, commit: (intent: PlanViewportIntent, state: PlanViewportState) => void, start: () => void) {
  const window = target.ownerDocument.defaultView!, points = new Map<number, Readonly<{ x: number; y: number }>>();
  let session: { state: PlanViewportState; box: { left: number; top: number; width: number; height: number }; x: number; y: number; distance: number; dx: number; dy: number; scale: number; bar: boolean } | undefined;
  let frameId = 0, wheelTimer = 0, suppress = false, disposed = false;
  const viewportOptions = () => {
    const {options, frame} = get();
    return frame.viewport ? options.viewport : undefined;
  };
  const previewNode = () => target.querySelector<SVGGElement>('[data-layer="geometry"]');
  function sample() {
    const touches = points.values(), a = touches.next().value;
    if (!a) return undefined;
    const b = touches.next().value ?? a;
    return {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))};
  }
  function begin(x: number, y: number, distance: number): boolean {
    const { frame, options } = get(), svg = target.querySelector('svg'); if (!options.viewport || !frame.viewport || !svg) return false;
    const box = svg.getBoundingClientRect(), inset = plotBounds(frame, options), plot = frame.viewport.plot ?? { x: 0, y: 0, width: frame.width, height: frame.height }, sx = box.width / inset.width, sy = box.height / inset.height;
    const bounds = { left: box.left + (inset.left + plot.x) * sx, top: box.top + (inset.top + plot.y) * sy, width: plot.width * sx, height: plot.height * sy };
    if (bounds.width <= 0 || bounds.height <= 0) return false;
    session = { state: frame.viewport, box: bounds, x, y, distance, dx: 0, dy: 0, scale: 1, bar: frame.family === 'bar' || frame.family === 'vbp' }; start(); return true;
  }
  function preview(): void {
    frameId = 0; const node = previewNode(), s = session; if (!node || !s) return;
    const svg = target.querySelector('svg')!, rect = svg.getBoundingClientRect(), {frame, options} = get(), inset = plotBounds(frame, options), ratio = inset.width / rect.width;
    const horizontal = s.state.axes === 'xy' || s.state.axes === (s.bar ? 'y' : 'x'), vertical = s.state.axes === 'xy' || s.state.axes === (s.bar ? 'x' : 'y');
    const x = (s.x - rect.left) * ratio - inset.left, y = (s.y - rect.top) * ratio - inset.top, sx = horizontal ? s.scale : 1, sy = vertical ? s.scale : 1;
    node.setAttribute('transform', `translate(${horizontal ? s.dx * ratio : 0},${vertical ? s.dy * ratio : 0}) translate(${x},${y}) scale(${sx},${sy}) translate(${-x},${-y})`);
  }
  function queue(): void { if (!frameId) frameId = window.requestAnimationFrame(preview); }
  function clear(): void { if (frameId) window.cancelAnimationFrame(frameId); if (wheelTimer) window.clearTimeout(wheelTimer); frameId = wheelTimer = 0; previewNode()?.removeAttribute('transform'); }
  function releasePointer(id: number): void {
    if (target.hasPointerCapture(id)) target.releasePointerCapture(id);
  }
  function resetGesture(): void {
    clear();
    session = undefined;
    for (const id of points.keys()) releasePointer(id);
    points.clear();
  }
  function cancel(): void {
    resetGesture();
    suppress = false;
  }
  function finish(): void {
    const s = session;
    resetGesture();
    if (s && !disposed) commit(gestureIntent(s.state, s.bar, s.box, s.x, s.y, s.dx, s.dy, s.scale), s.state);
  }
  const down = (event: PointerEvent) => {
    const viewport = viewportOptions(), isTouch = event.pointerType === 'touch';
    if (!viewport || !isTouch && event.button !== 0) return;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (isTouch && points.size < 2) return;
    if (points.size > 2) { cancel(); suppress = true; return; }
    if (viewport.pan === false && (!isTouch || viewport.pinch === false)) return;
    const p = sample(); if (p && begin(p.x, p.y, p.distance) && isTouch) { for (const id of points.keys()) target.setPointerCapture(id); suppress = true; event.preventDefault(); }
  };
  const move = (event: PointerEvent) => {
    if (!points.has(event.pointerId)) return;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const s = session;
    if (!s) return;
    const p = sample()!, viewport = get().options.viewport;
    const canPan = viewport?.pan !== false;
    s.dx = canPan ? p.x - s.x : 0;
    s.dy = canPan ? p.y - s.y : 0;
    s.scale = points.size > 1 && viewport?.pinch !== false ? Math.max(.25, Math.min(4, p.distance / s.distance)) : 1;
    if (Math.hypot(s.dx, s.dy) > 4 || Math.abs(s.scale - 1) > .01) { suppress = true; if (!target.hasPointerCapture(event.pointerId)) target.setPointerCapture(event.pointerId); queue(); event.preventDefault(); }
  };
  const up = (event: PointerEvent) => { if (!points.delete(event.pointerId)) return; releasePointer(event.pointerId); if (session) { if (suppress) finish(); else { clear(); session = undefined; } } };
  const touch = (event: TouchEvent) => { const viewport = viewportOptions(); if (viewport && event.touches.length >= 2 && (viewport.pan !== false || viewport.pinch !== false)) event.preventDefault(); };
  const wheel = (event: WheelEvent) => {
    const viewport = viewportOptions(), setting = viewport?.wheel;
    if (!viewport || setting === false || setting !== 'always' && !event.ctrlKey && !event.metaKey) return;
    event.preventDefault(); if (!session && !begin(event.clientX, event.clientY, 1)) return;
    session!.scale = Math.max(.25, Math.min(4, session!.scale * Math.exp(-Math.max(-500, Math.min(500, event.deltaY)) * .002))); queue();
    if (wheelTimer) window.clearTimeout(wheelTimer); wheelTimer = window.setTimeout(finish, 120);
  };
  const consumeClick = (event: MouseEvent) => { if (suppress) { suppress = false; event.preventDefault(); event.stopPropagation(); } };
  const removeListeners = bindListeners([
    [target, 'pointerdown', down],
    [target, 'pointermove', move],
    [target, 'pointerup', up],
    [target, 'pointercancel', cancel],
    [target, 'touchstart', touch, {passive: false}],
    [target, 'wheel', wheel, {passive: false}],
    [target, 'click', consumeClick, true],
  ]);
  return { cancel, active: () => !!session, destroy() { disposed = true; cancel(); removeListeners(); } };
}
