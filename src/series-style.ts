import type {ChartData, ChartOptions, ChartSeriesStyle} from './types.js';
import {pointKey} from './identity.js';
import {hexChannels} from './text-contrast.js';

const pointStyleTypes = new Set<ChartData['type']>(['line','spline','area','areaspline','mixed','column','scatter','bubble','waterfall']);
const pointIdentities = new WeakMap<ChartData, ReadonlySet<string>>();

export function pointStyleError(data: ChartData, options: ChartOptions): string | undefined {
  const styles = options.appearance?.points;
  if (!styles) return;
  if (!pointStyleTypes.has(data.type) || !('series' in data) || !Array.isArray(data.series)) return 'POINT_STYLE_UNSUPPORTED_FOR_TYPE';
  if (!styles.length) return;
  let known = pointIdentities.get(data);
  if (!known) {
    const ids = new Set<string>();
    for (const series of data.series) {
      if (!series || typeof series.id !== 'string' || !Array.isArray(series.data)) continue;
      for (const point of series.data) if (point && typeof point.id === 'string') ids.add(pointKey({seriesId:series.id,pointId:point.id}));
    }
    pointIdentities.set(data, known = ids);
  }
  if (styles.some(style => !known.has(pointKey(style)))) return 'UNKNOWN_POINT_STYLE_ID';
}
export function pointColors(options: ChartOptions, data?: ChartData): ReadonlyMap<string, string> {
  const colors = new Map<string, string>();
  const waterfall = options.appearance?.waterfall;
  if (waterfall && data?.type === 'waterfall') for (const series of data.series) {
    for (const point of series.data) {
      const color = point.type === 'delta' ? point.value === null ? undefined :
        point.value < 0 ? waterfall.negativeColor : waterfall.positiveColor : waterfall.totalColor;
      if (color !== undefined) colors.set(pointKey({seriesId: series.id, pointId: point.id}), color);
    }
  }
  for (const style of options.appearance?.points ?? []) colors.set(pointKey(style), style.color);
  return colors;
}
export function markerPaint(style: ChartSeriesStyle | undefined, fallback: string, fallbackStroke?: string): string {
  const stroke = style?.markerStroke ?? fallbackStroke;
  return `fill="${style?.markerFill ?? fallback}"${stroke ? ` stroke="${stroke}" stroke-width="${style?.markerStrokeWidth ?? 1}"` : ''}`;
}
export function seriesStyles(options: ChartOptions): ReadonlyMap<string, ChartSeriesStyle> {
  return new Map(options.appearance?.series?.map(style => [style.id, style]));
}
export function patternDefinition(id:string,color:string,pattern:ChartSeriesStyle['pattern']):string {
  if(!pattern||pattern==='none')return '';
  const [red, green, blue] = hexChannels(color);
  const ink = .2126 * red + .7152 * green + .0722 * blue > 150 ? '#172438' : '#ffffff';
  const marks=pattern==='dots'?`<circle cx="2" cy="2" r="1.2" fill="${ink}"/>`:pattern==='crosshatch'?`<path d="M0,0 L8,8 M8,0 L0,8" stroke="${ink}" stroke-width="1"/>`:`<path d="M-2,2 L2,-2 M0,8 L8,0 M6,10 L10,6" stroke="${ink}" stroke-width="1.2"/>`;
  return `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${color}"/>${marks}</pattern>`;
}
/** Marker coordinates are renderer-owned finite projections, never consumer SVG. */
export function markerElement(shape: ChartSeriesStyle['marker'], x: number, y: number, radius: number, attributes: string): string {
  if (shape === 'square') return `<rect x="${x-radius}" y="${y-radius}" width="${radius*2}" height="${radius*2}" ${attributes}/>`;
  if (shape === 'diamond') return `<polygon points="${x},${y-radius} ${x+radius},${y} ${x},${y+radius} ${x-radius},${y}" ${attributes}/>`;
  if (shape === 'triangle') return `<polygon points="${x},${y-radius} ${x+radius},${y+radius} ${x-radius},${y+radius}" ${attributes}/>`;
  return `<circle cx="${x}" cy="${y}" r="${radius}" ${attributes}/>`;
}
