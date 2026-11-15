import type { planChart } from '@neural-charts/core';
import type { PlanSpec, PlanOptions, PlanFrame } from '@neural-charts/core';
import type { ChartData, ChartNumberFormat, ChartOptions, ChartResult, ChartPlanningPorts, ChartType } from './types.js';
import { ChartDownloadFormat, ChartDownloadMenuPosition, ChartToolbarAction } from './types.js';
import { chartCapabilities, isSupportedChartType } from './capabilities.js';
import { allLayoutKeys, layoutKeysFor, translatedLayoutKeysFor } from './layout.js';
import { planDefaultChart } from './default-planner.js';
import {numberFormatter, dateFormatter} from './format.js';
import {resolveResponsive} from './responsive.js';

import {pointStyleError} from './series-style.js';
import {hexPaint} from './text-contrast.js';

const {hasOwn} = Object;
const dashOptions = ['solid', 'dashed', 'dotted'];
const labelLayouts = ['auto', 'all', 'truncate'];

function allChartTypes(): readonly ChartType[] { return Object.freeze(Object.keys(chartCapabilities).filter(isSupportedChartType)); }
export const chartTypes = /* @__PURE__ */ allChartTypes();
export function invalid(reason: string, path = 'options', message = reason): Extract<ChartResult<never>, {status: 'invalid'}> { return { status: 'invalid', diagnostic: { code: 'INVALID_CONFIG', reason, path, message } }; }
/** Copy data without executing accessors. No engine calculation is performed here. */
// Root provenance is enough: when traversing a validated previous root, each
// previous child comes from that same owned graph. Per-datum WeakSet entries
// leave large backing tables/tombstones under repeated create/destroy churn.
const ownedInputs = new WeakSet<object>();
const ownedFrames = new WeakSet<object>();
// Borrowed caller-frozen objects can include live/revocable proxies. Only
// graphs completely constructed by this copier qualify for tree-walk reuse.
// Store coarse roots/arrays only, not another weak entry for every datum.
const detachedInputs = new WeakSet<object>();
// Only snapshot-owned, deeply immutable roots enter this cache. Presentation
// validation is independent of options; Core/capacity validation still runs.
const presentationCheckedData = new WeakSet<object>();
export function snapshot<T>(input: T, allowUndefined = false, previous?: T): T {
  const active = new Set<object>(); let count = 0;
  const limit = allowUndefined ? 2000000 : 250000;
  let lastDetached=true;
  const owned = allowUndefined ? ownedFrames : ownedInputs;
  function copy(value: unknown, depth: number, prior?: unknown, priorDetached=false,priorOwned=false): unknown {
    lastDetached=true;
    if (++count > limit || depth > 64) throw Error('INPUT_LIMIT');
    if (typeof value === 'number' && !Number.isFinite(value)) throw Error('INVALID_NUMBER');
    if (value === undefined && !allowUndefined) throw Error('EXPLICIT_UNDEFINED');
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === undefined) return value;
    if (typeof value !== 'object' || active.has(value)) throw Error('PLAIN_DATA_REQUIRED');
    // A whole validated root fits this mode's fixed budget. Nested reuse must
    // still charge all nodes/depth, otherwise repeating an owned fragment could
    // bypass limits (for example in a table-only consumer).
    if (depth === 0 && owned.has(value)) { lastDetached=detachedInputs.has(value); return value; }
    const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
    if (!array && proto !== Object.prototype && proto !== null) throw Error('PLAIN_DATA_REQUIRED');
    const keys = Reflect.ownKeys(value);
    if (array && !allowUndefined && (value.length > 250000 || keys.length !== value.length + 1)) throw Error('INPUT_LIMIT');
    const reusable = prior !== null && typeof prior === 'object' && priorOwned && Array.isArray(prior) === array &&
      (priorDetached ? array ? (prior as unknown[]).length + 1 : Object.keys(prior).length : Reflect.ownKeys(prior).length) === keys.length;
    const candidate = reusable ? prior : Object.isFrozen(value) ? value : undefined;
    const candidateDetached=!allowUndefined&&!!candidate&&((candidate===prior&&priorDetached)||detachedInputs.has(candidate as object));
    active.add(value); let detached=true, out: Record<string, unknown> | unknown[] | undefined = candidate ? undefined : array ? [] : {};
    for (let i = 0; i < keys.length; i++) { const key = keys[i]!;
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || key === '__proto__' || key === 'constructor' || key === 'prototype') throw Error('UNSUPPORTED_PROPERTY');
      const d = Object.getOwnPropertyDescriptor(value, key)!;
      if (!hasOwn(d, 'value') || !d.enumerable) throw Error('ACCESSOR_NOT_ALLOWED');
      // Detached snapshots contain only our own frozen data descriptors. Compare
      // their values directly while still validating every caller property above.
      const old = candidate && !candidateDetached ? Object.getOwnPropertyDescriptor(candidate, key) : undefined;
      const hadKey = candidateDetached ? hasOwn(candidate!, key) : old !== undefined;
      const oldValue = candidateDetached && hadKey ? (candidate as Record<string, unknown>)[key] : old?.value;
      let child: unknown;
      if (candidateDetached && hadKey && d.value === oldValue && (oldValue === null || typeof oldValue !== 'object')) {
        if (++count > limit || depth === 64) throw Error('INPUT_LIMIT');
        lastDetached = true;
        child = oldValue;
      } else {
        child = copy(d.value, depth + 1, oldValue, candidateDetached, !!candidate && (candidate === prior ? priorOwned : owned.has(candidate as object)));
      }
      if(!lastDetached)detached=false;
      if (!out && (!hadKey || child !== oldValue)) {
        if (array && candidateDetached && key === String(i)) {
          // Numeric own keys precede length and named keys. At index i, key i
          // implies that the whole preceding prefix is dense and already checked.
          const priorArray = candidate as readonly unknown[];
          out = Array.from({length: i}, (_, index) => priorArray[index]);
        } else {
          out = array ? [] : {};
          for (const earlier of keys.slice(0, i)) if (earlier !== 'length') Object.defineProperty(out, earlier, { enumerable: true, value: Object.getOwnPropertyDescriptor(candidate, earlier)!.value });
        }
      }
      if (out) Object.defineProperty(out, key, { enumerable: true, value: child });
    }
    active.delete(value); if (!out) { if(depth===0)owned.add(candidate as object);lastDetached=candidateDetached;return candidate; }
    const result = Object.freeze(out);if(depth===0)owned.add(result);lastDetached=detached;
    if(!allowUndefined&&detached&&(depth===0||array))detachedInputs.add(result);return result;
  }
  return copy(input,0,previous,previous!==null&&typeof previous==='object'&&detachedInputs.has(previous),previous!==null&&typeof previous==='object'&&owned.has(previous)) as T;
}
function object(value: unknown, keys?: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('OBJECT_REQUIRED');
  const r = value as Record<string, unknown>;
  if (keys && Object.keys(r).some(key => !keys.includes(key))) throw Error('UNKNOWN_OPTION');
  return r;
}
const numeric = (v: unknown, min: number, max: number) => { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw Error('OPTION_OUT_OF_RANGE'); };
const strings = (r: Record<string, unknown>, keys: string[]) => { for (const k of keys) if (hasOwn(r, k) && (typeof r[k] !== 'string' || (r[k] as string).length > 4096)) throw Error('TEXT_REQUIRED'); };
const booleans = (r: Record<string, unknown>, keys: string[]) => { for (const k of keys) if (hasOwn(r, k) && typeof r[k] !== 'boolean') throw Error('BOOLEAN_REQUIRED'); };
function checkOption(value: unknown, choices: readonly unknown[], reason: string): void {
  if (value !== undefined && !choices.includes(value)) throw Error(reason);
}
function checkLegacyChoice(value: unknown, choices: readonly string[], reason: string): void {
  if (value !== undefined) checkOption(String(value), choices, reason);
}
function checkOwnedRanges(record: Record<string, unknown>, keys: readonly string[], min: number, max: number): void {
  for (const key of keys) checkRange(record[key], min, max);
}
function checkRange(value: unknown, min: number, max: number): void {
  if (value !== undefined) numeric(value, min, max);
}
function checkInteger(value: unknown, min: number, max: number, reason: string): void {
  if (value === undefined) return;
  numeric(value, min, max);
  if (!Number.isInteger(value)) throw Error(reason);
}
function checkTextLength(value: unknown, max: number, reason: string): void {
  if (value !== undefined && (typeof value !== 'string' || value.length > max)) throw Error(reason);
}
function checkPaint(value: unknown): void {
  if (value !== undefined) validatePaint(value);
}
function boundedList<T>(value: readonly T[] | undefined, limit: number, reason: string): readonly T[] {
  if (!Array.isArray(value) || value.length > limit) throw Error(reason);
  return value;
}
function validateTextEntry(value: unknown, keys: readonly string[]): void {
  const entry = object(value, keys);
  strings(entry, ['id', 'text']);
  if (!entry.id || typeof entry.text !== 'string') throw Error('LABEL_ID_TEXT_REQUIRED');
}
function validatePalette(value: unknown): void {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) throw Error('HEX_PALETTE_REQUIRED');
  for (const color of value) validatePaint(color);
}
function validatePaint(value: unknown, reason = 'HEX_PALETTE_REQUIRED', opaque = false): void {
  if (typeof value !== 'string' || !hexPaint.test(value) || (opaque && value.length === 9)) throw Error(reason);
}
function validateTextStyle(value: unknown): void {
  const style = object(value, ['align', 'color', 'fontSize', 'fontWeight']);
  checkOption(style.align, ['left', 'center', 'right'], 'INVALID_TEXT_ALIGN');
  checkPaint(style.color);
  checkRange(style.fontSize, 8, 48);
  checkOption(style.fontWeight, [400, 500, 600, 700], 'INVALID_FONT_WEIGHT');
}

function checkFormatChoice(value: unknown, compatible: boolean, choices: readonly string[], reason: string): void {
  if (value !== undefined && (!compatible || !choices.includes(value as string))) throw Error(reason);
}

function validateNumberFormat(value: unknown, partial: boolean, locale?: ChartOptions['locale'], formatLocale?: string): void {
  const format = object(value, ['style', 'currency', 'currencyDisplay', 'currencySign', 'unit', 'unitDisplay', 'prefix', 'suffix', 'notation', 'minimumFractionDigits', 'maximumFractionDigits', 'useGrouping', 'signDisplay']);
  for (const key of ['prefix', 'suffix']) checkTextLength(format[key], 128, 'INVALID_NUMBER_AFFIX');
  for (const key of ['minimumFractionDigits', 'maximumFractionDigits']) {
    checkInteger(format[key], 0, 20, 'INTEGER_DIGITS_REQUIRED');
  }
  booleans(format, ['useGrouping']);
  checkOption(format.style, ['decimal', 'percent', 'currency', 'unit'], 'INVALID_NUMBER_STYLE');
  checkOption(format.notation, ['standard', 'scientific', 'engineering', 'compact'], 'INVALID_NUMBER_NOTATION');
  checkOption(format.signDisplay, ['auto', 'never', 'always', 'exceptZero'], 'INVALID_SIGN_DISPLAY');

  const {style, currency: code, unit: measurement} = format;
  const inherited = partial && style === undefined;
  const currency = style === 'currency';
  const unit = style === 'unit';
  if (code !== undefined && (!inherited && !currency || typeof code !== 'string' || !/^[A-Z]{3}$/.test(code))) throw Error('INVALID_CURRENCY');
  if (currency && code === undefined && !partial) throw Error('CURRENCY_REQUIRED');
  checkFormatChoice(format.currencyDisplay, inherited || currency, ['symbol', 'narrowSymbol', 'code', 'name'], 'INVALID_CURRENCY_DISPLAY');
  checkFormatChoice(format.currencySign, inherited || currency, ['standard', 'accounting'], 'INVALID_CURRENCY_SIGN');
  if (measurement !== undefined && (!inherited && !unit || typeof measurement !== 'string' || !measurement || measurement.length > 128)) throw Error('INVALID_MEASUREMENT_UNIT');
  if (unit && measurement === undefined && !partial) throw Error('MEASUREMENT_UNIT_REQUIRED');
  checkFormatChoice(format.unitDisplay, inherited || unit, ['short', 'narrow', 'long'], 'INVALID_UNIT_DISPLAY');

  if (!partial) {
    try {
      numberFormatter({
        ...(locale === undefined ? {} : {locale}),
        formatting: { ...(formatLocale === undefined ? {} : {locale: formatLocale}), number: value as ChartNumberFormat },
      })(0);
    } catch {
      throw Error('INVALID_NUMBER_FORMAT');
    }
  }
}

const toolbarActions = Object.values(ChartToolbarAction);
const toolbarPositions = Object.values(ChartDownloadMenuPosition);
const downloadFormats = Object.values(ChartDownloadFormat);

function validateOrderedChoices<T>(value: readonly T[], choices: readonly T[], reason: string): void {
  const entries = boundedList(value, choices.length, reason);
  if (entries.some(entry => !choices.includes(entry)) || new Set(entries).size !== entries.length) throw Error(reason);
}

export function validateOptions(options: ChartOptions, partialNumberFormats=false): ChartResult<ChartOptions> {
  try {
    const o = snapshot(options), r = object(o, ['title', 'description', 'unit', 'theme', 'direction', 'width', 'height', 'layout', 'appearance', 'axes', 'legend', 'tooltip', 'viewport', 'hiddenSeriesIds', 'selectedPoints', 'references', 'colorAxis', 'locale', 'themeTokens', 'animation', 'capacity', 'scales', 'hierarchy', 'referenceBands', 'referenceBandStyles', 'referenceLabels', 'referenceStyles', 'annotations', 'responsive', 'accessibility', 'formatting', 'downloadMenu', 'downloadMenuPosition', 'toolbar']);
    if (Object.values(r).some(v => v === null)) throw Error('NULL_OPTION');
    if (o.downloadMenu !== undefined) validateOrderedChoices(o.downloadMenu, downloadFormats, 'INVALID_DOWNLOAD_MENU');
    checkOption(o.downloadMenuPosition, toolbarPositions, 'INVALID_DOWNLOAD_MENU_POSITION');
    if (o.toolbar !== undefined) {
      object(o.toolbar, ['actions', 'position']);
      validateOrderedChoices(o.toolbar.actions, toolbarActions, 'INVALID_TOOLBAR_ACTIONS');
      checkOption(o.toolbar.position, toolbarPositions, 'INVALID_TOOLBAR_POSITION');
    }
    for (const key of ['layout', 'appearance', 'axes', 'legend', 'tooltip', 'viewport']) if (hasOwn(r, key) && (typeof r[key] !== 'object' || Array.isArray(r[key]))) throw Error('OBJECT_REQUIRED');
    strings(r, ['title', 'description', 'unit']);
    checkOption(o.theme, ['light', 'dark'], 'INVALID_THEME');
    checkOption(o.locale, ['en', 'es'], 'INVALID_LOCALE');
    if (o.themeTokens) { const tokens = object(o.themeTokens, ['background', 'foreground', 'muted', 'grid', 'focus']); for (const value of Object.values(tokens)) validatePaint(value, 'HEX_THEME_REQUIRED', true); }
    checkOption(o.direction, ['ltr', 'rtl'], 'INVALID_DIRECTION');
    checkOwnedRanges(r, ['width', 'height'], 160, 10000);
    if (r.formatting !== undefined) {
      const f = object(o.formatting, ['locale', 'number', 'date']);
      if(f.locale!==undefined){
        if(typeof f.locale!=='string'||!f.locale||f.locale.length>128)throw Error('INVALID_FORMAT_LOCALE');
        try{Intl.getCanonicalLocales(f.locale);}catch{throw Error('INVALID_FORMAT_LOCALE');}
      }
      if (hasOwn(f, 'date')) {
        const d = object(f.date, ['timeZone', 'year', 'month', 'day', 'hour', 'minute', 'second', 'weekday', 'hourCycle']);
        checkTextLength(d.timeZone, 128, 'INVALID_TIME_ZONE');
        for (const key of ['year', 'day', 'hour', 'minute', 'second']) checkLegacyChoice(d[key], ['numeric', '2-digit'], 'INVALID_DATE_FIELD');
        checkLegacyChoice(d.month, ['numeric', '2-digit', 'short', 'long', 'narrow'], 'INVALID_DATE_FIELD');
        checkLegacyChoice(d.weekday, ['short', 'long', 'narrow'], 'INVALID_DATE_FIELD');
        checkLegacyChoice(d.hourCycle, ['h11', 'h12', 'h23', 'h24'], 'INVALID_HOUR_CYCLE');
        dateFormatter(o)(0);
      }
      if (hasOwn(f, 'number')) validateNumberFormat(f.number, partialNumberFormats, o.locale, o.formatting?.locale);
    }
    if (r.responsive !== undefined) {
      for (const rule of boundedList(o.responsive, 32, 'RESPONSIVE_RULE_LIMIT')) {
        const entry = object(rule, ['minWidth', 'maxWidth', 'options']);
        checkOwnedRanges(entry, ['minWidth', 'maxWidth'], 0, 100000);
        if ((rule.minWidth ?? 0) > (rule.maxWidth ?? Infinity)) throw Error('RESPONSIVE_WIDTH_RANGE');
        object(rule.options, ['height', 'legend', 'axes', 'appearance', 'tooltip']);
        // Shape/types are checked here; dependencies such as currency/unit
        // resolve after the patch inherits its active base. The effective full
        // configuration is validated again by commit/planWith before use.
        const valid = validateOptions(rule.options,true); if (valid.status === 'invalid') throw Error(valid.diagnostic.reason);
      }
    }
    if (r.accessibility !== undefined) {
      const a = object(o.accessibility, ['description', 'keyboard', 'announceDataChanges', 'seriesDescriptions', 'pointDescriptions']);
      strings(a, ['description']); booleans(a, ['keyboard', 'announceDataChanges']);
      for (const key of ['seriesDescriptions', 'pointDescriptions'] as const) if (a[key] !== undefined) {
        type Description = NonNullable<NonNullable<ChartOptions['accessibility']>[typeof key]>[number];
        const list = boundedList<Description>(o.accessibility?.[key], 1000, 'ACCESSIBILITY_DESCRIPTION_LIMIT');
        const ids = new Set<string>();
        for (const item of list) {
          object(item, ['id', 'description']); strings(item as unknown as Record<string, unknown>, ['description']);
          if (typeof item.description !== 'string') throw Error('TEXT_REQUIRED');
          if (key === 'seriesDescriptions') { if (typeof item.id !== 'string' || !item.id) throw Error('INVALID_SERIES_ID'); }
          else { const id = object(item.id, ['seriesId', 'pointId']); if (typeof id.seriesId !== 'string' || typeof id.pointId !== 'string') throw Error('INVALID_POINT_ID'); }
          const id = JSON.stringify(item.id); if (ids.has(id)) throw Error('DUPLICATE_ACCESSIBILITY_ID'); ids.add(id);
        }
      }
    }
    if (o.layout) { const l = object(o.layout, allLayoutKeys);
      checkLegacyChoice(l.orientation, ['vertical', 'horizontal'], 'INVALID_ORIENTATION');
      checkLegacyChoice(l.stacking, ['sum', 'percent'], 'INVALID_STACKING');
      checkOwnedRanges(l, ['groupGap', 'barGap'], 0, 1);
      checkRange(l.maxBarWidth, 1, 10000);
    }
    if (o.appearance) { const a = object(o.appearance, ['colors', 'series', 'points', 'bandColors', 'lineWidth', 'markers', 'markerRadius', 'dataLabels', 'stackLabels', 'centerName', 'risingColor', 'fallingColor', 'labelLimit', 'dataLabelLayout', 'titleStyle', 'descriptionStyle', 'minPlotWidth', 'waterfall']); booleans(a, ['markers', 'dataLabels', 'stackLabels']); strings(a, ['centerName']);
      for (const key of ['titleStyle', 'descriptionStyle']) if (hasOwn(a, key)) validateTextStyle(a[key]);
      checkRange(a.minPlotWidth, 0, 1600);
      if (hasOwn(a, 'waterfall')) {
        const style = object(a.waterfall, ['positiveColor', 'negativeColor', 'totalColor', 'connectorColor']);
        for (const color of Object.values(style)) validatePaint(color);
      }
      checkOption(a.dataLabelLayout, labelLayouts, 'INVALID_DATA_LABEL_LAYOUT');
      if (hasOwn(a, 'points')) {
        const points = boundedList(o.appearance.points, 256, 'POINT_STYLE_LIMIT');
        const seen = new Set<string>();
        for (const style of points) {
          const entry = object(style, ['seriesId', 'pointId', 'color']);
          strings(entry, ['seriesId', 'pointId', 'color']);
          if (!style.seriesId || !style.pointId || style.seriesId.length > 256 || style.pointId.length > 256) throw Error('INVALID_POINT_STYLE_ID');
          validatePaint(style.color);
          const key = JSON.stringify([style.seriesId, style.pointId]);
          if (seen.has(key)) throw Error('DUPLICATE_POINT_STYLE_ID');
          seen.add(key);
        }
      }
      if (hasOwn(a, 'series')) {
        const ids = new Set<string>();
        for (const style of boundedList(o.appearance.series, 128, 'SERIES_STYLE_LIMIT')) {
          object(style, ['id', 'color', 'dash', 'marker', 'markerRadius', 'fillOpacity', 'pattern', 'markerFill', 'markerStroke', 'markerStrokeWidth']);
          if (typeof style.id !== 'string' || !style.id || style.id.length > 256 || ids.has(style.id)) throw Error('INVALID_SERIES_STYLE_ID'); ids.add(style.id);
          checkPaint(style.color);
          checkOption(style.dash, dashOptions, 'INVALID_DASH');
          checkOption(style.marker, ['circle', 'square', 'diamond', 'triangle'], 'INVALID_MARKER');
          checkRange(style.markerRadius, 1, 16);
          checkPaint(style.markerFill);
          checkPaint(style.markerStroke);
          checkRange(style.markerStrokeWidth, 0, 8);
          checkRange(style.fillOpacity, 0, 1);
          checkOption(style.pattern, ['none', 'diagonal', 'dots', 'crosshatch'], 'INVALID_PATTERN');
        }
      }
      checkRange(a.lineWidth, .5, 12);
      checkRange(a.markerRadius, 1, 16);
      for (const key of ['colors', 'bandColors']) if (hasOwn(a, key)) validatePalette(a[key]);
    }
    if (o.axes) { const a = object(o.axes, ['grid', 'x', 'y', 'secondaryY']); booleans(a, ['grid']); for (const key of ['x', 'y', 'secondaryY']) if (hasOwn(a, key)) {
      const x = object(a[key], ['visible', 'title', 'numberFormat', 'labels', 'titleStyle']); strings(x, ['title']); booleans(x, ['visible']);
      if (hasOwn(x, 'titleStyle')) validateTextStyle(x.titleStyle);
      if (hasOwn(x, 'numberFormat')) validateNumberFormat(x.numberFormat, partialNumberFormats);
      if (hasOwn(x, 'labels')) { const l = object(x.labels, ['maxLines', 'maxCharacters', 'rotation', 'layout']);
        checkOption(l.layout, labelLayouts, 'INVALID_AXIS_LABEL_LAYOUT');
        if (l.maxLines !== undefined && (![1, 2, 3].includes(Number(l.maxLines)) || typeof l.maxLines !== 'number')) throw Error('INVALID_LABEL_LINES');
        checkInteger(l.maxCharacters, 3, 80, 'INVALID_LABEL_CHARACTERS');
        checkRange(l.rotation, -90, 90);
      }
    } }
    if (o.legend) { const l = object(o.legend, ['visible', 'position', 'interactive', 'reverse', 'maxLabelCharacters', 'itemSpacing']); booleans(l, ['visible', 'interactive', 'reverse']); checkLegacyChoice(l.position, ['top', 'bottom', 'left', 'right'], 'INVALID_LEGEND_POSITION');
      checkInteger(l.maxLabelCharacters, 3, 256, 'INVALID_LEGEND_LABEL_LIMIT');
      checkRange(l.itemSpacing, 0, 32);
    }
    if (o.tooltip) {
      const t = object(o.tooltip, ['enabled', 'content', 'placement', 'crosshair', 'pinnable', 'background', 'foreground']);
      for (const key of ['background', 'foreground']) checkPaint(t[key]);
      booleans(t, ['enabled', 'crosshair', 'pinnable']);
      checkLegacyChoice(t.content, ['point', 'shared'], 'INVALID_TOOLTIP_CONTENT');
      checkLegacyChoice(t.placement, ['auto', 'docked'], 'INVALID_TOOLTIP_PLACEMENT');
    }
    if (o.viewport) {
      const v = object(o.viewport, ['axes', 'value', 'controls', 'zoom', 'pan', 'pinch', 'wheel']);
      booleans(v, ['controls', 'pan', 'pinch']);
      checkOption(String(v.axes), ['x', 'y', 'xy'], 'INVALID_VIEWPORT_AXES');
      checkOption(v.wheel, [false, 'ctrl', 'always'], 'INVALID_WHEEL_MODE');
      if (o.viewport.zoom !== undefined) {
        const z = object(o.viewport.zoom, ['min', 'max', 'step', 'increment', 'label']);
        const {min = .1, max = 15, step = .1, increment} = o.viewport.zoom;
        const positive = (value: number) => Number.isFinite(value) && value > 0;
        if (![min, max, step].every(positive) || max <= min || step > max - min ||
            increment !== undefined && (!positive(increment) || increment < min || increment > max)) {
          throw Error('INVALID_ZOOM_RANGE');
        }
        checkTextLength(z.label, 128, 'INVALID_ZOOM_LABEL');
      }
    }
    if (o.animation) { const a = object(o.animation, ['enabled', 'duration', 'revision']); booleans(a, ['enabled']); checkRange(a.duration, 0, 2000); if (a.revision !== undefined && (!Number.isSafeInteger(a.revision) || Number(a.revision) < 0)) throw Error('INVALID_ANIMATION_REVISION'); }
    if (o.capacity) { const c = object(o.capacity, ['points', 'categories']); checkInteger(c.points, 1, 50000, 'INTEGER_CAPACITY_REQUIRED'); checkInteger(c.categories, 1, 10000, 'INTEGER_CAPACITY_REQUIRED'); }
    for (const key of ['risingColor', 'fallingColor'] as const) checkPaint(o.appearance?.[key]);
    checkRange(o.appearance?.labelLimit, 1, 200);
    if (o.annotations) for (const a of boundedList(o.annotations, 100, 'ANNOTATION_LIMIT')) {
      validateTextEntry(a, ['id', 'point', 'text', 'dx', 'dy']);
      if (!a.point || typeof a.point.seriesId !== 'string' || typeof a.point.pointId !== 'string') throw Error('ANNOTATION_IDENTITY_REQUIRED');
      checkRange(a.dx, -1000, 1000); checkRange(a.dy, -1000, 1000);
    }
    if (o.referenceLabels) for (const a of boundedList(o.referenceLabels, 100, 'REFERENCE_LABEL_LIMIT')) validateTextEntry(a, ['id', 'text']);
    if (r.referenceBandStyles !== undefined) {
      const styles = boundedList(o.referenceBandStyles, 100, 'REFERENCE_BAND_STYLE_LIMIT');
      const ids = new Set(Array.isArray(o.referenceBands) ? o.referenceBands.map(band => band?.id) : []);
      for (const style of styles) {
        const entry = object(style, ['id', 'label', 'color', 'opacity']);
        strings(entry, ['id', 'label', 'color']);
        if (!ids.delete(style.id)) throw Error('INVALID_REFERENCE_BAND_STYLE_ID');
        checkPaint(style.color);
        checkRange(style.opacity, 0, 1);
      }
    }
    if (r.referenceStyles !== undefined) {
      const styles = boundedList(o.referenceStyles, 100, 'REFERENCE_STYLE_LIMIT');
      const ids=new Set<string>();
      for(const style of styles){
        object(style,['id','color','dash','width']);strings(style as unknown as Record<string,unknown>,['id']);
        if(typeof style.id!=='string'||!style.id||ids.has(style.id))throw Error('REFERENCE_STYLE_ID_REQUIRED');ids.add(style.id);
        if (style.color !== undefined) validatePaint(style.color, 'HEX_REFERENCE_COLOR_REQUIRED');
        checkOption(style.dash, dashOptions, 'INVALID_REFERENCE_DASH');
        checkRange(style.width, .5, 8);
      }
    }
    if (r.hiddenSeriesIds !== undefined && (!Array.isArray(o.hiddenSeriesIds) || o.hiddenSeriesIds.some(id => typeof id !== 'string'))) throw Error('INVALID_HIDDEN_IDS');
    if (r.selectedPoints !== undefined && (!Array.isArray(o.selectedPoints) || o.selectedPoints.some(id => { const x = object(id, ['seriesId', 'pointId']); return typeof x.seriesId !== 'string' || typeof x.pointId !== 'string'; }))) throw Error('INVALID_SELECTION');
    return { status: 'ok', value: o };
  } catch (e) { return invalid(e instanceof Error ? e.message : 'INVALID_OPTIONS'); }
}
export type ChartPlanner = (data: PlanSpec, options: PlanOptions, ports?: ChartPlanningPorts) => ReturnType<typeof planChart>;
export function planWebChart(data: ChartData, options: ChartOptions, size: Readonly<{ width: number; height: number }>, hidden: readonly string[] = [], ports: ChartPlanningPorts = {}): ChartResult<PlanFrame> {
  const checked = validateOptions(options); if (checked.status === 'invalid') return checked;
  return planWith(planDefaultChart, data, resolveResponsive(checked.value, checked.value.width ?? size.width), size, hidden, ports);
}
export function planWith(planner: ChartPlanner, data: ChartData, options: ChartOptions, size: Readonly<{ width: number; height: number }>, hidden: readonly string[] = [], ports: ChartPlanningPorts = {}): ChartResult<PlanFrame> {
  try {
    const safe = snapshot(data);
    const record = object(safe);
    if (!isSupportedChartType(safe.type)) return invalid('UNSUPPORTED_CHART_TYPE', 'data.type');
    const forwardedKeys = layoutKeysFor(safe.type);
    for (const key of ['family', 'title', 'description', 'color', 'unit', 'pictorial', 'colorAxis', 'contour', 'centerName', 'centerColor', ...forwardedKeys]) if (hasOwn(record, key)) return invalid('PRESENTATION_IN_DATA', 'data.' + key);
    if (!presentationCheckedData.has(safe)) {
      const path = ['data'];
      function check(value: object): void {
        const axis = path.length === 3 && path[1] === 'axes' && !path[2]!.includes('.');
        for (const key of Object.keys(value)) {
          if (key === 'color' || key === 'datum' || key === 'markers' || key === 'dash' ||
              (key === 'grid' || key === 'labels' || key === 'title') && axis) {
            throw Error('PRESENTATION_IN_DATA:' + path.join('.') + '.' + key);
          }
          const child = (value as Record<string, unknown>)[key];
          if (child && typeof child === 'object') {
            path.push(key);
            check(child);
            path.pop();
          }
        }
      }
      check(record);
      if (detachedInputs.has(safe)) presentationCheckedData.add(safe);
    }
    const validated = validateOptions(options); if (validated.status === 'invalid') return validated;
    const o = validated.value, { type, ...definition } = safe, layout = o.layout;
    const pointError = pointStyleError(safe, o);
    if (pointError) return invalid(pointError, 'options.appearance.points');
if (layout) {
      const translated = translatedLayoutKeysFor(type);
      if (Object.keys(layout).some(key => !forwardedKeys.includes(key) && !translated.includes(key))) return invalid('LAYOUT_UNSUPPORTED_FOR_TYPE', 'options.layout');
    }
    if (o.colorAxis && !['heatmap', 'tilemap'].includes(type)) return invalid('COLOR_AXIS_UNSUPPORTED', 'options.colorAxis');
    if (o.appearance?.waterfall && type !== 'waterfall') return invalid('WATERFALL_STYLE_UNSUPPORTED', 'options.appearance.waterfall');
    const plan: Record<string, unknown> = definition;
    if (layout) for (const key of forwardedKeys) {
      if (hasOwn(layout, key)) plan[key] = (layout as Readonly<Record<string, unknown>>)[key];
    }
    plan.family = type;
    plan.title = o.title ?? 'Chart';
    if (o.description !== undefined) plan.description = o.description;
    if (type === 'gauge') {
      plan.preset = layout?.preset ?? 'arc';
      if (Array.isArray(plan.bands)) {
        const colors = o.appearance?.bandColors ?? ['#3679b5', '#8294b0', '#675b9b'];
        plan.bands = plan.bands.map((band, index) => ({
          ...band, color: colors[index % colors.length],
        }));
      }
    }
    if (o.colorAxis) plan.colorAxis = o.colorAxis;
    if (type === 'pictorial') plan.pictorial = { shape: layout?.shape ?? { type: 'preset', name: 'person' }, gap: layout?.gap ?? 8, background: layout?.background ?? true };
    if (type === 'contour') {
      const {levels = [], segmentBudget} = layout ?? {};
      plan.contour = segmentBudget === undefined ? {levels} : {levels, segmentBudget};
    }
    if (type === 'fan' && o.appearance?.centerName) plan.centerName = o.appearance.centerName;
    const calculation = { ...size, hiddenSeriesIds: hidden } as { -readonly [K in keyof PlanOptions]: PlanOptions[K] };
    if (layout?.stacking && type !== 'windrose') calculation.stacking = layout.stacking;
    if (layout?.stackGroups) calculation.stackGroups = layout.stackGroups;
    if (layout && ['pie', 'donut', 'gauge'].includes(type)) {
      const settings = {} as { -readonly [K in keyof NonNullable<PlanOptions['circular']>]: NonNullable<PlanOptions['circular']>[K] };
      for (const key of ['startAngle', 'endAngle', 'tickCount'] as const) {
        if (layout[key] !== undefined) settings[key] = layout[key];
      }
      if (layout.style !== undefined) settings.gaugeStyle = layout.style;
      calculation.circular = settings;
    }
    if (o.viewport) {
      const { axes, value } = o.viewport;
      calculation.viewport = {axes, ...(value ? {value} : {})};
    }
    for (const key of ['references', 'referenceBands', 'capacity', 'scales', 'hierarchy'] as const) {
      if (o[key]) (calculation as Record<string, unknown>)[key] = o[key];
    }
    const result = planner(plan as unknown as PlanSpec, calculation, ports);
    if (result.status === 'invalid') return result;
    let frame = result.frame;
    if (type === 'pareto' && o.locale === 'es') {
      const translate = (id: string, name: string): string =>
        id === 'values' && name === 'Values' ? 'Valores' :
        id === 'cumulative' && name === 'Cumulative' ? 'Acumulado' : name;
      const translateSeries = <T extends { readonly id: string; readonly name: string }>(item: T): T =>
        Object.freeze({ ...item, name: translate(item.id, item.name) });
      frame = Object.freeze({
        ...frame,
        legend: Object.freeze(frame.legend.map(translateSeries)),
        series: Object.freeze(frame.series.map(translateSeries)),
        observations: Object.freeze(frame.observations.map(point => Object.freeze({
          ...point, seriesName: translate(point.id.seriesId, point.seriesName),
        }))),
      });
    }
    return { status: 'ok', value: o.unit === undefined ? frame : Object.freeze({ ...frame, unit: o.unit }) };
  } catch (e) { return invalid(e instanceof Error ? e.message : 'INVALID_DATA', 'data'); }
}
