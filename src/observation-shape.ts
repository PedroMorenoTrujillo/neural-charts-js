import type {PlanBar, PlanCommand, PlanFrame, PlanObservation} from '@neural-charts/core';

type FocusShape = {tag:'rect' | 'circle' | 'polygon' | 'path'; attributes:Record<string, number | string>};

export function observationShape(o: PlanObservation, bar?: PlanBar): FocusShape | undefined {
  if (bar && bar.width > 0 && bar.height > 0) return {
    tag:'rect', attributes:{x:bar.x, y:bar.y, width:bar.width, height:bar.height},
  };
  const hit = o.hit;
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

export function observationBars(bars: readonly PlanBar[] | undefined) {
  const byId = new Map<string, PlanBar>();
  for (const bar of bars ?? []) if (bar.pointId !== undefined) byId.set(bar.pointId, bar);
  return byId;
}

type ObservationDetail =
  | {type: 'range'; top: number; bottom: number}
  | {type: 'price'; commands: readonly PlanCommand[]};

export function observationDetails(frame: PlanFrame) {
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
            byX.set(high.x, {type:'price', commands:commands.slice(i, i + strokeSize)});
          }
        }
      } else {
        // The observation and both edges share the same projected x.
        for (const command of commands) {
          if (command.type !== 'M' && command.type !== 'L') continue;
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
