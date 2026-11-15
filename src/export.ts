import type { ChartData, ChartOptions, ChartPlanningPorts, ChartResult } from './types.js';
import { planWith, invalid, snapshot, validateOptions, type ChartPlanner } from './planning.js';
import {pointColors} from './series-style.js';
import {planDefaultChart} from './default-planner.js';
import {resolveResponsive} from './responsive.js';
import {serializeChartExport} from './export-layout.js';
import type {SvgExportOptions} from './export-layout.js';
import { plotSize, svgNamespace } from './svg.js';
import { describeChartData } from './table.js';
import {ownContent} from './content.js';
import {hexPaint} from './text-contrast.js';

export interface SvgRenderOptions extends SvgExportOptions { readonly instanceId: string; readonly ports?: ChartPlanningPorts; }
export interface CsvExportOptions { readonly delimiter?: ',' | ';'; readonly bom?: boolean; }
export interface PngExportOptions extends SvgExportOptions { readonly width?: number; readonly height?: number; readonly pixelRatio?: number; readonly background?: string; readonly signal?: AbortSignal; }

/** Pure SVG serialization, suitable for a Node/server import. Text layout is an explicit port. */
export function renderChartSvg(data: ChartData, options: ChartOptions, settings: SvgRenderOptions): ChartResult<string> {
  return renderSvgWith(planDefaultChart,data,options,settings);
}
/** Private shared serializer boundary; specific public entrypoints supply their planner. */
export function renderSvgWith(planner:ChartPlanner,data:ChartData,options:ChartOptions,settings:SvgRenderOptions):ChartResult<string>{
  if (!settings || !/^[A-Za-z][\w-]{0,127}$/.test(settings.instanceId)) return invalid('INVALID_INSTANCE_ID');
  try{ownContent(settings.content);}catch{return invalid('INVALID_CONTENT_PORTS','content');}
  const checked = validateOptions(options); if (checked.status === 'invalid') return checked;
  options = resolveResponsive(checked.value, checked.value.width ?? 640);
  if (options.appearance?.waterfall) {
    try { data = snapshot(data); } catch { return invalid('INVALID_DATA', 'data'); }
  }
  const frame = planWith(planner,data, options, plotSize(data, options, options.width ?? 640, settings.composition === 'chart'), options.hiddenSeriesIds ?? [], settings.ports);
  if (frame.status === 'invalid') return frame;
  try { return { status: 'ok', value: serializeChartExport(frame.value,options,settings.instanceId,undefined,options.selectedPoints??[],{...settings,composition:settings.composition??'plot'},options.width??640,pointColors(options,data)) }; }
  catch { return invalid('SVG_SERIALIZATION_FAILED'); }
}

/** Exports original data, not rounded tooltip values or decimated geometry. */
export function exportChartCsv(data: ChartData, options: CsvExportOptions = {}): ChartResult<string> {
  if (!options || options.delimiter !== undefined && options.delimiter !== ',' && options.delimiter !== ';' || options.bom !== undefined && typeof options.bom !== 'boolean') return invalid('INVALID_CSV_OPTIONS');
  const result = describeChartData(data); if (result.status === 'invalid') return result;
  const cell = (value: string): string => {
    // Spreadsheet formula injection is not enabled by quoting alone. Preserve real signed numbers.
    const safe = /^[\s]*[=+@\-\t\r]/.test(value) && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) ? "'" + value : value;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  return { status: 'ok', value: (options.bom ? '\ufeff' : '') + [result.value.columns, ...result.value.rows].map(row => row.map(cell).join(options.delimiter ?? ',')).join('\r\n') + '\r\n' };
}

/** Canvas is used only as an export rasterizer; interactive charts remain SVG. */
const exportElements = /* @__PURE__ */ new Set(['svg', 'g', 'title', 'desc', 'defs', 'clipPath', 'path', 'rect', 'circle', 'polygon', 'text', 'tspan', 'linearGradient', 'stop', 'pattern']);
export function rasterizeChartSvg(svg: string, document: Document, settings: PngExportOptions = {}): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const win = document.defaultView;
    if (!win) { reject(new Error('BROWSER_DOCUMENT_REQUIRED')); return; }
    if (typeof svg !== 'string' || svg.length > 16000000 || /<!DOCTYPE|<!ENTITY/i.test(svg)) throw Error('SELF_CONTAINED_SVG_REQUIRED');
    const element = new win.DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
    // The element allowlist also excludes parser errors and active content.
    const invalidElement = (node: Element) => node.namespaceURI !== svgNamespace || !exportElements.has(node.localName) ||
      [...node.attributes].some(a => /^on/i.test(a.name) || /(?:href|src)$/i.test(a.name) && !a.value.startsWith('#') ||
        /@import|url\(/i.test(a.value.replace(/url\(\s*['"]?#[\w:.-]+['"]?\s*\)/gi, '')));
    if (element.localName !== 'svg' || invalidElement(element) || [...element.querySelectorAll('*')].some(invalidElement)) {
      throw Error('SELF_CONTAINED_SVG_REQUIRED');
    }
    const box = element.getAttribute('viewBox')?.split(/[ ,]+/).map(Number), ratio = settings.pixelRatio ?? 1, width = settings.width ?? box?.[2], height = settings.height ?? (width && box?.[2] && box?.[3] ? width * box[3] / box[2] : undefined);
    if (!width || !height || ![width, height, ratio].every(Number.isFinite) || width < 1 || height < 1 || ratio < .25 || ratio > 4 || Math.ceil(width * ratio) * Math.ceil(height * ratio) > 16777216 || settings.background !== undefined && !hexPaint.test(settings.background)) { reject(new Error('INVALID_PNG_DIMENSIONS')); return; }
    const originalStyle = element.getAttribute('style') ?? '', sourceBackground = /(?:^|;)\s*background(?:-color)?\s*:\s*(#[\da-f]+)\s*(?:;|$)/i.exec(originalStyle)?.[1];
    const background = settings.background ?? (sourceBackground && hexPaint.test(sourceBackground) ? sourceBackground : undefined);
    const clearBackground = (node: Element, style: string) =>
      node.setAttribute('style', style.replace(/(?:^|;)\s*background(?:-color)?\s*:[^;]*/gi, '') + ';background:transparent!important');
    if (background) clearBackground(element, originalStyle);
    if(settings.background!==undefined){
      // Only serializer-owned background paint is replaced. Marks, pattern
      // cells and arbitrary user SVG rectangles retain their original fills.
      for(const paint of element.querySelectorAll('rect[data-export-background]'))paint.remove();
      for (const nested of element.querySelectorAll('svg')) clearBackground(nested, nested.getAttribute('style') ?? '');
    }
    const source = background ? new win.XMLSerializer().serializeToString(element) : svg;
    const image = new win.Image(), canvas = document.createElement('canvas');
    let url: string | undefined, finished = false;
    const finish = (error?: Error, blob?: Blob): void => {
      if (finished) return; finished = true;
      settings.signal?.removeEventListener('abort', abort); image.onload = image.onerror = null; image.src = '';
      if (url) win.URL.revokeObjectURL(url); canvas.width = canvas.height = 0;
      if (error) reject(error); else if (blob) resolve(blob); else reject(new Error('PNG_ENCODING_FAILED'));
    };
    const abort = () => finish(new Error('EXPORT_ABORTED'));
    if (settings.signal?.aborted) { abort(); return; }
    settings.signal?.addEventListener('abort', abort, { once: true });
    image.onerror = () => finish(new Error('SVG_IMAGE_DECODE_FAILED'));
    image.onload = () => {
      if (finished) return;
      try {
        canvas.width = Math.ceil(width * ratio); canvas.height = Math.ceil(height * ratio);
        const context = canvas.getContext('2d'); if (!context) { finish(new Error('CANVAS_CONTEXT_UNAVAILABLE')); return; }
        if (background) { context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height); }
        context.drawImage(image, 0, 0, canvas.width, canvas.height); canvas.toBlob(blob => finish(undefined, blob ?? undefined), 'image/png');
      } catch (error) { finish(error instanceof Error ? error : new Error('PNG_EXPORT_FAILED')); }
    };
    try { url = win.URL.createObjectURL(new win.Blob([source], { type: 'image/svg+xml;charset=utf-8' })); image.src = url; } catch (error) { finish(error instanceof Error ? error : new Error('PNG_EXPORT_FAILED')); }
  });
}
