import { transformPlanViewport, preparePlanRegionHit } from '@neural-charts/core';
import type { PlanFrame, PlanObservation, PlanViewportIntent, PlanViewportState, PlanViewportValue } from '@neural-charts/core';
import { ChartDownloadFormat, ChartDownloadMenuPosition, ChartToolbarAction, ChartZoomPosition } from './types.js';
import type { ChartController, ChartData, ChartOptions, ChartMountOptions, ChartPointId, ChartResult } from './types.js';
import { graphGroupData, invalid, planWith, snapshot, validateOptions, type ChartPlanner } from './planning.js';
import { chartSvg, hasSideLegend, plotBounds, plotSize, pathData, svgNamespace, parallelPlotWidth } from './svg.js';
import type {SvgPathResources} from './svg.js';
import { samePoint, pointKey, pointKeyParts } from './identity.js';
import { describeChartData } from './table.js';
import { measureBrowserWords } from './browser-text.js';
import { isCartesianFamily } from './capabilities.js';
import { dateFormatter, displayNumber, formatTimeDuration, numberFormatter, valueFormatter } from './format.js';
import {resolveResponsive} from './responsive.js';
import {pointColors, pointStyleError, seriesStyles} from './series-style.js';
import {serializeChartExport} from './export-layout.js';
import { themeTokens } from './theme.js';
import { headingStyle, systemFontFamily } from './text-style.js';
import { componentDash, visibleComponentLines } from './component-lines.js';
import { financialComponentLabel, messages } from './locale.js';
import { coreVersion } from './core-version.js';
import { detailPosition } from './tooltip.js';
import { exportChartCsv, rasterizeChartSvg } from './export.js';
import { viewportInput } from './gestures.js';
import { bindListeners } from './listeners.js';
import { chartMotion } from './animation.js';
import type { ChartSyncChannel } from './synchronization.js';
import { pruneLabels } from './labels.js';
import { planDefaultChart } from './default-planner.js';
import {ownContent,contentKeys,contentText,titleContext,legendContext} from './content.js';
import type {ChartContentPorts,ChartContentKey,ChartContentFor,ChartContentHost,ChartSvgContentTargets,ChartAxisLabelContext,ChartDataLabelContext,ChartTooltipContext,ChartTooltipRow} from './content.js';
import {createDomContentOwner} from './dom-content.js';
import {ensureChartStyles} from './styles.js';
import {observationBars, observationDetails, observationShape} from './observation-shape.js';
import {horizontalViewportScroll, viewportZoomLevel} from './viewport-scroll.js';

const exactPointerFamilies = new Set(['pie', 'donut', 'variablepie', 'sunburst', 'heatmap', 'tilemap', 'treemap', 'flame']);
const zoomButtons = [ChartToolbarAction.ZoomIn, ChartToolbarAction.ZoomOut, ChartToolbarAction.ResetZoom] as const;
const viewportActions = {
  'zoom-in': {type: 'zoom', factor: 2},
  'zoom-out': {type: 'zoom', factor: .5},
  reset: {type: 'reset'},

} as const satisfies Record<string, PlanViewportIntent>;

export function createChart(host: HTMLElement, initialData: ChartData, initialOptions: ChartOptions, mount: ChartMountOptions): ChartResult<ChartController> { return createChartWithPlanner(planDefaultChart, host, initialData, initialOptions, mount); }
export function createChartWithPlanner(planner: ChartPlanner, host: HTMLElement, initialData: ChartData, initialOptions: ChartOptions, mount: ChartMountOptions): ChartResult<ChartController> {
  try {
    const descriptors = Object.getOwnPropertyDescriptors(mount);
    if (Object.entries(descriptors).some(([key, d]) => {
      if (!Object.hasOwn(d, 'value') || !['instanceId', 'content', 'onPointActivate', 'onHiddenSeriesChange', 'onSelectionChange', 'onViewportChange', 'onDiagnostic', 'synchronization'].includes(key)) return true;
      if(key==='content')return false;
      return key === 'synchronization' ? !d.value || typeof d.value.join !== 'function' : key !== 'instanceId' && typeof d.value !== 'function';
    })) return invalid('INVALID_MOUNT_OPTIONS');
    mount = Object.freeze(Object.fromEntries(Object.entries(descriptors).map(([key, d]) => [key, d.value]))) as unknown as ChartMountOptions;
  } catch { return invalid('INVALID_MOUNT_OPTIONS'); }
  if (!host?.ownerDocument?.defaultView || !(host instanceof host.ownerDocument.defaultView.HTMLElement) || typeof mount.instanceId !== 'string' || !/^[A-Za-z][\w-]{0,95}$/.test(mount.instanceId)) return invalid('INVALID_HOST_OR_ID');
  const doc = host.ownerDocument, win = doc.defaultView!, id = mount.instanceId;
  if (doc.getElementById(id + '-svg-title')) return invalid('DUPLICATE_INSTANCE_ID');
  let data: ChartData, baseOptions: ChartOptions = {}, options: ChartOptions = {}, frame: PlanFrame, revision = 0, destroyed = false, raf = 0, lastGeometry = '', lastDrawing = '';
  const measureHost = () => host.getBoundingClientRect().width;
  let contentReference=mount.content,content:ChartContentPorts|undefined,domContent:ReturnType<typeof createDomContentOwner>|undefined;
  let contentDepth=0,committing=false;
  const contentCall=<T>(callback:()=>T):T=>{contentDepth++;try{return callback();}finally{contentDepth--;}};
  const contentErrors=new Set<string>();
  const prepareContent=(source:ChartContentPorts|undefined)=>{
    const owned=ownContent(source);if(!owned)return undefined;
    const guarded: Record<string, unknown> = {...owned};
    for (const key of contentKeys) {
      const slot = owned[key] as import('./content.js').ChartContentSlot<ChartContentKey> | undefined;
      if (slot) guarded[key] = {...slot, text: (context: ChartContentFor<ChartContentKey>) =>
        destroyed ? context.defaultText : contentCall(() => slot.text(context))};
    }
    guarded.onError = (diagnostic: import('./types.js').ChartDiagnostic) => {
      if (destroyed) return;
      const key = diagnostic.path + ':' + diagnostic.reason;
      if (contentErrors.has(key)) return;
      contentErrors.add(key);
      contentCall(() => {
        try { owned.onError?.(diagnostic); } catch {}
        if (!destroyed) try { mount.onDiagnostic?.(diagnostic); } catch {}
      });
    };
    return Object.freeze(guarded) as ChartContentPorts;
  };
  try{content=prepareContent(contentReference);}catch{return invalid('INVALID_CONTENT_PORTS','content');}
  const releaseContent=(target:Element)=>contentCall(()=>domContent?.release(target));
  const renderContent=<K extends ChartContentKey>(host:ChartContentHost<K>,key:K,context:ChartContentFor<K>|undefined,text:string,token?:string)=>{
    if(destroyed)return;
    if(context&&content?.[key]?.render){domContent??=createDomContentOwner(win,()=>content);contentCall(()=>domContent!.put(host,key,context,text,token??String(revision)));}
    else{releaseContent(host);host.removeAttribute('aria-label');host.textContent=text;}
  };
  let seriesDescriptions = new Map<string, string>(), pointDescriptions = new Map<string, string>();
  let styles: ReturnType<typeof seriesStyles> = new Map(), colorsByPoint = pointColors({});
  let tableData: ChartData | undefined, tableHidden = '', tableLocale: ChartOptions['locale'];
  let tablePage: ((delta: number) => void) | undefined;
  let renderedPaths = new Map<readonly import('@neural-charts/core').PlanCommand[], SVGPathElement[]>();
  let hidden: readonly string[] = [], selection: readonly ChartPointId[] = [], active: ChartPointId | undefined, viewportControlled = false;
  let pinned: ChartPointId | undefined, lastAnimationRevision: number | undefined;
  const index = new Map<number, Map<number, number[]>>();
  const observationIndices = new Map<string, number>();
  let regionHit: ReturnType<typeof preparePlanRegionHit>;
  const observationGroups = new Map<string, PlanObservation[]>();
  const navigationSeries = new Map<string, PlanObservation[]>();
  const navigationUngrouped = new Map<string, PlanObservation>();
  let seriesRanks = new Uint32Array(0);
  let navigationGroups: string[] = [];
  const exports = new Set<AbortController>();
  let downloading = false;
  let gestures: ReturnType<typeof viewportInput> | undefined, channel: ChartSyncChannel | undefined;
  const observationsBySyncKey = new Map<string, PlanObservation>();
  const interactionIndices = [index, observationIndices, observationsBySyncKey, observationGroups, navigationSeries, navigationUngrouped];
  function clearInteractionIndices(): void {
    for (const index of interactionIndices) index.clear();
  }
  const syncKey = (o: PlanObservation, fallback?: string) => o.group?.key ?? (o.xValue !== undefined ? 'x:' + o.xValue : fallback ?? pointKey(o.id));
  const publishActive = () => { const o = point(); channel?.emit(o ? { id: o.id, key: syncKey(o) } : undefined); };
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, css?: string): HTMLElementTagNameMap[K] {
    const node = doc.createElement(tag);
    if (css) node.style.cssText = css;
    return node;
  }
  const root = element('section', `font:14px ${systemFontFamily};position:relative;box-sizing:border-box;padding:20px;width:100%;border-radius:8px`);
  const title = element('h2', 'font-size:18px;line-height:1.4;margin:0 0 6px;font-weight:600');
  const description = element('p', 'font-size:13px;line-height:1.5;margin:0 0 12px');
  const drawing = element('div', 'min-width:0');
  const legend = element('div', 'display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:8px;align-content:start;min-width:0');
  const plotRegion = element('div', 'min-width:0');
  const scrollbar = element('input');
  scrollbar.type = 'range';
  scrollbar.dataset.viewportScroll = '';
  scrollbar.dir = 'ltr';
  scrollbar.min = '0';
  scrollbar.hidden = true;
  plotRegion.append(drawing, scrollbar);
  let scroll: ReturnType<typeof horizontalViewportScroll>, scrollFrame = 0;
  let downloadToolbar: HTMLDivElement | undefined;
  let zoomGroup: HTMLDivElement | undefined;
  const zoomLabel = element('label', 'display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:2px 8px;min-width:0;flex:1 1 120px;max-width:180px');
  const zoomText = element('span'), zoomValue = element('span');
  const zoomSlider = element('input', 'grid-column:1/-1;min-width:0;width:100%;margin:0;accent-color:var(--nc-focus,#2563eb)');
  zoomSlider.type = 'range';
  zoomSlider.dataset.zoomLevel = '';
  zoomText.style.overflowWrap = 'anywhere';
  zoomValue.setAttribute('aria-hidden', 'true');
  zoomLabel.append(zoomText, zoomValue, zoomSlider);
  let zoomInitial = 0, zoomLocale: ChartOptions['locale'], zoomFormat: Intl.NumberFormat;
  const detail = element('div', 'position:absolute;width:max-content;padding:6px 8px;border:1px solid #8596ad;border-radius:6px;font-size:13px;line-height:1.35;box-sizing:border-box;z-index:1;overflow:auto;overflow-wrap:anywhere;white-space:pre-line;overscroll-behavior:contain');
  const help = element('p', 'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)');
  const visibleStatusStyle = 'font-size:12px;min-height:18px;margin-top:10px';
  const status = element('div', visibleStatusStyle);
  const table = element('details', 'font-size:13px;margin-top:12px;max-height:320px;overflow:auto');
   const motion = chartMotion(win, drawing, () => frame);
  root.dataset.ncWeb = ''; root.dataset.coreVersion = coreVersion; root.tabIndex = 0; root.setAttribute('role', 'group');
  help.id = id + '-help'; root.setAttribute('aria-describedby', help.id);
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  detail.setAttribute('role', 'tooltip'); detail.hidden = true;
  const chartArea = element('div', 'gap:10px'); chartArea.append(plotRegion, legend);
  const pin = element('button');
  pin.type = 'button'; pin.hidden = true; pin.dataset.action = 'tooltip-pin';
  detail.id = id + '-tooltip'; pin.setAttribute('aria-controls', detail.id);
  root.append(title, description, chartArea, pin, detail, status, table, help);
  const button = (label: string, action: string) => { const b = element('button'); b.type = 'button'; b.textContent = label; b.dataset.action = action; return b; };
  const size = (o: ChartOptions, source: ChartData) => plotSize(source, o, o.width ?? measureHost());
  const plotElement = () => drawing.firstElementChild as SVGSVGElement | null;
  let inset: ReturnType<typeof plotBounds>;
  let focusLayer: SVGGElement | undefined;
  let barFocusFrame: PlanFrame | undefined;
  let focusDetail: ReturnType<typeof observationDetails>;
  const barFocusBySeries = new Map<string, Map<string, import('@neural-charts/core').PlanBar>>();
  const scrollports: {node: HTMLElement; x: boolean; y: boolean}[] = [];
  function observationForKey(key: string): PlanObservation | undefined {
    const position = observationIndices.get(key);
    return position === undefined ? undefined : frame.observations[position];
  }
  function point(): PlanObservation | undefined { return active ? observationForKey(pointKey(active)) : undefined; }
  function draw(): void {
    const resources: SvgPathResources = new Map();
    const targets:ChartSvgContentTargets|undefined=content?.axisLabel?.render||content?.dataLabel?.render?new Map():undefined;
     const parser = new win.DOMParser(), parsed = parser.parseFromString(chartSvg(frame, options, id, undefined, [], resources,content,targets,colorsByPoint), 'image/svg+xml');
    if(destroyed)return;
    if (parsed.querySelector('parsererror')) throw Error('INVALID_SERIALIZED_SVG');
    const next = doc.importNode(parsed.documentElement, true), paths = new Map<readonly import('@neural-charts/core').PlanCommand[], SVGPathElement[]>();
    for (const placeholder of next.querySelectorAll<SVGPathElement>('path[data-nc-path]')) {
      const resource = resources.get(placeholder.getAttribute('data-nc-path')!); if (!resource) throw Error('MISSING_PATH_RESOURCE');
      const previous = resource.reusable ? renderedPaths.get(resource.commands)?.shift() : undefined;
      let target = placeholder;
      if (previous) {
        for (const attribute of [...previous.attributes]) if (attribute.name !== 'd' && !placeholder.hasAttribute(attribute.name)) previous.removeAttribute(attribute.name);
        for (const attribute of [...placeholder.attributes]) if (!['d', 'data-nc-path'].includes(attribute.name) && previous.getAttribute(attribute.name) !== attribute.value) previous.setAttribute(attribute.name, attribute.value);
        placeholder.replaceWith(previous); target = previous;
      } else placeholder.setAttribute('d', resource.data);
      target.removeAttribute('data-nc-path');
      if (resource.reusable) { const same = paths.get(resource.commands) ?? []; same.push(target); paths.set(resource.commands, same); }
    }
    domContent?.clear(['axisLabel','dataLabel']);renderedPaths = paths; drawing.replaceChildren(next);
    const marks = next.querySelector('[data-layer="marks"]');
    focusLayer = marks ? svgElement('g', {'data-layer': 'focus', 'pointer-events': 'none'}) : undefined;
    if (focusLayer) marks!.append(focusLayer);
    if(targets)for(const node of next.querySelectorAll<SVGTextElement>('text[data-nc-content]')){const slot=targets.get(node.getAttribute('data-nc-content')!);if(slot?.key==='axisLabel')renderContent(node,'axisLabel',slot.context as ChartAxisLabelContext,slot.text);else if(slot?.key==='dataLabel')renderContent(node,'dataLabel',slot.context as ChartDataLabelContext,slot.text);}
    if (root.isConnected) pruneAutomaticLabels();
  }
  function svgElement<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>): SVGElementTagNameMap[K] {
    const node = doc.createElementNS(svgNamespace, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
  }
  function focusBar(seriesId: string, pointId: string) {
    if (barFocusFrame !== frame) {
      barFocusBySeries.clear();
      barFocusFrame = frame;
      focusDetail = observationDetails(frame);
    }
    let bars = barFocusBySeries.get(seriesId);
    if (!bars) {
      const series = frame.series.find(item => item.id === seriesId);
      bars = observationBars(series?.bars);
      for (const part of series?.parts ?? []) {
        for (const bar of part.bars ?? []) {
          if (bar.pointId !== undefined && !bars.has(bar.pointId)) bars.set(bar.pointId, bar);
        }
      }
      barFocusBySeries.set(seriesId, bars);
    }
    return bars.get(pointId);
  }
  function overlay(): void {
    const layer = focusLayer;
    if (!layer) return;
    layer.replaceChildren();
    const activePoint = point(), {family} = frame;
    if (activePoint && options.tooltip?.crosshair && isCartesianFamily(family)) {
      const d = family === 'bar' || family === 'vbp'
        ? `M0,${activePoint.y} H${frame.width}` : `M${activePoint.x},0 V${frame.height}`;
      layer.append(svgElement('path', {
        'data-crosshair': '', d, stroke: options.theme === 'dark' ? '#8596ad' : '#718299', 'stroke-dasharray': '3 4',
      }));
    }
    const chosen = new Set(selection.map(pointKey));
    if (active) chosen.add(pointKey(active));
    for (const key of chosen) { const o = observationForKey(key); if (!o) continue;
      const bar = focusBar(o.id.seriesId, o.id.pointId);
      const commands = family === 'gauge' ? frame.series.find(series => series.id === o.id.seriesId)?.commands : undefined;
      const shape = commands ? {tag:'path' as const, attributes:{d:pathData(commands)}} : observationShape(o, bar);
      const paint = o.heatmap || family === 'treemap' ? themeTokens(options).foreground
        : colorsByPoint.get(key) ?? seriesColor(o.id.seriesId, o.color);
      const surface = themeTokens(options).background;
      const detail = focusDetail?.(o);
      if (detail?.type === 'range') {
        const {top, bottom} = detail;
        for (const y of top === bottom ? [top] : [top, bottom]) {
          layer.append(svgElement('circle', {cx:o.x, cy:y, r:5, fill:surface, stroke:paint, 'stroke-width':2.5}));
        }
      } else if (detail?.type === 'price') {
        const path = {d:pathData(detail.commands), fill:'none'};
        layer.append(svgElement('path', {...path, stroke:surface, 'stroke-width':5}));
        layer.append(svgElement('path', {...path, stroke:paint, 'stroke-width':2.5}));
      } else if (shape) {
        layer.append(svgElement(shape.tag, {...shape.attributes, fill: commands ? 'none' : surface,
          'fill-opacity': .16, stroke: paint, 'stroke-width': 3, 'stroke-linejoin': 'round'}));
        layer.append(svgElement(shape.tag, {...shape.attributes, fill: 'none', stroke: surface, 'stroke-width': 1.5}));
      } else {
        const style = styles.get(o.id.seriesId);
        const tag = style?.marker === 'square' ? 'rect' : style?.marker === 'triangle' || style?.marker === 'diamond' ? 'polygon' : 'circle';
        const r = Math.max(5, Math.min(12, (style?.markerRadius ?? options.appearance?.markerRadius ?? 3) + 2));
        const {x,y} = o;
        const attributes: Record<string, number | string> = tag === 'rect' ? {x:x-r,y:y-r,width:r*2,height:r*2}
          : style?.marker === 'triangle' ? {points:`${x},${y-r} ${x+r},${y+r} ${x-r},${y+r}`}
          : tag === 'polygon' ? {points:`${x},${y-r} ${x+r},${y} ${x},${y+r} ${x-r},${y}`}
          : {cx:x,cy:y,r};
        layer.append(svgElement(tag, {...attributes, fill:surface, stroke:paint, 'stroke-width':2.5}));
      }
    }
  }
  function seriesColor(seriesId: string, fallback: string): string {
    const palette = options.appearance?.colors;
    const index = palette?.length ? Math.max(0, frame.legend.findIndex(series => series.id === seriesId)) : 0;
    return styles.get(seriesId)?.color ?? palette?.[index % palette.length] ?? fallback;
  }
  function refreshInteraction(announce = false): void {
    overlay();
    showDetail(announce);
    publishActive();
  }
  function pruneAutomaticLabels(): void {
    const layout = options.appearance?.dataLabelLayout;
    if (layout !== 'all' && layout !== 'truncate') pruneLabels(plotElement()!);
  }
  function showDetail(announce = false): void {
    const labels = messages(options.locale);
    if (!options.tooltip?.pinnable || options.tooltip.enabled === false || pinned && !observationIndices.has(pointKey(pinned))) pinned = undefined;
    const o = pinned ? observationForKey(pointKey(pinned)) : point();
    detail.hidden = !o || options.tooltip?.enabled === false;
    const showPin = !detail.hidden && options.tooltip?.pinnable === true;
    if (!showPin && doc.activeElement === pin) root.focus({preventScroll:true});
    pin.hidden = !showPin;
    pin.textContent = pinned ? labels.unpin : labels.pin;
    pin.setAttribute('aria-pressed', String(!!pinned));
    detail.setAttribute('role', pinned ? 'region' : 'tooltip');
    if (!o) { releaseContent(detail);status.textContent = frame.observations.length ? '' : labels.empty; return; }
    const peers = o.group && options.tooltip?.content === 'shared' ? observationGroups.get(o.group.key) : undefined;
    const rows: ChartTooltipRow[] | undefined = peers?.length ? peers.map(point => ({
      seriesId: point.id.seriesId,
      name: point.seriesName,
      color: colorsByPoint.get(pointKey(point.id)) ?? point.color,
      point,
    })) : undefined;
    if (rows) {
      const present = new Set(rows.map(row => row.seriesId));
      for (const item of frame.legend) {
        if (item.visible && !present.has(item.id)) rows.push({seriesId: item.id, name: item.name, color: item.color, point: null});
      }
    }
    const financial = o.financial;
    const label = financial && options.formatting?.date && 'axes' in data && data.axes && 'x' in data.axes && data.axes.x.type === 'time' &&
      o.xValue !== undefined && Math.abs(o.xValue) <= 8.64e15 && o.label === new Date(o.xValue).toISOString()
      ? dateFormatter(options)(o.xValue) : o.label;
    const selected = selection.some(id => samePoint(id, o.id));
    const text = rows ? label + '\n' + rows.map(row => row.name + ': ' + (row.point ? pointMeasurements(row.point) + financialMeasurements(row.point) : labels.missing)).join('\n')
      : observationText(o, label) + (o.percentage !== undefined ? ' (' + displayNumber(o.percentage) + '%)' : '') + (selected ? ' · ' + labels.selected : '') + financialMeasurements(o);
    const context:ChartTooltipContext|undefined=content?.tooltip?Object.freeze({family:frame.family,locale:options.locale??'en',defaultText:text,observation:o,points:Object.freeze(peers?[...peers]:[o]),...(rows ? {rows: Object.freeze(rows.map(row => Object.freeze(row)))} : {}),selected}):undefined;
    const portable=context?contentText(content,'tooltip',context):text;
    if(destroyed)return;
    renderContent(detail,'tooltip',detail.hidden?undefined:context,portable,context&&revision+':'+pointKey(o.id)+':'+context.selected);
    if(destroyed)return;
    if (pinned) detail.setAttribute('aria-label', labels.pinned);
    const explored = pinned && announce ? point() : undefined;
    const announcement = explored && !samePoint(explored.id, pinned) ? observationText(explored) : portable;
    if (announce) {
      const spoken = [announcement, seriesDescriptions.get(o.id.seriesId), pointDescriptions.get(pointKey(o.id))].filter(Boolean).join('. ');
      if (status.textContent !== spoken) status.textContent = spoken;
    }
    if (!detail.hidden) placeDetail(o);
  }
  function placeDetail(o: PlanObservation): void {
    const tooltip = options.tooltip;
    const below = tooltip?.placement === 'below';
    detail.style.position = below ? 'relative' : 'absolute';
    detail.style.marginBlockStart = below ? '8px' : '';
    if (below) {
      detail.style.left = '';
      detail.style.top = '';
      detail.style.visibility = '';
      detail.style.padding = '6px 8px';
      detail.style.maxWidth = tooltip?.maxWidth === undefined ? '100%' : `min(100%, ${tooltip.maxWidth}px)`;
      detail.style.maxHeight = tooltip?.maxHeight === undefined ? '12rem' : tooltip.maxHeight + 'px';
      detail.style.pointerEvents = 'auto';
      if (pinned || detail.scrollHeight > detail.clientHeight) detail.tabIndex = 0;
      else detail.removeAttribute('tabindex');
      return;
    }
    const box = plotElement()?.getBoundingClientRect();
    if (!box?.width || !box.height) { detail.style.visibility = 'hidden'; return; }
    const outer = root.getBoundingClientRect(), visible = drawing.getBoundingClientRect();
    const sx = box.width / inset.width, sy = box.height / inset.height;
    const x = box.left + inset.left * sx, y = box.top + inset.top * sy;
    const plot = {left: Math.max(x, visible.left, 0),
      right: Math.min(x + frame.width * sx, visible.left + drawing.clientWidth, win.innerWidth),
      top: Math.max(y, 0), bottom: Math.min(y + frame.height * sy, win.innerHeight)};
    for (const {node, x: clipX, y: clipY} of scrollports) {
      const area = node.getBoundingClientRect();
      if (clipX) {
        const left = area.left + node.clientLeft;
        plot.left = Math.max(plot.left, left);
        plot.right = Math.min(plot.right, left + node.clientWidth);
      }
      if (clipY) {
        const top = area.top + node.clientTop;
        plot.top = Math.max(plot.top, top);
        plot.bottom = Math.min(plot.bottom, top + node.clientHeight);
      }
    }
    const width = plot.right - plot.left, height = plot.bottom - plot.top;
    if (width <= 0 || height <= 0) { detail.style.visibility = 'hidden'; return; }
    detail.style.visibility = '';
    detail.style.maxWidth = Math.min(tooltip?.maxWidth ?? 320, width) + 'px';
    detail.style.padding = width < 36 || height < 32 ? '0' : '6px 8px';
    detail.style.maxHeight = Math.min(tooltip?.maxHeight ?? height, height) + 'px';
    const bounds = detail.getBoundingClientRect();
    const position = detailPosition(x + o.x * sx, y + o.y * sy, bounds.width, bounds.height, plot, options.tooltip?.placement === 'docked');
    const interactive = pinned || position.height < bounds.height || detail.scrollHeight > detail.clientHeight;
    detail.style.left = position.left - outer.left - root.clientLeft + 'px';
    detail.style.top = position.top - outer.top - root.clientTop + 'px';
    detail.style.maxHeight = position.height + 'px';
    detail.style.pointerEvents = interactive ? 'auto' : 'none';
    if (interactive) detail.tabIndex = 0; else detail.removeAttribute('tabindex');
  }
  function pointMeasurements(o: PlanObservation): string {
    const labels = messages(options.locale), format = valueFormatter(options, o.valueAxis);
    const range = (low: number, high: number) => format(low) + ' – ' + format(high);
    if (o.event) {
      const coordinate = o.event.type === 'time' ? dateFormatter(options)(o.event.coordinate) : displayNumber(o.event.coordinate);
      return coordinate + (o.event.description ? '\n' + o.event.description : '');
    }
    if (o.interval) {
      const {type, start, end, completed, duration} = o.interval;
      const coordinate = type === 'time' ? dateFormatter(options) : displayNumber;
      const displayDuration = type === 'time' ? formatTimeDuration(options, duration) : format(duration);
      return labels.duration + ': ' + displayDuration
        + measurement(labels.intervalStart, start, coordinate)
        + measurement(labels.intervalEnd, end, coordinate)
        + (completed == null ? '' : measurement(labels.completed, displayNumber(completed * 100) + '%', displayNumber))
        + (o.flame ? measurement(labels.selfDuration, o.flame.selfDuration, format) : '');
    }
    if (o.minimumValue !== undefined && o.maximumValue !== undefined && o.medianValue !== undefined) {
      return range(o.minimumValue, o.maximumValue) + measurement(labels.median, o.medianValue, format)
        + (o.q1Value === undefined ? '' : measurement('Q1', o.q1Value, format))
        + (o.q3Value === undefined ? '' : measurement('Q3', o.q3Value, format));
    }
    if (o.violin) {
      const {minimum,maximum,median,q1,q3,sampleCount} = o.violin;
      return range(minimum, maximum) + measurement(labels.median, median, format)
        + measurement('Q1', q1, format) + measurement('Q3', q3, format)
        + measurement(labels.samples, sampleCount, displayNumber);
    }
    if (o.lowValue !== undefined && o.highValue !== undefined) return range(o.lowValue, o.highValue);
    const value = format(o.value);
    if (o.sizeValue !== undefined) return value + (o.xValue === undefined ? '' : measurement('X', o.xValue, displayNumber))
      + measurement(labels.size, o.sizeValue, displayNumber);
    if (o.bullet && o.bullet.target !== undefined && o.bullet.type === 'measure') return value + measurement(labels.target, o.bullet.target, format);
    if (o.vector) return value + measurement('ΔX', o.vector.dx, displayNumber) + measurement('ΔY', o.vector.dy, displayNumber);
    if (o.wind && o.wind.direction !== null) return value + measurement(labels.windDirection, displayNumber(o.wind.direction) + '°', displayNumber);
    if (o.contour) return value + '\n' + labels.samples + ': ' + o.contour.sourceValues.map(format).join(' · ');
    return value;
  }
  function financialMeasurements(observation: PlanObservation): string {
    const financial = observation.financial;
    if (!financial) return '';
    const labels = messages(options.locale), format = valueFormatter(options, observation.valueAxis);
    let detail = '';
    for (const field of ['open', 'high', 'low', 'close'] as const) detail += measurement(labels[field], financial[field], format);
    if (financial.volume !== undefined) {
      detail += measurement(labels.volume, financial.volume, numberFormatter(options, {maximumFractionDigits: 3, useGrouping: true}));
    }
    for (const [name, value] of Object.entries(financial.components ?? {})) detail += measurement(financialComponentLabel(name, options.locale), value, format);
    return detail;
  }
  function observationText(observation: PlanObservation, label = observation.label): string {
    if (observation.event) return observation.event.title + '\n' + pointMeasurements(observation);
    return label + ' · ' + observation.seriesName + ': ' + pointMeasurements(observation);
  }
  function measurement(name: string, value: number | string | null, format: (value: number) => string): string {
    return '\n' + name + ': ' + (value === null ? '—' : typeof value === 'string' ? value : format(Number(value)));
  }
  function rawTable(): void {
    const labels = messages(options.locale);
    const captionText = (options.title ?? labels.chart) + ' — ' + labels.originals;
    const hiddenKey = JSON.stringify(hidden);
    if (tableData === data && tableHidden === hiddenKey && tableLocale === options.locale && (tablePage || !table.open)) {
      const caption = table.querySelector('caption'); if (caption) caption.textContent = captionText;
      return;
    }
    tableData = data; tableHidden = hiddenKey; tableLocale = options.locale;
    tablePage = undefined;
    const summary = table.querySelector('summary') ?? element('summary'); summary.textContent = labels.table;
    for (const child of [...table.children]) if (child !== summary) child.remove(); if (summary.parentElement !== table) table.append(summary);
    if (!table.open) return;
    const body = element('div'), t = element('table'), caption = t.createCaption();
    caption.textContent = captionText; body.append(t); table.append(body);
    const model = describeChartData(data, hidden, options.locale, {offset: 0, limit: 100}); if (model.status === 'invalid') return;
    const total = model.value.totalRows ?? model.value.rows.length, tr = t.createTHead().insertRow();
    for (const name of model.value.columns) { const th = element('th'); th.scope = 'col'; th.textContent = name; tr.append(th); }
    // Keep every original value, but format and mount only the requested page.
    let page = 0;
    const tbody = t.createTBody(), pager = element('div'), label = element('span');
    const previous = button(labels.previous, 'table-previous'), next = button(labels.next, 'table-next');
    pager.append(previous, label, next);
    body.append(pager);
    function renderPage(): void { tbody.replaceChildren(); const start = page * 100;
      const current = page === 0 ? model : describeChartData(data, hidden, options.locale, {offset: start, limit: 100}); if (current.status === 'invalid') return;
      for (const row of current.value.rows) { const tr = tbody.insertRow(); for (const value of row) tr.insertCell().textContent = value; }
      const focused = doc.activeElement === previous ? previous : doc.activeElement === next ? next : undefined;
      previous.disabled = page === 0;
      next.disabled = start + 100 >= total;
      if (focused?.disabled) {
        (previous.disabled ? next.disabled ? root : next : previous).focus({preventScroll: true});
      }
      label.textContent = ` ${Math.min(total, start + 1)}–${Math.min(total, start + 100)} / ${total} `;
    }
    tablePage = delta => { page = Math.max(0, Math.min(Math.max(0, Math.ceil(total / 100) - 1), page + delta)); renderPage(); };
    renderPage();
  }
  function tableToggled(): void { if (!destroyed && table.open) rawTable(); }
  function paint(changed: boolean): void {
    const labels = messages(options.locale);
    if(root.isConnected)ensureChartStyles(host);
    status.style.cssText = frame.observations.length ? help.style.cssText : visibleStatusStyle;
    const current = doc.activeElement;
    const focused = current instanceof win.HTMLButtonElement && root.contains(current) ? current : null;
    const tokens = themeTokens(options); root.style.background = tokens.background; detail.style.background = options.tooltip?.background ?? tokens.background; root.style.color = tokens.foreground; detail.style.color = options.tooltip?.foreground ?? tokens.foreground; root.style.setProperty('--nc-focus', tokens.focus); root.dir = options.direction ?? 'ltr';
    root.lang = options.locale ?? 'en';
    root.style.width = options.width === undefined ? '100%' : options.width + 'px'; root.style.maxWidth = '100%';
    const scrollable = !!(options.appearance?.minPlotWidth || parallelPlotWidth(frame.parallel?.axes.length ?? 0, options));
    drawing.style.overflowX = scrollable ? 'auto' : '';
    for (const [node, style] of [[title, headingStyle(options.appearance?.titleStyle)], [description, headingStyle(options.appearance?.descriptionStyle, true)]] as const) {
      node.style.textAlign = style.align ?? '';
      node.style.color = style.color ?? '';
      node.style.fontSize = style.fontSize + 'px';
      node.style.fontWeight = String(style.fontWeight);
    }
    const position = options.legend?.position ?? 'bottom', side = hasSideLegend(options, options.width ?? measureHost());
    chartArea.style.display = side ? 'grid' : 'block'; chartArea.style.gridTemplateColumns = side ? position === 'left' ? '150px minmax(0,1fr)' : 'minmax(0,1fr) 150px' : '';
    legend.style.flexDirection = side ? 'column' : 'row';
    const legendHeight = options.legend?.maxHeight;
    const scrollLegend = legendHeight !== undefined || frame.legend.length > 8;
    legend.style.maxBlockSize = legendHeight !== undefined ? legendHeight + 'px' : scrollLegend ? '12rem' : '';
    legend.style.overflowY = scrollLegend ? 'auto' : '';
    if (position === 'top' || side && position === 'left') chartArea.prepend(legend); else chartArea.append(legend);
    help.textContent = options.accessibility?.keyboard === false ? '' : labels.help;
    const heading=options.title??labels.chart,titleModel=content?.title?titleContext(frame,options.locale,options.title??frame.title):undefined,titleText=titleModel?contentText(content,'title',titleModel):heading;
    if(destroyed)return;
    renderContent(title,'title',titleModel,titleText);
    if(destroyed)return;
    description.textContent = options.accessibility?.description ?? options.description ?? ''; description.hidden = !description.textContent; root.setAttribute('aria-label', titleText||heading);
    root.tabIndex = options.accessibility?.keyboard === false ? -1 : 0;
    description.id = id + '-description'; root.setAttribute('aria-describedby', [description.textContent ? description.id : '', help.textContent ? help.id : ''].filter(Boolean).join(' '));
    const drawingKey = JSON.stringify([
      options.unit, options.theme, options.direction, options.themeTokens, options.locale,
      options.width, options.height, options.formatting, options.layout, options.appearance,
      options.axes, options.colorAxis, options.referenceBandStyles, options.referenceLabels,
      options.referenceStyles, options.annotations,
    ]);
    if (changed || drawingKey !== lastDrawing) { draw(); lastDrawing = drawingKey; }
    if(destroyed)return;
    const svg = plotElement();
    if (svg) svg.style.maxWidth = scrollable ? 'none' : '100%';
    const svgTitle = svg?.querySelector('title'), svgDescription = svg?.querySelector('desc');
    if (svgTitle) svgTitle.textContent = titleText; if (svgDescription) svgDescription.textContent = options.accessibility?.description ?? frame.description;
    overlay(); domContent?.clear(['legend']);legend.replaceChildren();
    if(destroyed)return;
    if (options.legend?.visible !== false) (options.legend?.reverse?[...frame.legend].reverse():frame.legend).forEach(item => {
      if(destroyed)return;
      const model=content?.legend?legendContext(frame,options.locale,item):undefined,fullLabel=model?contentText(content,'legend',model):item.name;
      if(destroyed)return;
      const characters=Array.from(fullLabel),limit=options.legend?.maxLabelCharacters??256,label=characters.length>limit?characters.slice(0,limit-1).join('')+'…':fullLabel;
      const interactive = options.legend?.interactive !== false;
      const b = interactive ? button(label,'legend') : element('span');
      if (!interactive) b.textContent=label;
      b.dataset.series=item.id;b.title=fullLabel;b.style.cssText='border-color:transparent;padding:4px 2px;max-width:100%;overflow-wrap:anywhere;box-sizing:border-box';
      if(interactive){b.setAttribute('aria-pressed',String(item.visible));b.setAttribute('aria-label',(item.visible?labels.hide:labels.show)+(fullLabel||item.name));}
      if(model&&content?.legend?.render){const labelHost=element('span');b.replaceChildren(labelHost);renderContent(labelHost,'legend',model,fullLabel);}
      if(destroyed)return;
      if(!item.visible)b.style.textDecoration='line-through';
      const mark=element('span'),custom=styles.get(item.id);mark.textContent=(custom?.marker==='square'?'■':custom?.marker==='diamond'?'◆':custom?.marker==='triangle'?'▲':custom?.dash==='dotted'?'┈':custom?.dash==='dashed'?'┄':'━')+' ';mark.setAttribute('aria-hidden','true');mark.style.color=seriesColor(item.id,item.color);
      if(custom?.pattern&&custom.pattern!=='none'){mark.textContent='';mark.style.cssText='display:inline-block;width:14px;height:12px;margin-inline-end:5px;border:1px solid currentColor';mark.style.backgroundColor=custom.color??item.color;mark.style.backgroundImage=custom.pattern==='dots'?'radial-gradient(white 1px,transparent 1px)':custom.pattern==='crosshatch'?'repeating-linear-gradient(45deg,transparent 0 3px,white 3px 4px),repeating-linear-gradient(-45deg,transparent 0 3px,white 3px 4px)':'repeating-linear-gradient(135deg,transparent 0 3px,white 3px 4px)';mark.style.backgroundSize='8px 8px';}
      if (!custom?.pattern && (frame.family === 'line' || frame.family === 'spline')) {
        const index = frame.legend.indexOf(item);
        mark.dataset.forcedSeries = String(index % 4);
      }
      b.prepend(mark);legend.append(b);
    });
    if(destroyed)return;
    const componentLines = options.legend?.visible !== false ? visibleComponentLines(frame) : [];
    if (componentLines.length) {
      const key = element('div', 'display:flex;flex-wrap:wrap;gap:6px 12px;flex-basis:100%;font-size:12px');
      key.setAttribute('role', 'group');
      key.setAttribute('aria-label', options.locale === 'es' ? 'Líneas de Ichimoku' : 'Ichimoku lines');
      key.dataset.componentLegend = '';
      for (const component of componentLines) {
        const item = element('span', 'display:inline-flex;gap:6px;align-items:center');
        item.dataset.component = component;
        const swatch = doc.createElementNS(svgNamespace, 'svg');
        swatch.setAttribute('width', '30');
        swatch.setAttribute('height', '8');
        swatch.setAttribute('viewBox', '0 0 30 8');
        swatch.setAttribute('aria-hidden', 'true');
        const line = doc.createElementNS(svgNamespace, 'path');
        line.setAttribute('d', 'M0,4 H30');
        line.setAttribute('stroke', 'currentColor');
        line.setAttribute('stroke-width', '2');
        const dash = componentDash(frame.family, component);
        if (dash) line.setAttribute('stroke-dasharray', dash);
        swatch.append(line);
        item.append(swatch, financialComponentLabel(component, options.locale));
        key.append(item);
      }
      legend.append(key);
    }
    legend.style.gap=options.legend?.itemSpacing===undefined?'8px 16px':options.legend.itemSpacing+'px';
    paintToolbar(labels);
    scroll = frame.viewport && options.viewport?.pan !== false
      ? horizontalViewportScroll(frame.viewport, frame.family === 'bar' || frame.family === 'vbp')
      : undefined;
    if (scrollbar === current && !scroll) root.focus({preventScroll:true});
    scrollbar.hidden = !scroll;
    if (scroll) {
      scrollbar.setAttribute('aria-label', labels.horizontalScroll);
      scrollbar.max = String(scroll.max);
      scrollbar.value = String(scroll.position);
      scrollbar.style.setProperty('--nc-scroll-thumb', scroll.visible * 100 + '%');
    }
    showDetail();
    if (destroyed) return;
    rawTable(); root.dataset.revision = String(revision); root.dataset.type = data.type;
    const replay = options.animation?.revision !== undefined && options.animation.revision !== lastAnimationRevision;
    lastAnimationRevision = options.animation?.revision;
    if (root.isConnected) motion.apply(options, changed || replay);
    if (focused && (doc.activeElement !== focused || focused.disabled)) {
      for (const target of root.querySelectorAll<HTMLButtonElement>('button[data-action]')) {
        if (target.dataset.action !== focused.dataset.action || target.dataset.series !== focused.dataset.series) continue;
        if (!target.disabled) { target.focus({preventScroll: true}); return; }
        break;
      }
      root.focus({preventScroll: true});
    }
  }
  function commit(nextData:ChartData,nextOptions:ChartOptions,nextContent?:ChartContentPorts,replaceContent=false):ChartResult<number>{
    if(destroyed)return invalid('DESTROYED');if(committing||contentDepth)return invalid('REENTRANT_UPDATE');committing=true;try{return performCommit(nextData,nextOptions,nextContent,replaceContent);}finally{committing=false;}
  }
  function commitInteraction(): void {
    const result = commit(data, baseOptions);
    if (result.status === 'invalid') mount.onDiagnostic?.(result.diagnostic);
  }
  function update(d: ChartData, o: ChartOptions | undefined, c: ChartContentPorts | undefined, replaceContent: boolean): ChartResult<number> {
    const result = commit(d, o ?? baseOptions, c, replaceContent);
    if (result.status === 'ok' && o !== undefined) viewportControlled = o.viewport?.value !== undefined;
    return result;
  }
  function performCommit(nextData: ChartData, nextOptions: ChartOptions,nextContent?:ChartContentPorts,replaceContent=false): ChartResult<number> {
    if (destroyed) return invalid('DESTROYED');
    if (gestures?.active()) gestures.cancel();
    const checked = validateOptions(nextOptions); if (checked.status === 'invalid') return checked;
    const requestedContent=replaceContent?nextContent:contentReference,contentChanged=requestedContent!==contentReference;let prepared=content;try{if(contentChanged)prepared=prepareContent(requestedContent);}catch{return invalid('INVALID_CONTENT_PORTS','content');}
    let next: ChartData; try { next = snapshot(nextData, false, data); } catch { return invalid('INVALID_DATA', 'data'); }
    if (!next || typeof next !== 'object' || Array.isArray(next)) return invalid('INVALID_DATA', 'data');
    const resolved=resolveResponsive(checked.value,measureHost()),effective=resolved===checked.value?checked:validateOptions(resolved);if(effective.status==='invalid')return effective;
    const o = effective.value;
    const pointError = pointStyleError(next, o);
    if (pointError) return invalid(pointError, 'options.appearance.points');
    const dimensions = size(o, next);
    const prepareFrame = (hiddenIds: readonly string[]) =>
      planWith(planner, next, o, dimensions, hiddenIds, { measureWords: requests => measureBrowserWords(doc, requests) });
    let h = o.hiddenSeriesIds ?? hidden; const describeGeometry = () => JSON.stringify([dimensions, o.layout, h, o.viewport, o.references, o.referenceBands, o.capacity,
      o.scales, o.hierarchy, o.colorAxis, o.appearance?.centerName, o.appearance?.bandColors, (next.type === 'pareto' || graphGroupData(next)) && o.locale === 'es']);
    let geometry = describeGeometry();
    let result = next === data && geometry === lastGeometry ? { status: 'ok' as const, value: { ...frame, title: o.title ?? 'Chart', description: o.description ?? '', unit: o.unit ?? '' } } : prepareFrame(h);
    if (result.status === 'invalid' && o.hiddenSeriesIds === undefined && h.length) {
      const visible = prepareFrame([]);
      if (visible.status === 'ok') {
        const current = new Set(visible.value.legend.map(item => item.id)), retained = h.filter(id => current.has(id));
        if (retained.length < h.length) { h = retained; geometry = describeGeometry(); result = h.length ? prepareFrame(h) : visible; }
      }
    }
    if (result.status === 'invalid') return result;
    const changed = next !== data || geometry !== lastGeometry;
    // Public Core frames are deeply immutable (verified across the catalogue).
    // Retain that owned value rather than copying every projected datum again.
    const immutable = Object.isFrozen(result.value) && Object.isFrozen(result.value.series) && Object.isFrozen(result.value.observations);
    let owned: PlanFrame; try { owned = changed && !immutable ? snapshot(result.value, true) : Object.freeze(result.value); } catch { return invalid('FRAME_RESOURCE_LIMIT', 'data'); }
    const dataChanged = data !== undefined && next !== data;
    if(contentChanged){domContent?.destroy();domContent=undefined;content=prepared;contentReference=requestedContent;lastDrawing='';}contentErrors.clear();
    const replayed = options.animation?.revision !== o.animation?.revision && o.animation?.revision !== undefined;
    if (next !== data || replayed) pinned = undefined;
    if (replayed) { active = undefined; selection = []; }
    data = next; baseOptions = checked.value; options = o; hidden = Object.freeze([...h]); frame = owned; lastGeometry = geometry; revision++;
    inset = plotBounds(frame, options);
    seriesDescriptions = new Map(options.accessibility?.seriesDescriptions?.map(entry => [entry.id, entry.description]));
    pointDescriptions = new Map(options.accessibility?.pointDescriptions?.map(entry => [pointKey(entry.id), entry.description]));
    styles = seriesStyles(options);
    colorsByPoint = pointColors(options, data);
    if (changed) {
    clearInteractionIndices();
    regionHit = frame.family === 'contour' ? undefined : preparePlanRegionHit(frame);
    seriesRanks = new Uint32Array(frame.observations.length);
    // Only an existing uncontrolled selection needs reconciliation against the
    // full source. Empty/applied selections must not index every offscreen datum.
    const reconcileSelection=options.selectedPoints===undefined&&selection.length>0;
    const source = data as unknown as Record<string, unknown>, valid = reconcileSelection?new Set<string>():undefined, standalone = reconcileSelection?new Set<string>():undefined;
    if(valid&&standalone){
      if (Array.isArray(source.series)) for (const s of source.series as Record<string, unknown>[]) if (Array.isArray(s.data)) for (const p of s.data as Record<string, unknown>[]) if (p.y !== null && p.value !== null) valid.add(pointKeyParts(String(s.id), String(p.id)));
      if (Array.isArray(source.data)) for (const p of source.data as Record<string, unknown>[]) if (p.value !== null) standalone.add(String(p.id));
      const visit = (value: unknown): void => { if (!value || typeof value !== 'object') return; const node = value as Record<string, unknown>; if (node.value !== null) standalone.add(String(node.id)); if (Array.isArray(node.children)) node.children.forEach(visit); }; if (source.root) visit(source.root);
    }
    frame.observations.forEach((o, i) => {
      const key = pointKey(o.id);
      observationIndices.set(key, i);
      valid?.add(key);
      if (mount.synchronization) observationsBySyncKey.set(syncKey(o, key), o);
      if (o.group) {
        let peers = observationGroups.get(o.group.key);
        if (!peers) observationGroups.set(o.group.key, peers = []);
        peers.push(o);
      } else if (!navigationUngrouped.has(o.id.seriesId)) {
        navigationUngrouped.set(o.id.seriesId, o);
      }
      let series = navigationSeries.get(o.id.seriesId);
      if (!series) navigationSeries.set(o.id.seriesId, series = []);
      seriesRanks[i] = series.length;
      series.push(o);
      if (!regionHit && frame.family !== 'contour') {
        const x = Math.floor(o.x / 32), y = Math.floor(o.y / 32);
        let row = index.get(x);
        if (!row) index.set(x, row = new Map());
        let bucket = row.get(y);
        if (!bucket) row.set(y, bucket = []);
        bucket.push(i);
      }
    });
    navigationGroups = [...navigationSeries.keys()];
    selection = options.selectedPoints ?? Object.freeze(selection.filter(id => valid?.has(pointKey(id)) || standalone?.has(id.pointId)));
    }
    else if (options.selectedPoints) selection = options.selectedPoints;
    if (!point()) active = undefined;
    paint(changed);
    if(destroyed)return invalid('DESTROYED');
    if (dataChanged && options.accessibility?.announceDataChanges) {
      const labels = messages(options.locale);
      status.textContent = labels.updated + frame.observations.length + labels.visibleObservations;
    }
    return { status: 'ok', value: revision };
  }
  const first = commit(initialData, initialOptions); if (first.status === 'invalid') return first;
  viewportControlled = options.viewport?.value !== undefined;
  ensureChartStyles(host);host.append(root);
  pruneAutomaticLabels();
  motion.apply(options, true);
  try { channel = mount.synchronization?.join(value => { if (destroyed) return; const o = value ? observationForKey(pointKey(value.id)) ?? observationsBySyncKey.get(value.key) : undefined; active = o?.id; overlay(); showDetail(); }); }
  catch { destroyed=true;domContent?.destroy();motion.destroy();root.remove();return invalid('INVALID_SYNCHRONIZATION'); }
  function proposeViewport(value: PlanViewportValue, validate: boolean): ChartResult<PlanViewportValue> {
    if (destroyed || !options.viewport || !frame.viewport) return invalid(destroyed ? 'DESTROYED' : 'VIEWPORT_UNAVAILABLE');
    const viewport = { ...options.viewport, value };
    if (!viewportControlled) {
      const result = commit(data, { ...baseOptions, viewport });
      if (result.status === 'invalid') return result;
    } else if (validate) {
      const result = planWith(planner, data, { ...options, viewport }, size(options, data), hidden);
      if (result.status === 'invalid') return result;
      value = result.value.viewport?.value ?? value;
    }
    mount.onViewportChange?.(value);
    return {status:'ok',value};
  }
  function applyViewport(intent: PlanViewportIntent, state: PlanViewportState | undefined = frame.viewport): ChartResult<PlanViewportValue> {
    if (!state || destroyed || !options.viewport) return invalid(destroyed ? 'DESTROYED' : 'VIEWPORT_UNAVAILABLE');
    const proposal = transformPlanViewport(state, intent);
    const result = proposal.status === 'ok' ? proposeViewport(proposal.value, false) : proposal;
    if (result.status === 'invalid') mount.onDiagnostic?.(result.diagnostic);
    return result;
  }
  gestures = viewportInput(drawing, () => ({ frame, options }), applyViewport, () => { motion.cancel(); if (!pinned) {detail.hidden = true;releaseContent(detail);} });
  function locate(e: PointerEvent): PlanObservation | undefined {
    const region = frame.family === 'venn' || frame.family === 'pictorial';
    const target = e.target as Element;
    const observation = region ? null : target?.getAttribute?.('data-observation');
    if (observation != null) return frame.observations[Number(observation)];
    // A filled region uses its exact SVG target. Blank space is not a datum.
    if (exactPointerFamilies.has(frame.family)) return;
    const box = plotElement()!.getBoundingClientRect();
    const x = (e.clientX - box.left) * inset.width / box.width - inset.left, y = (e.clientY - box.top) * inset.height / box.height - inset.top;
    if (region) return regionHit?.query(x, y);
    if (frame.family === 'contour') {
      // Levels share SVG paths, so index the individual projected segments on first use.
      regionHit ??= preparePlanRegionHit({...frame, observations: frame.observations.map(o => {
        if (!o.contour) return o;
        const {start, end} = o.contour, dx = end.x - start.x, dy = end.y - start.y;
        const length = Math.hypot(dx, dy);
        if (!length) return o;
        const nx = -dy * 8 / length, ny = dx * 8 / length;
        return {...o, hit: {type:'polygon', vertices:[
          {x:start.x+nx,y:start.y+ny}, {x:end.x+nx,y:end.y+ny},
          {x:end.x-nx,y:end.y-ny}, {x:start.x-nx,y:start.y-ny},
        ]}};
      })});
      return regionHit?.query(x, y);
    }
    let best: PlanObservation | undefined, distance = 32 * 32;
    const cellX = Math.floor(x / 32), cellY = Math.floor(y / 32);
    for (let dx = -1; dx <= 1; dx++) {
      const row = index.get(cellX + dx);
      if (!row) continue;
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = row.get(cellY + dy);
        if (!bucket) continue;
        for (const i of bucket) {
          const o = frame.observations[i]!, d = (x - o.x) ** 2 + (y - o.y) ** 2;
          if (d <= distance) { best = o; distance = d; }
        }
      }
    }
    return best;
  }
  function activate(o: PlanObservation, source: 'pointer' | 'keyboard'): void {
    const event = Object.freeze({ id: o.id, observation: o, source, revision });
    const next = selection.some(id => samePoint(id, o.id)) ? undefined : o.id; active = next;
    const proposed = next ? Object.freeze([next]) : Object.freeze([]);
    if (options.selectedPoints === undefined) selection = proposed;
    refreshInteraction(true); mount.onSelectionChange?.(proposed); if (!destroyed) mount.onPointActivate?.(event);
  }
  const move = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || destroyed || gestures?.active()) return;
    const next = locate(e)?.id;
    if (next === active || samePoint(active, next)) return;
    active = next;
    refreshInteraction();
  };
  const leave = (event: PointerEvent) => {
    if (event.relatedTarget instanceof win.Node && detail.contains(event.relatedTarget)) return;
    if (!gestures?.active() && doc.activeElement !== root) { active = selection[0]; refreshInteraction(); }
  };
  const click = (event: MouseEvent) => {
    const target = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
    const action = target?.dataset.action;
    if (downloadToolbar && target?.parentElement === downloadToolbar && !target.disabled && action?.startsWith('download-')) {
      void download(action.slice(9) as ChartDownloadFormat);
      return;
    }
    if (target === pin && options.tooltip?.pinnable) {
      pinned = pinned ? undefined : point()?.id;
      showDetail(true);
      return;
    }
    if (action === 'table-previous' || action === 'table-next') {
      tablePage?.(action === 'table-next' ? 1 : -1);
      return;
    }
    if (target && action === 'legend') { const key = target.dataset.series!, proposed = hidden.includes(key) ? hidden.filter(id => id !== key) : [...hidden, key];
      if (options.hiddenSeriesIds === undefined) { hidden = Object.freeze(proposed); commitInteraction(); } mount.onHiddenSeriesChange?.(Object.freeze(proposed)); return;
    }
    if (target && frame.viewport) {
      if (!target.disabled && action && Object.hasOwn(viewportActions, action)) {
        activateZoom(action as keyof typeof viewportActions);
      }
      return;
    }
    if (!drawing.contains(event.target as Node)) return;
    const o = locate(event as PointerEvent);
    if (o) { activate(o, 'pointer'); return; }
    const hadSelection = selection.length > 0;
    active = pinned = undefined;
    if (options.selectedPoints === undefined) selection = [];
    refreshInteraction(true);
    if (hadSelection && !destroyed) mount.onSelectionChange?.(Object.freeze([]));
  };
  const key = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && event.target === detail && !pinned) {
      active = undefined;
      root.focus({preventScroll: true});
      refreshInteraction(true);
      event.preventDefault();
      return;
    }
    if (event.key === 'Escape' && pinned && (event.target === root || event.target === pin || event.target === detail)) {
      event.preventDefault();
      pinned = undefined;
      if (event.target === detail) root.focus({preventScroll: true});
      showDetail(true);
      return;
    }
    if (options.accessibility?.keyboard === false) return;
    if (event.target === root && frame.viewport && options.viewport?.pan !== false && event.shiftKey
        && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      const bar = frame.family === 'bar' || frame.family === 'vbp';
      const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
      const axis = horizontal === bar ? 'y' : 'x';
      if (frame.viewport.axes !== 'xy' && frame.viewport.axes !== axis) return;
      const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
      const increasing = horizontal || bar ? !frame.viewport.reversed[axis] : frame.viewport.reversed[axis];
      event.preventDefault();
      applyViewport({type:'pan', delta:{[axis]:forward === increasing ? .2 : -.2}});
      return;
    }
    if (event.target === root && options.viewport && ['+', '=', '-', '0'].includes(event.key)) {
      event.preventDefault();
      activateZoom(event.key === '0' ? 'reset' : event.key === '-' ? 'zoom-out' : 'zoom-in');
      return;
    }
    if (event.target !== root || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Escape', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault(); const observations = frame.observations;
    if (event.key === 'Escape') { gestures?.cancel(); active = undefined; refreshInteraction(true); return; }
    if (event.key === 'Enter' || event.key === ' ') { const o = point(); if (o) activate(o, 'keyboard'); return; }
    const previous = point(), global = !previous || ['pie', 'donut', 'variablepie', 'sunburst', 'radialbar', 'polar', 'gauge', 'treemap', 'heatmap'].includes(frame.family), series = global ? observations : navigationSeries.get(previous.id.seriesId) ?? [];
    if ((event.key === 'Home' || event.key === 'End') && event.ctrlKey) active = (event.key === 'Home' ? observations[0] : observations[observations.length - 1])?.id;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const groups = navigationGroups, rank = previous ? groups.indexOf(previous.id.seriesId) : -1, next = groups[Math.max(0, Math.min(groups.length - 1, rank + (event.key === 'ArrowUp' ? -1 : 1)))];
      active = (previous?.group ? observationGroups.get(previous.group.key)?.find(o => o.id.seriesId === next) : next ? navigationUngrouped.get(next) : undefined)?.id ?? (next ? navigationSeries.get(next)?.[0]?.id : undefined);
    } else { const position = active ? observationIndices.get(pointKey(active)) : undefined; const rank = position === undefined ? -1 : global ? position : seriesRanks[position]!; const i = event.key === 'Home' ? 0 : event.key === 'End' ? series.length - 1 : Math.max(0, Math.min(series.length - 1, rank + (event.key === 'ArrowLeft' ? -1 : 1))); active = series[i]?.id; }
    const selected = point();
    if (selected && drawing.scrollWidth > drawing.clientWidth) {
      const svg = plotElement();
      if (svg) {
        const box = svg.getBoundingClientRect();
        const x = box.left + (selected.x + inset.left) * box.width / inset.width;
        const visible = drawing.getBoundingClientRect();
        if (x < visible.left + 16) drawing.scrollLeft += x - visible.left - 16;
        else if (x > visible.right - 16) drawing.scrollLeft += x - visible.right + 16;
      }
    }
    refreshInteraction(true);
  };
  for (let ancestor: HTMLElement | null = host; ancestor; ancestor = ancestor.parentElement) {
    const {overflowX, overflowY} = win.getComputedStyle(ancestor);
    const clips = /^(auto|scroll|hidden|clip)$/;
    const x = clips.test(overflowX), y = clips.test(overflowY);
    if (x || y) scrollports.push({node: ancestor, x, y});
  }
  function scrollDetail(): void {
    if (detail.hidden) return;
    const o = pinned ? observationForKey(pointKey(pinned)) : point();
    if (o) placeDetail(o);
  }
  function scrollViewport(): void {
    if (!scroll || scrollFrame || destroyed) return;
    scrollFrame = win.requestAnimationFrame(() => {
      scrollFrame = 0;
      const state = scroll;
      if (!state || destroyed) return;
      const delta = state.delta(scrollbar.valueAsNumber);
      if (delta) applyViewport({type:'pan', delta:{[state.axis]:delta}});
      // Restore the applied position when a controlled consumer rejects a proposal.
      if (!destroyed && scroll === state) scrollbar.value = String(state.position);
    });
  }
  const passive = {passive: true};
  const removeListeners = bindListeners([
    [drawing, 'pointermove', move],
    [drawing, 'pointerleave', leave],
    [detail, 'pointerleave', leave],
    [drawing, 'scroll', scrollDetail, passive],
    [scrollbar, 'input', scrollViewport],
    [zoomSlider, 'input', describeZoomLevel],
    ...scrollports.map(({node}) => [node, 'scroll', scrollDetail, passive] as const),
    [root, 'click', click],
    [root, 'keydown', key],
    [table, 'toggle', tableToggled],
  ]);
  win.addEventListener('scroll', scrollDetail, passive);
  win.addEventListener('resize', scrollDetail, passive);
  let observedWidth = measureHost();
  const observer = new win.ResizeObserver(() => { const width = measureHost(); if (Math.abs(width - observedWidth) < .5) return; observedWidth = width; if (!raf && !destroyed) raf = win.requestAnimationFrame(() => { raf = 0; if (!destroyed) commitInteraction(); }); }); observer.observe(host);
  function serialize(settings: import('./export-layout.js').SvgExportOptions): string {
    if (destroyed) throw Error('DESTROYED');
    if (contentDepth || committing) throw Error('REENTRANT_EXPORT');
    const hiddenLabels = new Set<number>();
    if (!Object.hasOwn(settings, 'content')) {
      plotElement()?.querySelectorAll('[data-label]').forEach((label, index) => {
        if (label.getAttribute('visibility') === 'hidden') hiddenLabels.add(index);
      });
    }
    return serializeChartExport(frame,options,id,active,selection,{...settings,...(!Object.hasOwn(settings,'content')&&content?{content}:{})},options.width??measureHost(),colorsByPoint,hiddenLabels);
  }
  function describeZoomLevel(): void {
    if (!zoomFormat || zoomLocale !== options.locale) {
      zoomLocale = options.locale;
      zoomFormat = new Intl.NumberFormat(zoomLocale, {maximumFractionDigits: 20});
    }
    const text = zoomFormat.format(zoomSlider.valueAsNumber) + '×';
    zoomValue.textContent = text;
    zoomSlider.setAttribute('aria-valuetext', text);
  }
  function syncZoomSlider(label: string): void {
    const {min = .1, max = 15, step = .1, increment = 1, label: configuredLabel} = options.viewport?.zoom ?? {};
    const previous = zoomSlider.valueAsNumber;
    if (zoomSlider.min !== String(min)) zoomSlider.min = String(min);
    if (zoomSlider.max !== String(max)) zoomSlider.max = String(max);
    if (zoomSlider.step !== String(step)) zoomSlider.step = String(step);
    zoomSlider.valueAsNumber = zoomInitial === increment ? previous : increment;
    zoomInitial = increment;
    zoomText.textContent = configuredLabel || label;
    describeZoomLevel();
  }
  function activateZoom(action: keyof typeof viewportActions): void {
    if (action === ChartToolbarAction.ResetZoom) {
      applyViewport(viewportActions.reset);
      return;
    }
    if (!frame.viewport) return;
    const adjustable = zoomLabel.isConnected;
    const amount = adjustable ? zoomSlider.valueAsNumber : 1;
    const current = viewportZoomLevel(frame.viewport);
    const {axes, bounds} = frame.viewport;
    const categoryCount = axes !== 'y' && bounds.x.type === 'category' ? bounds.x.ids.length : 0;
    const limit = adjustable ? Infinity : categoryCount ? categoryCount / Math.ceil(categoryCount / 20) : 20;
    const target = action === ChartToolbarAction.ZoomIn
      ? Math.max(current, Math.min(limit, current + amount))
      : Math.max(1, current - amount);
    if (target === 1 && current > 1) applyViewport(viewportActions.reset);
    else if (Number.isFinite(target) && target !== current) applyViewport({type:'zoom', factor:target / current});
  }
  function paintToolbar(labels: ReturnType<typeof messages>): void {
    const configured = options.toolbar?.actions ?? options.downloadMenu?.map(format => 'download-' + format) ?? [];
    const separate = options.viewport?.zoom?.position === ChartZoomPosition.Below;
    const actions: string[] = [];
    let hasZoom = false;
    for (const action of configured) {
      if (action === ChartToolbarAction.Zoom || Object.hasOwn(viewportActions, action)) {
        if (frame.viewport && !hasZoom) {
          if (!separate) actions.push(ChartToolbarAction.Zoom);
          hasZoom = true;
        }
      } else actions.push(action);
    }
    if (!hasZoom && frame.viewport && options.viewport?.controls !== false) {
      if (!separate) actions.unshift(ChartToolbarAction.Zoom);
      hasZoom = true;
    }
    const showSlider = hasZoom && options.viewport?.zoom?.showSlider === true;
    const focused = doc.activeElement as HTMLElement | null;
    const zoomFocused = focused !== null && zoomGroup?.contains(focused);
    if (zoomFocused && (!hasZoom || (!showSlider && focused === zoomSlider))) root.focus({preventScroll:true});
    if (!hasZoom) zoomGroup?.remove();
    const group = hasZoom ? syncZoomGroup(labels, showSlider, separate) : undefined;
    if (group && separate && chartArea.nextElementSibling !== group) chartArea.after(group);
    if (!actions.length) {
      downloadToolbar?.remove();
      downloadToolbar = undefined;
    } else {
      syncDownloadToolbar(actions, labels, group, separate);
    }
    if (zoomFocused && (showSlider || focused !== zoomSlider) && focused.isConnected && group?.contains(focused) && doc.activeElement !== focused) {
      focused.focus({preventScroll:true});
    }
  }
  function syncZoomGroup(labels: ReturnType<typeof messages>, showSlider: boolean, separate: boolean): HTMLDivElement {
    if (!zoomGroup) {
      zoomGroup = element('div', 'display:flex;align-items:center;gap:8px;min-width:0');
      zoomGroup.dataset.action = ChartToolbarAction.Zoom;
      zoomGroup.setAttribute('role', 'group');
      zoomGroup.append(...zoomButtons.map(action => button('', action)));
    }
    const group = zoomGroup;
    group.setAttribute('aria-label', labels.zoom);
    const position = separate ? ChartZoomPosition.Below : ChartZoomPosition.Toolbar;
    if (group.dataset.zoomPosition !== position) group.dataset.zoomPosition = position;
    if ((group.firstElementChild === zoomLabel) !== showSlider) {
      if (showSlider) group.prepend(zoomLabel);
      else zoomLabel.remove();
    }
    if (showSlider) syncZoomSlider(labels.zoom);
    [labels.zoomIn, labels.zoomOut, labels.reset].forEach((label, index) => {
      const child = group.children[index + Number(showSlider)] as HTMLButtonElement;
      if (child.title === label) return;
      child.title = label;
      child.setAttribute('aria-label', label);
    });
    return group;
  }
  function syncDownloadToolbar(
    actions: readonly string[], labels: ReturnType<typeof messages>, group: HTMLDivElement | undefined, separate: boolean,
  ): void {
    const toolbar = downloadToolbar ??= element('div', 'display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end');
    const position = (options.toolbar ? options.toolbar.position : options.downloadMenuPosition)
      ?? (group && !separate ? ChartDownloadMenuPosition.Top : ChartDownloadMenuPosition.Bottom);
    toolbar.dataset.downloadToolbar = position;
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', options.toolbar || (group && !separate) ? labels.toolbar : labels.downloads);
    const children = toolbar.children as HTMLCollectionOf<HTMLElement>;
    if (children.length !== actions.length || actions.some((action, index) => action !== children[index]?.dataset.action)) {
      toolbar.replaceChildren(...actions.map(action => action === ChartToolbarAction.Zoom && group
        ? group : button(action.slice(9).toUpperCase(), action)));
    }
    const above = position === ChartDownloadMenuPosition.Top;
    toolbar.style.margin = above ? '0 0 8px' : '8px 0 0';
    const anchor = !above && separate && group ? group : chartArea;
    if ((above ? anchor.previousElementSibling : anchor.nextElementSibling) !== toolbar) {
      anchor[above ? 'before' : 'after'](toolbar);
    }
  }
  function exportPng(settings: import('./export.js').PngExportOptions = {}): Promise<Blob> {
    let svg: string;
    try { svg = serialize(settings); } catch (error) { return Promise.reject(error); }
    const controller = new win.AbortController(), abort = () => controller.abort();
    exports.add(controller);
    settings.signal?.addEventListener('abort', abort, {once:true});
    if (settings.signal?.aborted) controller.abort();
    return rasterizeChartSvg(svg, doc, {...settings, signal:controller.signal}).finally(() => {
      exports.delete(controller);
      settings.signal?.removeEventListener('abort', abort);
    });
  }
  async function download(format: ChartDownloadFormat): Promise<void> {
    if (downloading) return;
    downloading = true;
    try {
      const {saveChartFile} = await import('./download.js');
      if (destroyed) return;
      const file = format === ChartDownloadFormat.Png ? await exportPng({pixelRatio:2}) :
        format === ChartDownloadFormat.Svg ? new win.Blob([serialize({})], {type:'image/svg+xml'}) :
          csvFile();
      if (!destroyed) saveChartFile(doc, file, id + '.' + format);
    } catch {
      if (!destroyed) mount.onDiagnostic?.(invalid('DOWNLOAD_FAILED', 'options.downloadMenu').diagnostic);
    } finally {
      downloading = false;
    }
  }
  function csvFile(): Blob {
    const result = exportChartCsv(data, {bom:true});
    if (result.status === 'invalid') throw Error(result.diagnostic.message);
    return new win.Blob([result.value], {type:'text/csv;charset=utf-8'});
  }
  return { status: 'ok', value: {
    update(d, o, c) { return update(d, o, c, arguments.length >= 3); }, getFrame: () => frame, getSelection: () => selection, getHiddenSeriesIds: () => hidden,
    updateOptions(o,c) { return update(data, o, c, arguments.length >= 2); },
    updateContent(c){return commit(data,baseOptions,c,true);},
    setViewport(value){return proposeViewport(value,true);},
    zoomBy(factor){return applyViewport({type:'zoom',factor});},
    resetViewport(){return applyViewport(viewportActions.reset);},
    exportSvg(settings={}){return serialize(settings);},
    exportCsv: settings => destroyed ? invalid('DESTROYED') : exportChartCsv(data, settings),
    exportPng,
    destroy() { if (destroyed) return; destroyed = true;domContent?.destroy();domContent=undefined;content=undefined;contentReference=undefined;contentErrors.clear();tablePage = undefined; focusLayer = undefined; barFocusFrame = undefined; focusDetail = undefined; barFocusBySeries.clear(); renderedPaths.clear(); gestures?.destroy(); motion.destroy(); channel?.leave(); exports.forEach(controller => controller.abort()); exports.clear(); observer.disconnect(); if (raf) win.cancelAnimationFrame(raf); if (scrollFrame) win.cancelAnimationFrame(scrollFrame); removeListeners(); win.removeEventListener('scroll', scrollDetail); win.removeEventListener('resize', scrollDetail); clearInteractionIndices(); regionHit = undefined; seriesRanks = new Uint32Array(0); navigationGroups = [];root.remove();for(const element of [drawing,legend,detail,table,plotRegion,chartArea,root])element.replaceChildren();mount=Object.freeze({instanceId:id}); },
  } };
}
