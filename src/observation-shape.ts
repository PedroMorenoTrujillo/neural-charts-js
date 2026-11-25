import type {PlanBar, PlanCircle, PlanCommand, PlanFrame, PlanObservation} from '@neural-charts/core';

type FocusShape = {tag:'rect' | 'circle' | 'polygon' | 'path'; attributes:Record<string, number | string>};

export function observationShape(o: PlanObservation, bar?: PlanBar, circle?: PlanCircle): FocusShape | undefined {
  if (bar && bar.width > 0 && bar.height > 0) return {
    tag:'rect', attributes:{x:bar.x, y:bar.y, width:bar.width, height:bar.height},
  };
  const hit = o.hit;
  if (circle && (!hit || hit.type === 'circle')) return markerFocusShape(circle.cx, circle.cy, circle.radius);
  if (hit?.type === 'circle') return {
    tag:'circle', attributes:{cx:hit.cx, cy:hit.cy, r:hit.radius},
  };
  if (hit?.type === 'polygon') return {
    tag:'polygon', attributes:{points:hit.vertices.map(({x,y}) => x + ',' + y).join(' ')},
  };
  if (hit?.type === 'compoundPolygon') return {
    tag:'path', attributes:{d:hit.polygons.map(vertices => 'M' + vertices.map(({x,y}) => x + ',' + y).join('L') + 'Z').join('')},
  };
  if (hit?.type === 'sector') {
    const {cx, cy, radius, innerRadius, start, end} = hit;
    const circle = 2 * Math.PI;
    const span = Math.abs(end - start) >= circle - 1e-12 ? circle : ((end - start) % circle + circle) % circle;
    if (!(span > 0 && radius > innerRadius)) return;
    const point = (r: number, angle: number) => (cx + r * Math.cos(angle)) + ',' + (cy + r * Math.sin(angle));
    const arc = (r: number, a: number, sweep: number) => span === circle
      ? `A${r},${r} 0 0,${sweep} ${point(r,a + Math.PI)} A${r},${r} 0 0,${sweep} ${point(r,a)}`
      : `A${r},${r} 0 ${Number(span > Math.PI)},${sweep} ${point(r,a + (sweep ? span : -span))}`;
    const outer = 'M' + point(radius,start) + arc(radius,start,1);
    const inner = innerRadius ? (span === circle ? 'ZM' : 'L') + point(innerRadius,start + span) +
      arc(innerRadius,start + span,0) : span === circle ? '' : 'L' + cx + ',' + cy;
    return {tag:'path', attributes:{d:outer + inner + 'Z', 'fill-rule':'evenodd'}};
  }
}

export function markerFocusShape(x: number, y: number, r: number, marker?: string): FocusShape {
  if (marker === 'square') return { tag:'rect', attributes:{x:x-r, y:y-r, width:r*2, height:r*2} };
  if (marker === 'triangle') return { tag:'polygon', attributes:{points:`${x},${y-r} ${x+r},${y+r} ${x-r},${y+r}`} };
  if (marker === 'diamond') return { tag:'polygon', attributes:{points:`${x},${y-r} ${x+r},${y} ${x},${y+r} ${x-r},${y}`} };
  return { tag:'circle', attributes:{cx:x, cy:y, r} };
}

export function observationBars(bars: readonly PlanBar[] | undefined) {
  const byId = new Map<string, PlanBar>();
  for (const bar of bars ?? []) if (bar.pointId !== undefined) byId.set(bar.pointId, bar);
  return byId;
}

export function observationCircles(circles: readonly PlanCircle[] | undefined) {
  const byId = new Map<string, PlanCircle>();
  for (const circle of circles ?? []) if (circle.pointId !== undefined) byId.set(circle.pointId, circle);
  return byId;
}

/** X-range outline commands contain the interval rectangle. Bars contain its progress fill. */
export function intervalLabelBounds(frame: PlanFrame): Map<string, Map<string, PlanBar>> {
  const bySeries = new Map<string, Map<string, PlanBar>>();
  const outlines = new Map(frame.series.map(series => [series.id, series.commands ?? []]));
  const nextOutline = new Map<string, number>();
  for (const { id, interval } of frame.observations) {
    if (!interval || interval.duration <= 0) continue;
    const commands = outlines.get(id.seriesId);
    const offset = nextOutline.get(id.seriesId) ?? 0;
    nextOutline.set(id.seriesId, offset + 5);
    const start = commands?.[offset], end = commands?.[offset + 2];
    if (start?.type !== 'M' || end?.type !== 'L' || commands?.[offset + 4]?.type !== 'Z') continue;
    let bounds = bySeries.get(id.seriesId);
    if (!bounds) bySeries.set(id.seriesId, bounds = new Map());
    bounds.set(id.pointId, { x: start.x, y: start.y, width: end.x - start.x, height: end.y - start.y });
  }
  return bySeries;
}

type ObservationDetail =
  | {type: 'range'; top: number; bottom: number}
  | {type: 'stroke'; commands: readonly PlanCommand[]; filled?: readonly PlanCommand[]; circles?: readonly PlanCircle[]};

function directionalDetails(frame: PlanFrame) {
  const bySeries = new Map<string, Map<string, ObservationDetail>>();
  return (point: PlanObservation) => {
    const {seriesId, pointId} = point.id;
    let details = bySeries.get(seriesId);
    if (details) return details.get(pointId);
    bySeries.set(seriesId, details = new Map());
    const series = frame.series.find(item => item.id === seriesId);
    if (!series?.commands) return;
    let strokeOffset = 0, fillOffset = 0;
    // The planner batches projected strokes and filled heads separately in observation order.
    for (const observation of frame.observations) {
      if (observation.id.seriesId !== seriesId) continue;
      const calm = series.commands[strokeOffset + 1]?.type === 'A';
      let strokes = 3, filled = 0;
      if (!calm && observation.vector) {
        strokes = 2;
        filled = 4;
      } else if (!calm && observation.wind) {
        const knots = Math.round(observation.value * (3600 / 1852) / 5) * 5;
        strokes = observation.wind.direction === null ? 5 : 2 * (1 + Math.floor((knots % 50) / 10) + Number(knots % 10 >= 5));
        filled = observation.wind.direction === null ? 0 : 4 * Math.floor(knots / 50);
      }
      const commands = series.commands.slice(strokeOffset, strokeOffset + strokes);
      const heads = series.areaCommands?.slice(fillOffset, fillOffset + filled) ?? [];
      if (commands.length === strokes) details.set(observation.id.pointId, {type:'stroke', commands, filled:heads});
      strokeOffset += strokes;
      fillOffset += filled;
    }
    return details.get(pointId);
  };
}

function stemDetails(frame: PlanFrame) {
  const bySeries = new Map<string, Map<string, PlanCircle[]>>();
  return (point: PlanObservation): ObservationDetail => {
    const {seriesId, pointId} = point.id;
    let marks = bySeries.get(seriesId);
    if (!marks) {
      bySeries.set(seriesId, marks = new Map());
      for (const circle of frame.series.find(series => series.id === seriesId)?.circles ?? []) {
        if (circle.pointId === undefined) continue;
        const peers = marks.get(circle.pointId);
        if (peers) peers.push(circle);
        else marks.set(circle.pointId, [circle]);
      }
    }
    const stem = point.stem;
    const commands: PlanCommand[] = stem
      ? [{type:'M', x:stem.x, y:stem.startY}, {type:'L', x:stem.x, y:stem.endY}]
      : [];
    const circles = marks.get(pointId);
    return {type:'stroke', commands, ...(circles ? {circles} : {})};
  };
}

function errorbarDetails(frame: PlanFrame) {
  const bySeries = new Map<string, Map<number, PlanCommand[]>>();
  // Horizontal caps and vertical stems share an x midpoint after clipping.
  const key = (x: number) => Math.round(x * 1e6);
  return (point: PlanObservation): ObservationDetail | undefined => {
    const id = point.id.seriesId;
    let strokes = bySeries.get(id);
    if (!strokes) {
      bySeries.set(id, strokes = new Map());
      const commands = frame.series.find(series => series.id === id)?.commands ?? [];
      for (let i = 0; i + 1 < commands.length; i += 2) {
        const start = commands[i], end = commands[i + 1];
        if (start?.type !== 'M' || end?.type !== 'L') continue;
        const midpoint = key(start.x + (end.x - start.x) / 2);
        const pair = strokes.get(midpoint);
        if (pair) pair.push(start, end);
        else strokes.set(midpoint, [start, end]);
      }
    }
    const commands = strokes.get(key(point.x));
    return commands ? {type:'stroke', commands} : undefined;
  };
}

export function observationDetails(frame: PlanFrame) {
  if (frame.family === 'vector' || frame.family === 'windbarb') return directionalDetails(frame);
  if (frame.family === 'lollipop' || frame.family === 'dumbbell' || frame.family === 'item') return stemDetails(frame);
  if (frame.family === 'errorbar') return errorbarDetails(frame);
  const strokeSize = frame.family === 'ohlc' ? 6 : frame.family === 'hlc' ? 4 : 0;
  const rangeFamily = frame.family === 'arearange' || frame.family === 'areasplinerange' ||
    frame.family === 'fan' || frame.mixedRanges !== undefined;
  if (!strokeSize && !rangeFamily) return;
  const bySeries = new Map<string, Map<number, ObservationDetail>>();
  return (point: PlanObservation): ObservationDetail | undefined => {
    if (!strokeSize && (point.lowValue === undefined || point.highValue === undefined)) return;
    const {seriesId} = point.id;
    let byX = bySeries.get(seriesId);
    if (!byX) {
      byX = new Map();
      bySeries.set(seriesId, byX);
      const commands = frame.series.find(series => series.id === seriesId)?.commands ?? [];
      if (strokeSize) {
        // The x coordinate of the stem identifies each financial stroke in its series.
        for (let i = 0; i + strokeSize <= commands.length; i += strokeSize) {
          const high = commands[i], low = commands[i + 1];
          if (high?.type === 'M' && low?.type === 'L' && high.x === low.x) {
            byX.set(high.x, {type:'stroke', commands:commands.slice(i, i + strokeSize)});
          }
        }
      } else {
        // The observation and both edges share the same projected x.
        for (const command of commands) {
          if (command.type !== 'M' && command.type !== 'L' && command.type !== 'Q') continue;
          const {x, y} = command, bounds = byX.get(x);
          if (bounds?.type === 'range') {
            bounds.top = Math.min(bounds.top, y);
            bounds.bottom = Math.max(bounds.bottom, y);
          } else {
            byX.set(x, {type:'range', top:y, bottom:y});
          }
        }
      }
    }
    return byX.get(point.x);
  };
}
