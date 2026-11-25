import type { PlanCommand, PlanFrame, PlanBar } from '@neural-charts/core';
import type { ChartTextStyle } from './types.js';
import type { ChartData, ChartOptions, ChartPointId } from './types.js';
import { samePoint, pointKey } from './identity.js';
import { isCartesianFamily } from './capabilities.js';
import { formatTimeDuration, numberFormatter, tickFormatter, valueFormatter } from './format.js';
import { themeTokens } from './theme.js';
import { componentDash } from './component-lines.js';
import { axisLabelLines, axisLabelIndices } from './axis-labels.js';
import { cellTextOnSurface, textColorOnSurface } from './text-contrast.js';
import {intervalLabelBounds, markerFocusShape, observationBars, observationCircles, observationDetails, observationShape} from './observation-shape.js';
import {pointColors, seriesStyles, markerElement, markerPaint, patternDefinition} from './series-style.js';
import {contentText,titleContext} from './content.js';
import type {ChartContentPorts,ChartSvgContentTargets,ChartAxisLabelContext,ChartDataLabelContext} from './content.js';
import {systemFontFamily} from './text-style.js';

export const svgNamespace = 'http://www.w3.org/2000/svg';

export function escapeXml(input: string): string {
  return input.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ud800-\udfff\ufffe\uffff&<>"']/gu,
    character => xmlEntities[character] ?? '\ufffd');
}
const xmlEntities: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const {max, min, floor, ceil} = Math;
export function svgOpening(width: number | string, height: number | string, locale: ChartOptions['locale'], id: string, scope: 'svg' | 'export'): string {
  return `<svg xmlns="${svgNamespace}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" lang="${locale ?? 'en'}" aria-labelledby="${id}-${scope}-title ${id}-${scope}-desc"`;
}
const num = (n: number) => { if (!Number.isFinite(n)) throw Error('NONFINITE_FRAME'); return String(n === 0 ? 0 : n); };
const rectBox = ({x, y, width, height}: Readonly<{x: number; y: number; width: number; height: number}>) =>
  `x="${num(x)}" y="${num(y)}" width="${num(width)}" height="${num(height)}"`;
const linePath = ({x1, y1, x2, y2}: Readonly<{x1: number; y1: number; x2: number; y2: number}>) =>
  `M${num(x1)},${num(y1)} L${num(x2)},${num(y2)}`;
const circleGeometry = (cx: number, cy: number, radius: number) =>
  `cx="${num(cx)}" cy="${num(cy)}" r="${num(radius)}"`;
const immutablePaths = new WeakMap<readonly PlanCommand[], string>();
export type SvgPathResources = Map<string, Readonly<{commands: readonly PlanCommand[]; data: string; reusable: boolean}>>;
export function pathData(commands: readonly PlanCommand[]): string {
  const cached = immutablePaths.get(commands); if (cached !== undefined) return cached;
  const value = commands.map(command => {
    if (command.type === 'Z') return 'Z';
    const end = `${num(command.x)},${num(command.y)}`;
    if (command.type === 'A') {
      return `A${num(command.radius)},${num(command.radiusY ?? command.radius)} 0 ${command.largeArc},${command.sweep} ${end}`;
    }
    if (command.type === 'Q') return `Q${num(command.cx)},${num(command.cy)} ${end}`;
    return command.type + end;
  }).join(' ');
  if (commands.length >= 256 && Object.isFrozen(commands) && commands.every(c => Object.isFrozen(c))) immutablePaths.set(commands, value);
  return value;
}
export const plotInsets = (family: string, orientation?: 'horizontal' | 'vertical', options?: ChartOptions) => {
  if (!isCartesianFamily(family)) return {left:0,right:0,top:0,bottom:family==='tilemap'?(options?.colorAxis?.type==='classes'?84:56):0};
  const horizontal=family==='bar'||family==='vbp'||family==='bullet'&&orientation!=='vertical',valueFormat=options?.axes?.y?.numberFormat||(options?.layout?.stacking!=='percent'&&options?.formatting?.number),labels=horizontal?options?.axes?.y?.labels:options?.axes?.x?.labels,angle=Math.abs(labels?.rotation??0)*Math.PI/180;
  const rotated=angle?ceil(30+min(labels?.maxCharacters??11,options?.formatting?.date?18:11)*3.5*Math.sin(angle)+(labels?.maxLines??2)*13*Math.cos(angle)):0;
  const compact=valueFormat&&valueFormat.notation==='compact'&&valueFormat.minimumFractionDigits===0&&valueFormat.maximumFractionDigits===0&&valueFormat.currencyDisplay!=='name'&&valueFormat.unitDisplay!=='long'&&!options?.axes?.y?.title;
  const verticalTitle = horizontal ? options?.axes?.x?.titleStyle : options?.axes?.y?.titleStyle;
  const horizontalTitle = horizontal ? options?.axes?.y?.titleStyle : options?.axes?.x?.titleStyle;
  const verticalLabels = horizontal ? options?.axes?.x?.labels : options?.axes?.y?.labels;
  const extraWidth = max(0, (verticalTitle?.fontSize ?? 12) - 12) + max(0, (verticalLabels?.style?.fontSize ?? 12) - 12) * 3;
  const extraHeight = max(0, (horizontalTitle?.fontSize ?? 12) - 12) + max(0, (labels?.style?.fontSize ?? 12) - 12) * (labels?.maxLines ?? 2);
  const verticalAxis = horizontal ? options?.axes?.x : options?.axes?.y;
  const titleWidth = (horizontal || !valueFormat) && verticalAxis?.visible !== false && verticalAxis?.title ? 24 : 0;
  const secondary = options?.axes?.secondaryY;
  const secondaryTitleWidth = secondary?.visible !== false && secondary?.title
    ? 24 + max(0, (secondary.titleStyle?.fontSize ?? 12) - 12) : 0;
  const secondaryLabelWidth = max(0, (secondary?.labels?.style?.fontSize ?? 12) - 12) * 3;
  const labelBudget = !horizontal && valueFormat && verticalLabels?.maxLines === 1 &&
    !verticalLabels.rotation && verticalLabels.maxCharacters !== undefined
    ? min(128, max(64, verticalLabels.maxCharacters * 8 + 12 + (verticalAxis?.title ? 24 : 0))) : undefined;
  const rowLabels = family === 'heatmap' || family === 'timeline' || family === 'xrange';
  return {left:(horizontal?112:valueFormat?labelBudget??(compact?88:128):rowLabels?112:60)+titleWidth+extraWidth,right:family==='mixed'?(secondary?.numberFormat||options?.formatting?.number?128:64)+secondaryTitleWidth+secondaryLabelWidth:family==='pareto'?58:28,top:22,bottom:max(['heatmap','contour'].includes(family)?108:options?.formatting?.date?80:56,rotated)+extraHeight};
};
export function hasSideLegend(options: ChartOptions, width: number): boolean {
  const position = options.legend?.position;
  return width >= 600 && options.legend?.visible !== false && (position === 'left' || position === 'right');
}

export function parallelPlotWidth(dimensions: number, options: ChartOptions): number {
  return dimensions > 4 && options.layout?.coordinates !== 'polar' ? min(10000, (dimensions - 1) * 88 + 80) : 0;
}

export function plotSize(data: ChartData, options: ChartOptions, width: number, includeLegend = true) {
  const orientation = options.layout?.orientation;
  const family = data.type === 'column' && orientation === 'horizontal' ? 'bar' : data.type;
  const inset = plotInsets(family, orientation, options);
  const side = includeLegend && hasSideLegend(options, width) ? 160 : 0;
  return {
    width: max(options.appearance?.minPlotWidth ?? 0, data.type === 'parallel' && Array.isArray(data.axes) ? parallelPlotWidth(data.axes.length, options) : 0,
      64, min(10000, width - 40 - inset.left - inset.right - side)),
    height: max(64, (options.height ?? 360) - inset.top - inset.bottom),
  };
}

/** Convert plot dimensions to the surrounding SVG viewport, including the axis insets. */
export function plotBounds(frame: PlanFrame, options: ChartOptions) {
  const inset = plotInsets(frame.family, frame.bulletOrientation, options);
  return {...inset, width: frame.width + inset.left + inset.right, height: frame.height + inset.top + inset.bottom};
}

export function chartSvg(frame: PlanFrame, options: ChartOptions, instanceId: string, active?: ChartPointId, selection: readonly ChartPointId[] = [], resources?: SvgPathResources, custom?:ChartContentPorts, targets?:ChartSvgContentTargets, colorsByPoint = pointColors(options)): string {
  const {appearance, axes, direction = 'ltr'} = options;
  const {family} = frame;
  const locale = options.locale ?? 'en';
  const waterfall = family === 'waterfall';
  const flame = family === 'flame', timeline = family === 'timeline';
  const intervalOverlay = waterfall || family === 'xrange' || flame;
  const displayNumber = numberFormatter(options);
  const primaryValue=valueFormatter(options),secondaryValue=valueFormatter(options,'secondary');
  const dark = options.theme === 'dark', tokens = themeTokens(options), ink = tokens.foreground, muted = tokens.muted, grid = tokens.grid, background = tokens.background;
  const gridPath = (attributes: string) => `<path ${attributes} fill="none" stroke="${grid}"/>`;
  const inset = plotBounds(frame, options), { left, top, width, height } = inset;
  const physicalAnchor = (anchor: string) => direction !== 'rtl' || anchor === 'middle' ? anchor : anchor === 'end' ? 'start' : 'end';
  const id = escapeXml(instanceId);
  const textNode = (x: number, y: number, label: string, anchor: string, fill: string, outline: boolean, title = '', rotation = 0, style?: Omit<ChartTextStyle, 'align'>) =>
    `<text x="${num(x)}" y="${num(y)}" fill="${fill}"${outline ? ` stroke="${background}" stroke-width="3" stroke-linejoin="round" paint-order="stroke"` : ''} font-size="${style?.fontSize ?? 12}"${style?.fontWeight ? ` font-weight="${style.fontWeight}"` : ''}${rotation ? ` transform="rotate(${num(rotation)} ${num(x)} ${num(y)})"` : ''} text-anchor="${physicalAnchor(anchor)}" direction="${direction}">${title}${escapeXml(label)}</text>`;
  const text = (x: number, y: number, label: string, anchor = 'middle', fill = muted, outline = false, fullLabel = label) =>
    textNode(x, y, label, anchor, fill, outline, `<title>${escapeXml(fullLabel)}</title>`);
  const target=(key:'axisLabel'|'dataLabel',context:ChartAxisLabelContext|ChartDataLabelContext,value:string)=>{if(!targets||!custom?.[key]?.render)return '';const token=String(targets.size);targets.set(token,{key,context,text:value});return ` data-nc-content="${token}"`;};
  const path = (commands: readonly PlanCommand[]): string => {
    const data = pathData(commands); if (!resources || commands.length < 256) return `d="${data}"`;
    const token = String(resources.size); resources.set(token, {commands, data, reusable: immutablePaths.has(commands)});
    return `d="M0,0" data-nc-path="${token}"`;
  };
  const axisText = (x: number, y: number, label: string, anchor: string, lines: number, limit: number, rotation = 0, fill = muted, outline = false, style?: Omit<ChartTextStyle, 'align'>) => {
    const step = (style?.fontSize ?? 12) + 1;
    const content = axisLabelLines(label, limit, lines), first = y - (content.length - 1) * step / 2, title = escapeXml(label);
    return `<g data-axis-label="" data-axis-coordinate="${num(x)}" aria-label="${title}"><title>${title}</title>${content.map((line, i) => textNode(x, first + i * step, line, anchor, style?.color ?? fill, outline, '', rotation, style)).join('')}</g>`;
  };
  const legendIndices = new Map(frame.legend.map((s, i) => [s.id, i])), seriesIndices = new Map(frame.series.map((s, i) => [s.id, i])), styles = seriesStyles(options);
  const color = (seriesId: string, fallback: string) => { const custom = styles.get(seriesId)?.color; if (custom) return custom; const i = legendIndices.get(seriesId) ?? seriesIndices.get(seriesId) ?? 0, palette = appearance?.colors; return palette?.length && (family !== 'gauge' || seriesId === 'reading') && (family !== 'treemap' || i !== 0) ? palette[max(0, family === 'treemap' ? i - 1 : i) % palette.length]! : fallback; };
  const tileText = (paint: string, opacity = 1) => cellTextOnSurface(paint, opacity, background, dark);
  const patternPaints = new Map<string,string>(); let patternDefs = '';
  if(styles.size) for(const s of new Map([...frame.legend,...frame.series].map(s=>[s.id,s])).values()) {
    const pattern=styles.get(s.id)?.pattern;if(!pattern||pattern==='none')continue;
    const token=id+'-pattern-'+patternPaints.size;patternDefs+=patternDefinition(token,escapeXml(color(s.id,s.color)),pattern);patternPaints.set(s.id,`url(#${token})`);
  }
  const cellPaints = new Map<string, Readonly<{color: string; opacity: number}>>();
  for (const series of frame.series) for (const cell of series.cells ?? []) if (cell.pointId !== undefined) cellPaints.set(pointKey({ seriesId: series.id, pointId: cell.pointId }), cell);
  const annotationPaints = new Map<string, Readonly<{color: string; opacity: number}>>();
  if (cellPaints.size) for (const point of frame.observations) { const paint = cellPaints.get(pointKey(point.id)); if (paint) annotationPaints.set(JSON.stringify([point.id.seriesId, point.x, point.y]), paint); }
  const singletons = frame.series.some(s => s.commands && (!['line', 'area', 'spline', 'areaspline'].includes(family) || s.commands.length <= 1));
  const individualMarks = singletons || !!options.annotations?.length || frame.series.some(s => s.bars?.length || s.circles?.length || s.cells?.length || s.pictorialFills?.length || s.textGlyphs?.length || s.parts?.some(p => p.bars?.length));
  const indices = individualMarks ? new Map(frame.observations.map((o, i) => [pointKey(o.id), i])) : new Map<string, number>();
  const horizontal = family === 'bar' || family === 'vbp';
  const horizontalValueAxis = horizontal || family === 'bullet' && frame.bulletOrientation !== 'vertical';
  // Numeric X coordinates are independent variables, not value-axis units.
  const xAxis = horizontal ? axes?.y : axes?.x, yAxis = horizontal ? axes?.x : axes?.y;
  const axisFormatter = (axis: typeof xAxis, inherit: boolean) =>
    tickFormatter(options, axis?.numberFormat ?? (inherit ? options.formatting?.number : undefined));
  const rawValues = options.layout?.stacking !== 'percent';
  const valueTickLabel = axisFormatter(yAxis,rawValues), secondaryTickLabel=axisFormatter(axes?.secondaryY,true), labelPolicy = (axis: typeof xAxis, lines: number, limit: number) => {
    const labels = axis?.labels;
    const layout = labels?.layout ?? 'auto';
    return {
      layout,
      lines: layout === 'auto' ? labels?.maxLines ?? lines : 1,
      limit: layout === 'all' ? Infinity : min(labels?.maxCharacters ?? limit, limit),
      rotation: labels?.rotation ?? 0,
    };
  };
  const dataLabelLayout = appearance?.dataLabelLayout ?? 'auto';
  const labelLimit = appearance?.labelLimit ?? (dataLabelLayout === 'auto' ? 40 : 200);
  const layoutLabelLimit = family === 'dendrogram' && dataLabelLayout === 'auto'
    ? min(labelLimit, max(1, floor(frame.height / 26))) : labelLimit;
  const labelStep = max(1, ceil(frame.observations.length / layoutLabelLimit));
  const xFirst = frame.labels[0], xLast = frame.labels.at(-1);
  const yFirst = frame.grid[0], yLast = frame.grid.at(-1);
  const reversedValue = horizontal
    ? (xLast?.x ?? 0) < (xFirst?.x ?? 0)
    : (yLast?.y ?? 0) > (yFirst?.y ?? 0);
  const dataLabel = (value: string, index: number, x: number, y: number, fill: string, outline: boolean, truncate: boolean,
    source: Pick<ChartDataLabelContext, 'observation' | 'annotation'>) => {
    const context = custom?.dataLabel ? Object.freeze({family, locale, defaultText: value, index, ...source}) : undefined;
    const label = context ? contentText(custom, 'dataLabel', context) : value;
    const cellWidth = source.annotation?.box?.width;
    const available = min(cellWidth ?? Infinity, intervalOverlay ? width : frame.width);
    const limit = max(3, floor((available - 8) / 7.5));
    const proposed = truncate && dataLabelLayout === 'truncate' ? axisLabelLines(label, 12, 1)[0]! : label;
    const displayed = cellWidth !== undefined || proposed.length > limit ? axisLabelLines(proposed, limit, 1)[0]! : proposed;
    let anchor = 'middle';
    const total = source.annotation?.stackTotal;
    if (total && horizontal) {
      const right = (total.sign === 'positive') !== reversedValue;
      const gap = 7;
      const labelWidth = Array.from(displayed).length * 7.5 + 2;
      const room = right ? frame.width + inset.right - 4 - x : x + 6;
      const outside = room >= labelWidth + gap;
      const toRight = outside === right;
      anchor = toRight ? 'start' : 'end';
      x += toRight ? gap : -gap;
      y += 4;
      outline = !outside;
    } else if (total) {
      const halfWidth = min(frame.width / 2, Array.from(displayed).length * 3.75 + 2);
      x = max(halfWidth, min(frame.width - halfWidth, x));
      y += (total.sign === 'positive') !== reversedValue ? -7 : 16;
    } else if (!intervalOverlay) {
      const halfWidth = min(frame.width / 2, Array.from(displayed).length * 3.75 + 2);
      x = max(halfWidth, min(frame.width - halfWidth, x));
      const belowPoint = y < 14 && source.observation && cellWidth === undefined ? source.observation.y + 15 : y;
      y = max(14, min(frame.height - 3, belowPoint));
    }
    const markup = text(x, y, displayed, anchor, fill, outline, label);
    return context ? markup.replace('<text ', `<text${target('dataLabel', context, label)} `) : markup;
  };
  const xTickLabel=axisFormatter(xAxis,rawValues && horizontalValueAxis);
  const axisLabel=(axis:ChartAxisLabelContext['axis'],tick:ChartAxisLabelContext['tick'],index:number,x:number,y:number,value:string,anchor:string,p:ReturnType<typeof labelPolicy>,plain=false)=>{
    const style = axes?.[axis]?.labels?.style;
    const limit = style?.fontSize && style.fontSize > 12 ? max(3, floor(p.limit * 12 / style.fontSize)) : p.limit;
    if(!custom?.axisLabel)return plain && !style && p.layout === 'auto'?text(x,y,value,anchor):axisText(x,y,value,anchor,p.lines,limit,p.rotation,muted,false,style);
    const context = Object.freeze({family, locale, axis, index, tick, defaultText: value});
    const label = contentText(custom, 'axisLabel', context);
    return axisText(x, y, label, anchor, targets && custom.axisLabel.render ? 1 : p.lines, limit, p.rotation, muted, false, style)
      .replace('<text ', `<text${target('axisLabel', context, label)} `);
  };
  const referenceLabels = new Map(options.referenceLabels?.map(a => [a.id, a.text]));

  const observationColor = (seriesId: string, pointId?: string) => colorsByPoint.size && pointId !== undefined ? colorsByPoint.get(pointKey({seriesId, pointId})) : undefined;
  const bandStyles = new Map(options.referenceBandStyles?.map(style => [style.id, style]));
  const referenceStyles=new Map(options.referenceStyles?.map(style=>[style.id,style]));
  const bySeries = new Map<string, typeof frame.observations[number][]>();
  if (singletons) for (const o of frame.observations) { const group = bySeries.get(o.id.seriesId) ?? []; group.push(o); bySeries.set(o.id.seriesId, group); }
  const observation = (seriesId: string, pointId?: string) => { const index = pointId === undefined ? undefined : indices.get(pointKey({ seriesId, pointId })); return index === undefined ? '' : ` data-observation="${index}"`; };
  const chartTitle=custom?.title?contentText(custom,'title',titleContext(frame,options.locale,options.title??frame.title)):options.title??frame.title;
  let svg = `${svgOpening(num(width), num(height), options.locale, id, 'svg')} style="display:block;width:${num(width)}px;max-width:${(appearance?.minPlotWidth || parallelPlotWidth(frame.parallel?.axes.length ?? 0, options)) ? 'none' : '100%'};height:auto;margin-inline:auto;font-family:${systemFontFamily};background:${background}"><title id="${id}-svg-title">${escapeXml(chartTitle)}</title><desc id="${id}-svg-desc">${escapeXml(options.accessibility?.description ?? options.description ?? frame.description)}</desc><defs><clipPath id="${id}-clip"><rect x="-1" y="-1" width="${num(frame.width + 2)}" height="${num(frame.height + 2)}"/></clipPath>${patternDefs}</defs><g transform="translate(${left},${top})">`;
  if (frame.polarGrid) {
    const p = frame.polarGrid;
    if (axes?.grid !== false) {
      for (const ring of p.rings) svg += ring.commands ? gridPath(path(ring.commands)) : `<circle ${circleGeometry(p.cx, p.cy, ring.radius)} fill="none" stroke="${grid}"/>`;
      for (const spoke of p.spokes) svg += `<path d="${linePath({x1: p.cx, y1: p.cy, x2: spoke.x, y2: spoke.y})}" stroke="${grid}"/>`;
    }
    if (axes?.x?.visible !== false) for (const [index, spoke] of p.spokes.entries()) {
      const anchor = spoke.x < p.cx - 4 ? 'end' : spoke.x > p.cx + 4 ? 'start' : 'middle';
      const edge = anchor === 'end' ? spoke.x : anchor === 'start' ? frame.width - spoke.x : frame.width;
      const policy = labelPolicy(axes?.x, 1, min(24, max(2, floor((edge - 4) / 7.5))));
      svg += axisLabel('x', spoke, index, spoke.x, spoke.y + (spoke.y < p.cy ? -9 : 16),
        spoke.label, anchor, policy);
    }
    if (axes?.y?.visible !== false) for (const [index, ring] of p.rings.entries()) {
      svg += axisLabel('y', ring, index, p.cx + 7, p.cy - ring.radius + 12,
        ring.label, 'start', labelPolicy(axes?.y, 1, 24), true);
    }
  } else {
    if (axes?.grid !== false) {
      for (const t of frame.bulletGrid ?? []) svg += gridPath(`d="${linePath(t)}"`);
      if (frame.parallel) svg += gridPath(path(frame.parallel.commands));
    }
    if (frame.parallel) for (const axis of frame.parallel.axes) {
      if (axes?.x?.visible !== false) svg += text(axis.labelAnchor.x, axis.labelAnchor.y, axis.label);
      if (axes?.y?.visible === false) continue;
      for (const [index, tick] of axis.ticks.entries()) {
        const contextTick = custom?.axisLabel ? Object.freeze({label: tick.label, value: tick.value, type: 'number'}) : tick;
        svg += axisLabel('y', contextTick, index, tick.x - 7, tick.y + 4,
          tick.label, 'end', labelPolicy(axes?.y, 1, 24), true);
      }
    }
    if (horizontal && axes?.grid !== false) for (const t of frame.labels) svg += gridPath(`d="M${num(t.x)},0 V${num(frame.height)}"`);
    for (const [i,t] of frame.grid.entries()) {
      if (axes?.grid !== false) svg += gridPath(`d="M0,${num(t.y)} H${num(frame.width)}"`);
      if (yAxis?.visible !== false && t.label !== '') {
        const limit = max(6, floor((left - (yAxis?.title ? 40 : 20)) / 7));
        const label = valueTickLabel(t);
        const density = family === 'bellcurve' && !custom?.axisLabel && !options.formatting?.number &&
          !yAxis?.numberFormat && label.length > limit ? Number(label) : NaN;
        svg += Number.isFinite(density)
          ? text(-12, t.y + 4, Number(density.toPrecision(3)).toExponential(), 'end', muted, false, label)
          : axisLabel(horizontal?'x':'y',t,i,-12,t.y+4,label,'end',labelPolicy(yAxis,2,limit),!(options.formatting?.number||yAxis?.numberFormat||yAxis?.labels||yAxis?.title));
      }
    }
    if (xAxis?.visible !== false) {
      const visible = axisLabelIndices(frame.labels.length, xAxis?.labels?.layout && xAxis.labels.layout !== 'auto' ? 256 : floor(frame.width / 64) + 1);
      const p=labelPolicy(xAxis,2,options.formatting?.date?18:11);
      if (p.layout === 'all') p.limit = floor((width - 8) / 7.5);
      const ticks = frame.labels.flatMap((tick, index) => visible.has(index) ||
        (horizontalValueAxis && tick.label === '0')
        ? [{tick, index, label: xTickLabel(tick)}] : []);
      const fontSize = xAxis?.labels?.style?.fontSize ?? 12;
      const limit = fontSize > 12 ? max(3, floor(p.limit * 12 / fontSize)) : p.limit;
      const halfWidth = (label: string) => max(...axisLabelLines(label, limit, p.lines).map(line => Array.from(line).length * fontSize * .3125));
      const renderTick = ({tick, index, label}: typeof ticks[number]) => {
        const half = p.layout === 'all' && !p.rotation ? min(width / 2 - 3, halfWidth(label)) + 3 : 0;
        const x = half ? max(half - left, min(width - left - half, tick.x)) : tick.x;
        return axisLabel(horizontal ? 'y' : 'x', tick, index, x, frame.height + 22, label, 'middle', p);
      };
      if (p.layout === 'auto' && !custom?.axisLabel) {
        ticks.sort((a, b) => a.tick.x - b.tick.x);
        let rightEdge = -Infinity;
        const last = ticks.at(-1);
        const lastLeft = last ? last.tick.x - halfWidth(last.label) : Infinity;
        for (const entry of ticks) {
          const width = halfWidth(entry.label);
          if (entry.tick.x - width < rightEdge || (entry !== last && entry !== ticks[0] && entry.tick.x + width + 5 > lastLeft)) continue;
          svg += renderTick(entry);
          rightEdge = entry.tick.x + width + 5;
        }
      } else for (const entry of ticks) svg += renderTick(entry);
    }
    if (yAxis?.visible !== false) {
      const labels = frame.yLabels ?? [];
      const step = max(1, ceil(labels.length / (yAxis?.labels?.layout && yAxis.labels.layout !== 'auto' ? 256 : max(1, floor(frame.height / 48)))));
      const lines = max(1, min(3, floor(frame.height / max(1, labels.length) / 13) - 1));
      const limit = yAxis?.title ? max(6, floor(family === 'vbp' ? (left - 34) / 6.5 : (left - 40) / 7)) : 14;
      const p = labelPolicy(yAxis, lines, limit);
      labels.forEach((tick, i) => {
        if (i % step !== 0 && (i !== labels.length - 1 || i % step < step / 2)) return;
        if (family === 'vbp' && !custom?.axisLabel && tick.label.length > limit) {
          const edges = tick.label.split('–').map(Number);
          if (edges.length === 2 && edges.every(Number.isFinite)) {
            const range = edges.map(value => String(Number(value.toPrecision(4)))).join('–');
            svg += text(-12, tick.y + 4, axisLabelLines(range, limit, 1)[0]!, 'end', muted, false, tick.label);
            return;
          }
        }
        svg += axisLabel(horizontal?'x':'y',tick,i,-12,tick.y+4,tick.label,'end',p);
      });
    }
    if (axes?.secondaryY?.visible !== false) for (const [i,t] of (frame.secondaryGrid ?? []).entries()) {const axis=axes?.secondaryY,p=labelPolicy(axis,2,14);svg += axisLabel('secondaryY',t,i,frame.width+12,t.y+4,secondaryTickLabel(t),'start',p,!(axis?.labels||axis?.numberFormat||options.formatting?.number));}
  }
  for (const reference of frame.references ?? []) if (reference.status === 'visible') {const style=referenceStyles.get(reference.id),dash=style?.dash==='solid'?'':` stroke-dasharray="${style?.dash==='dotted'?'2 3':'5 4'}"`;svg += `<path data-reference="${escapeXml(reference.id)}" d="${linePath(reference.line)}" stroke="${escapeXml(style?.color??muted)}"${style?.width!==undefined?` stroke-width="${num(style.width)}"`:''}${dash} fill="none"/>`;}
  for (const reference of frame.referenceBands ?? []) if (reference.status === 'visible') {
    const style = bandStyles.get(reference.id);
    svg += `<rect data-reference-band="${escapeXml(reference.id)}" ${rectBox(reference.box)} fill="${style?.color ?? muted}" fill-opacity="${style?.opacity ?? '.12'}">${style?.label ? `<title>${escapeXml(style.label)}</title>` : ''}</rect>`;
  }
  svg += `<g data-layer="marks" clip-path="url(#${id}-clip)"><g data-layer="geometry">`;
  for (const [i, band] of (frame.bulletBands ?? []).entries()) if (band.status === 'visible' && band.rect) { const b = band.rect; svg += `<rect data-bullet-band="${escapeXml(band.id)}" ${rectBox(b)} fill="${escapeXml(appearance?.bandColors?.[i % appearance.bandColors.length] ?? band.color)}" fill-opacity=".35"><title>${escapeXml(band.label)}</title></rect>`; }
  if (options.layout?.background !== false) for (const glyph of frame.pictorialGlyphs ?? []) svg += `<path ${path(glyph.backgroundCommands)} fill="${grid}"/>`;
  for (const s of frame.series) {
    const paint = escapeXml(color(s.id, s.color)), fillPaint = patternPaints.get(s.id) ?? paint, style = styles.get(s.id), dash = style?.dash === 'dashed' ? ' stroke-dasharray="6 4"' : style?.dash === 'dotted' ? ' stroke-dasharray="2 4"' : ''; svg += `<g data-series="${escapeXml(s.id)}"${dash}>`;
    const bar = (b: PlanBar): string => { const pointPaint = observationColor(s.id, b.pointId), tone = pointPaint ?? (b.direction ? escapeXml(b.direction === 'rising' ? appearance?.risingColor ?? '#23865d' : appearance?.fallingColor ?? '#c14a5a') : paint); return `<rect${observation(s.id, b.pointId)} ${rectBox(b)} fill="${b.hollow ? 'none' : pointPaint ?? (b.direction ? tone : fillPaint)}"${b.direction ? ` stroke="${tone}" stroke-width="1"` : ''}/>`; };
    const single = bySeries.get(s.id) ?? [];
    const exact = single.length === 1 ? observation(s.id, single[0]!.id.pointId) : '';
    if (s.areaCommands) svg += `<path ${path(s.areaCommands)} fill="${fillPaint}" fill-opacity="${num(style?.fillOpacity ?? .2)}" stroke="none"/>`;
    const linePattern = family === 'line' || family === 'spline'
      ? ` data-forced-series="${(legendIndices.get(s.id) ?? 0) % 4}"` : '';
    if (s.commands) svg += `<path${linePattern}${exact} ${path(s.commands)} fill="${s.fill ? fillPaint : 'none'}" fill-opacity="${s.fill && style?.fillOpacity !== undefined ? num(style.fillOpacity) : s.fill && ['sankey', 'dependencywheel', 'chord', 'arcdiagram'].includes(family) ? '.4' : '1'}" stroke="${waterfall ? appearance?.waterfall?.connectorColor ?? paint : paint}" stroke-width="${num(appearance?.lineWidth ?? 2.25)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const denseFlags = family === 'flags' && (s.bars?.length ?? 0) * 8 > frame.width;
    for (const b of s.bars ?? []) {
      if (denseFlags) {
        svg += `<circle${observation(s.id, b.pointId)} ${circleGeometry(b.x + b.width / 2, b.y + b.height / 2, 1.5)} fill="${paint}"/>`;
      } else svg += bar(b);
    }
    for (const part of s.parts ?? []) {
      const dash = componentDash(family, part.key) ?? (part.dash === 'dashed' ? '5 3' : part.dash === 'dotted' ? '2 3' : '');
      if (part.commands) svg += `<path data-part="${escapeXml(part.key)}" ${path(part.commands)} fill="${part.fill ? paint : 'none'}"${part.fill ? ` fill-opacity="${num(part.opacity ?? .15)}"` : ''} stroke="${part.fill ? 'none' : paint}" stroke-width="${num(appearance?.lineWidth ?? 1.8)}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`; for (const b of part.bars ?? []) svg += bar(b); }
    for (const c of s.circles ?? []) {
      const attributes = observation(s.id, c.pointId);
      const fill = observationColor(s.id, c.pointId) ?? fillPaint;
      svg += family === 'scatter' && style
        ? markerElement(style.marker, c.cx, c.cy, style.markerRadius ?? c.radius, markerPaint(style, fill) + attributes)
        : `<circle${attributes} ${circleGeometry(c.cx, c.cy, c.radius)} fill="${fill}"${family === 'venn' ? ` fill-opacity=".18" stroke="${paint}" stroke-width="1.5"` : ''}/>`;
    }
    for (const fill of s.pictorialFills ?? []) svg += `<path${observation(s.id, fill.pointId)} ${path(fill.commands)} fill="${paint}"/>`;
    if (s.textGlyphs?.length) {
      const glyphPaint = textColorOnSurface(paint, background, dark);
      for (const glyph of s.textGlyphs) svg += `<text${observation(s.id, glyph.pointId)} x="0" y="0" transform="translate(${num(glyph.center.x)},${num(glyph.center.y)}) rotate(${num(glyph.rotation)})" text-anchor="middle" dominant-baseline="central" font-size="${num(glyph.fontSize)}" fill="${glyphPaint}">${escapeXml(glyph.text)}</text>`;
    }
    for (const cell of s.cells ?? []) {
      const shape = cell.geometry, attributes = `fill="${escapeXml(cell.color)}" opacity="${num(cell.opacity)}"${observation(s.id, cell.pointId)}`;
      svg += shape.type === 'circle' ? `<circle ${circleGeometry(shape.cx, shape.cy, shape.radius)} ${attributes}/>` : `<polygon points="${shape.vertices.map(v => num(v.x) + ',' + num(v.y)).join(' ')}" ${attributes}/>`;
    }
    if (s.nodeCommands) svg += `<path ${path(s.nodeCommands)} fill="${paint}"/>`;
    svg += '</g>';
  }
  for (const target of frame.bulletTargets ?? []) if (target.status === 'visible' && target.line) svg += `<path data-bullet-target="${escapeXml(pointKey(target.id))}" d="${linePath(target.line)}" stroke="${ink}" stroke-width="3"><title>${escapeXml(displayNumber(target.value))}</title></path>`;
  const markers = appearance?.markers !== false && ['line', 'spline', 'area', 'areaspline', 'radar', 'mixed'].includes(family) && frame.observations.length <= 1000;
  const mixedMarkerSeries = markers && family === 'mixed'
    ? new Set(frame.mixedRanges ? frame.mixedRanges.series.filter(series => series.type === 'line').map(series => series.id)
      : frame.series.filter(series => series.commands && !series.bars).map(series => series.id))
    : undefined;
  const chosen = new Set(selection.map(pointKey));
  const hasValueAnnotations = frame.annotations?.some(annotation => annotation.role === 'value') === true;
  const barLabels = new Map<string, PlanBar>();
  const intervalLabels = family === 'xrange' && (appearance?.dataLabels || active || selection.length) ? intervalLabelBounds(frame) : undefined;
  if (intervalOverlay && appearance?.dataLabels) {
    for (const series of frame.series) for (const bar of series.bars ?? []) {
      if (bar.pointId !== undefined) barLabels.set(pointKey({seriesId: series.id, pointId: bar.pointId}), bar);
    }
  }
  const emphasisBars = active || selection.length
    ? new Map(frame.series.filter(series => series.bars).map(series => [series.id, observationBars(series.bars)]))
    : undefined;
  const emphasisCircles = active || selection.length
    ? new Map(frame.series.filter(series => series.circles).map(series => [series.id, observationCircles(series.circles)]))
    : undefined;
  const emphasisDetail = active || selection.length ? observationDetails(frame) : undefined;
  let uncutLabels = '';
  if (markers || selection.length || active || appearance?.dataLabels) for (const [i, o] of frame.observations.entries()) {
    const key = pointKey(o.id), emphasized = chosen.has(key) || samePoint(active, o.id);
    const paint = escapeXml(colorsByPoint.get(key) ?? color(o.id.seriesId, o.color));
    const detail = emphasized ? emphasisDetail?.(o) : undefined;
    const circle = emphasized ? emphasisCircles?.get(o.id.seriesId)?.get(o.id.pointId) : undefined;
    const style = styles.get(o.id.seriesId);
    const bar = intervalLabels?.get(o.id.seriesId)?.get(o.id.pointId) ?? emphasisBars?.get(o.id.seriesId)?.get(o.id.pointId);
    const selectedShape = emphasized && (family === 'scatter' && circle && style
      ? markerFocusShape(circle.cx, circle.cy, style.markerRadius ?? circle.radius, style.marker)
      : observationShape(o, bar, circle));
    if (detail?.type === 'range') {
      const {top, bottom} = detail;
      for (const y of top === bottom ? [top] : [top, bottom]) {
        svg += `<circle data-observation="${i}" ${circleGeometry(o.x, y, 5)} fill="${background}" stroke="${paint}" stroke-width="2.5"/>`;
      }
    } else if (detail?.type === 'stroke') {
      if (detail.commands.length) {
        const d = pathData(detail.commands);
        svg += `<path d="${d}" fill="none" stroke="${background}" stroke-width="5"/><path data-observation="${i}" d="${d}" fill="none" stroke="${paint}" stroke-width="2.5" stroke-linecap="round"/>`;
      }
      if (detail.filled?.length) svg += `<path d="${pathData(detail.filled)}" fill="${paint}" stroke="${background}" stroke-width="1.5" paint-order="stroke"/>`;
      for (const circle of detail.circles ?? []) {
        svg += `<circle data-observation="${i}" ${circleGeometry(circle.cx, circle.cy, circle.radius)} fill="${background}" stroke="${paint}" stroke-width="2.5"/>`;
      }
    } else if (selectedShape) {
      const attrs = Object.entries(selectedShape.attributes).map(([key,value]) => key + '="' + String(value) + '"').join(' ');
      svg += `<${selectedShape.tag} data-observation="${i}" ${attrs} fill="none" stroke="${ink}" stroke-width="2.5"/>`;
    } else if (emphasized && family === 'gauge') {
      const commands = frame.series.find(s => s.id === o.id.seriesId)?.commands;
      if (commands) svg += `<path d="${pathData(commands)}" fill="none" stroke="${paint}" stroke-width="2.5"/>`;
    } else if ((markers && (!mixedMarkerSeries || mixedMarkerSeries.has(o.id.seriesId))) || emphasized) {
      const attributes = emphasized ? `fill="${o.heatmap ? 'none' : background}" stroke="${o.heatmap ? ink : paint}" stroke-width="2.5"` : markerPaint(style, paint, paint);
      svg += markerElement(style?.marker, o.x, o.y, emphasized ? 6 : style?.markerRadius ?? appearance?.markerRadius ?? 3, `data-observation="${i}" ${attributes}`);
    }
    if (appearance?.dataLabels && !timeline && !hasValueAnnotations && i % labelStep === 0 && !(family === 'treemap' && o.subtotal)) {
      const cell = cellPaints.get(key);
      const value = o.interval?.type === 'time' ? formatTimeDuration(options, o.interval.duration)
        : (o.valueAxis === 'secondary' ? secondaryValue : primaryValue)(o.value);
      const fill = cell ? tileText(cell.color, cell.opacity) : family === 'treemap' ? tileText(paint) : muted;
      if (intervalOverlay) {
        const progress = barLabels.get(key);
        const bar = intervalLabels ? intervalLabels.get(o.id.seriesId)?.get(o.id.pointId) : progress;
        const textWidth = Array.from(value).length * 7 + 10;
        const interval = family === 'xrange' && o.interval && o.interval.duration > 0;
        const labelLeft = o.x - textWidth / 2, labelRight = o.x + textWidth / 2;
        const inside = bar && bar.height >= 20 && labelLeft >= bar.x && labelRight <= bar.x + bar.width;
        if ((flame || interval) && !inside) continue;
        const y = inside ? bar.y + bar.height / 2 + 4 :
          max(-top + 13, min(frame.height + 14, min(o.y, bar?.y ?? o.y) - 8));
        const x = max(-left + textWidth / 2, min(frame.width + inset.right - textWidth / 2, o.x));
        const onFill = progress && labelLeft >= progress.x && labelRight <= progress.x + progress.width;
        const spansFillEdge = interval && progress && !onFill &&
          labelLeft < progress.x + progress.width && labelRight > progress.x;
        const fill = inside ? interval && !onFill ? ink : tileText(paint) : muted;
        uncutLabels += `<g data-label="" pointer-events="none">${dataLabel(value, i, x, y, fill, !inside || !!spansFillEdge, true, {observation: o})}</g>`;
      } else svg += `<g data-label="">${dataLabel(value, i, o.x, o.y + (cell ? 4 : -12), fill, !cell && family !== 'treemap', true, {observation: o})}</g>`;
    }
  }
  // Core owns sign-separated totals and their anchors. Give explicitly requested
  // totals collision priority over segment labels; otherwise pruning can hide all totals.
  const annotations=appearance?.stackLabels?[...(frame.annotations??[]).filter(a=>a.stackTotal),...(frame.annotations??[]).filter(a=>!a.stackTotal)]:frame.annotations??[];
  let forcedValueLabels = 0;
  for (const [i,a] of annotations.entries()) if ((a.stackTotal?(appearance?.stackLabels??appearance?.dataLabels):(a.role === 'label' || appearance?.dataLabels || family === 'gauge')) && (!a.box || a.box.width >= 48 && a.box.height >= (timeline ? 18 : 20))) {
    if (timeline && !appearance?.dataLabels || family === 'flags' && a.text === '•' && frame.observations.length * 8 > frame.width) continue;
    if (dataLabelLayout !== 'auto' && a.role === 'value' && forcedValueLabels++ >= labelLimit) continue;
    const s = ['treemap', 'sunburst', 'funnel', 'pyramid', 'item', 'pictorial', 'packedbubble'].includes(family) && a.box ? frame.series[seriesIndices.get(a.box!.seriesId) ?? -1] : undefined;
    const cell = a.box && annotationPaints.get(JSON.stringify([a.box.seriesId, a.x, a.y]));
    const markup = dataLabel(a.text, i, a.x, a.y, cell ? tileText(cell.color, cell.opacity) : s ? tileText(color(s.id, s.color)) : muted,
      !cell && !s, a.role === 'value', {annotation: a});
    const label = `<g data-label=""${a.stackTotal?` data-stack-total="${num(a.stackTotal.value)}"${appearance?.stackLabels?' data-label-priority="stack"':''}`:''}>${markup}</g>`;
    if (a.stackTotal) uncutLabels += label;
    else svg += label;
  }
  svg += '</g></g>';
  svg += uncutLabels;
  for (const band of frame.referenceBands ?? []) if (band.status === 'visible') {
    const label = bandStyles.get(band.id)?.label, box = band.box;
    if (label && box.width >= 40 && box.height >= 20) {
      const displayed = axisLabelLines(label, max(3, floor((box.width - 12) / 7)), 1)[0]!;
      svg += text(box.x + box.width / 2, box.y + 15, displayed, 'middle', ink, true, label);
    }
  }
  for (const reference of frame.references ?? []) if (reference.status === 'visible' && referenceLabels.has(reference.id)) {
    const label=referenceLabels.get(reference.id)!,length=Array.from(label).length,paint=referenceStyles.get(reference.id)?.color??muted;
    let x=max(8,min(frame.width-8,reference.line.x2)),anchor='end';
    if(reference.line.x1===reference.line.x2&&length*8>x-8){
      const rightX=max(8,min(frame.width-8,reference.line.x2+8));
      if(frame.width-8-rightX>x-8){x=rightX;anchor='start';}
    }
    const available=anchor==='start'?frame.width-8-x:x-8,limit=max(4,floor(available/8));
    if(length>limit)svg+=`<g data-reference-label="${escapeXml(reference.id)}" clip-path="url(#${id}-clip)">${axisText(x,max(24,min(frame.height-12,reference.line.y2-6)),label,anchor,2,limit,0,paint,true)}</g>`;
    else svg+=text(x,max(12,reference.line.y2-6),label,anchor,paint,true);
  }
  for (const a of options.annotations ?? []) { const index = indices.get(pointKey(a.point)), o = index === undefined ? undefined : frame.observations[index]; if (o) svg += `<g data-annotation="${escapeXml(a.id)}">${text(o.x + (a.dx ?? 0), o.y + (a.dy ?? -20), a.text)}</g>`; }
  const axisTitle = (label: string, length: number, style: ChartTextStyle | undefined, fill: string, transform: string) => {
    const x = style?.align === 'left' ? 0 : style?.align === 'right' ? length : length / 2;
    const anchor = physicalAnchor(style?.align === 'left' ? 'start' : style?.align === 'right' ? 'end' : 'middle');
    return `<text x="${num(x)}" transform="${transform}" text-anchor="${anchor}" direction="${direction}" fill="${style?.color ?? fill}" font-size="${style?.fontSize ?? 12}" font-weight="${style?.fontWeight ?? 400}">${escapeXml(label)}</text>`;
  };
  if (xAxis?.visible !== false && xAxis?.title) {
    if (!xAxis.titleStyle) svg += text(frame.width / 2, frame.height + 48, xAxis.title);
    else {
      const y = frame.height + 48 + max(0, (xAxis.titleStyle.fontSize ?? 12) - 12);
      svg += axisTitle(xAxis.title, frame.width, xAxis.titleStyle, muted, `translate(0 ${num(y)})`);
    }
  }
  // The rotated system font ascends up to13px in Firefox; retain an outer gap.
  if (yAxis?.visible !== false && yAxis?.title) {
    const x = 16 - left + max(0, (yAxis.titleStyle?.fontSize ?? 12) - 12);
    if (!yAxis.titleStyle) svg += `<text x="${num(x)}" y="${num(frame.height / 2)}" transform="rotate(-90,${num(x)},${num(frame.height / 2)})" text-anchor="middle" fill="${ink}" font-size="12">${escapeXml(yAxis.title)}</text>`;
    else svg += axisTitle(yAxis.title, frame.height, yAxis.titleStyle, ink, `translate(${num(x)} ${num(frame.height)}) rotate(-90)`);
  }
  const secondaryAxis = axes?.secondaryY;
  if (frame.secondaryGrid?.length && secondaryAxis?.visible !== false && secondaryAxis?.title) {
    const x = frame.width + inset.right - 12;
    svg += axisTitle(secondaryAxis.title, frame.height, secondaryAxis.titleStyle, ink, `translate(${num(x)} 0) rotate(90)`);
  }
  if (frame.colorAxis) {
    const axis = frame.colorAxis, y = frame.height + inset.bottom - 42, w = max(32, min(260, frame.width)), x = (frame.width - w) / 2;
    if (axis.type === 'continuous' && axis.domain) {
      svg += `<defs><linearGradient id="${id}-colors">${axis.stops.map(stop => `<stop offset="${num(stop.at * 100)}%" stop-color="${escapeXml(stop.color)}"/>`).join('')}</linearGradient></defs><rect data-color-axis="continuous" x="${num(x)}" y="${num(y)}" width="${num(w)}" height="9" rx="2" fill="url(#${id}-colors)"/>${text(x, y + 25, displayNumber(axis.domain[0]), 'start')}${text(x + w, y + 25, displayNumber(axis.domain[1]), 'end')}`;
    } else if (axis.type === 'classes') {
      const shown = axis.classes.slice(0, 6), columns = min(frame.width < 280 ? 2 : 3, shown.length), slot = frame.width / max(1, columns), labelLength = max(1, floor((slot - 20) / 8));
      svg += `<g data-color-axis="classes"><title>${escapeXml(axis.classes.map(item => item.label).join(', '))}</title>`;
      shown.forEach((item, i) => { const xx = i % columns * slot, yy = (family === 'tilemap' ? frame.height + 22 : y - (columns === 2 ? 20 : 0)) + floor(i / columns) * 20; svg += `<g><title>${escapeXml(item.label)}</title><rect x="${num(xx)}" y="${num(yy - 9)}" width="11" height="11" fill="${escapeXml(item.color)}"/>${text(xx + 17, yy, axisLabelLines(item.label, labelLength, 1)[0] ?? '', 'start')}</g>`; });
      svg += '</g>';
    }
  }
  return svg + '</g></svg>';
}
