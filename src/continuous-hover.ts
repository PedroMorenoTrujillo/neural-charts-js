import type { PlanFrame, PlanObservation } from '@neural-charts/core';
import { observationDetails } from './observation-shape.js';

const continuousFamilies = new Set<PlanFrame['family']>([
  'line', 'spline', 'area', 'areaspline', 'arearange', 'areasplinerange',
]);

export function prepareContinuousHover(frame: PlanFrame) {
  if (!continuousFamilies.has(frame.family) || frame.observations.length === 0) return;
  const columns = new Map<number, PlanObservation[]>();
  for (const point of frame.observations) {
    const column = columns.get(point.x);
    if (column) column.push(point);
    else columns.set(point.x, [point]);
  }
  const positions = [...columns.keys()].sort((a, b) => a - b);
  const detail = observationDetails(frame);

  return (x: number, y: number): PlanObservation | undefined => {
    if (x < 0 || x > frame.width || y < 0 || y > frame.height) return;
    let low = 0, high = positions.length - 1;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (positions[mid]! < x) low = mid + 1;
      else high = mid;
    }
    const right = positions[low]!;
    const left = positions[low - 1];
    const closest = left !== undefined && x - left <= right - x ? left : right;
    const points = columns.get(closest)!;
    let nearest = points[0]!, distance = Infinity;
    for (const point of points) {
      const bounds = detail?.(point);
      const gap = bounds?.type === 'range' ? Math.max(bounds.top - y, y - bounds.bottom, 0) : Math.abs(y - point.y);
      if (gap < distance) {
        nearest = point;
        distance = gap;
      }
    }
    return nearest;
  };
}
