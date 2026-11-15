import type { ChartData, ChartResult } from './types.js';
import { snapshot, invalid } from './planning.js';
import { messages } from './locale.js';
export interface ChartDataTable { readonly columns: readonly string[]; readonly rows: readonly (readonly string[])[]; readonly totalRows?: number; }
export interface ChartTablePage { readonly offset?: number; readonly limit: number; }
type SourceRow = {series: string; value: Record<string, unknown>; visible: boolean};
type SourceModel = {rows: SourceRow[]; keys: string[]};
const sourceModels = new WeakMap<object, Map<string, SourceModel>>();
/** Original source values, including nulls and hidden series. No projected geometry. */
export function describeChartData(data: ChartData, hidden: readonly string[] = [], locale: 'en' | 'es' = 'en', page?: ChartTablePage): ChartResult<ChartDataTable> {
  try {
    const requested = page === undefined ? undefined : snapshot(page), offset = requested?.offset ?? 0;
    if (page !== undefined && (!requested || typeof requested !== 'object' || Array.isArray(requested))) return invalid('INVALID_TABLE_PAGE', 'page');
    if (requested && (Object.keys(requested).some(k => k !== 'offset' && k !== 'limit') || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(requested.limit) || requested.limit < 1 || requested.limit > 1000)) return invalid('INVALID_TABLE_PAGE', 'page');
    const source = snapshot(data) as unknown as Record<string, unknown>, ids = snapshot(hidden);
    if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) return invalid('INVALID_HIDDEN_IDS');
    const hiddenKey = JSON.stringify(ids), models = sourceModels.get(source) ?? new Map<string, SourceModel>();
    let model = models.get(hiddenKey);
    if (!model) {
    const rows: SourceRow[] = [], hiddenIds = new Set(ids);
    if (Array.isArray(source.series)) for (const series of source.series as Record<string, unknown>[]) {
      if (!Array.isArray(series.data) || !series.data.length) continue;
      const name = String(series.name ?? series.id), visible = !hiddenIds.has(String(series.id));
      for (const value of series.data) rows.push({ series: name, value, visible });
    }
    if (Array.isArray(source.data)) for (const p of source.data as Record<string, unknown>[]) rows.push({ series: '', value: p, visible: !hiddenIds.has(String(p.id)) });
    for (const key of ['samples', 'words', 'nodes', 'links', 'sets', 'groups']) if (Array.isArray(source[key])) {
      const add = (values: readonly unknown[], group: string): void => values.forEach((value, i) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const record = value as Record<string, unknown>, nested = record.samples ?? record.data;
          if (Array.isArray(nested)) add(nested, String(record.name ?? record.label ?? record.id ?? group));
          else rows.push({ series: group, value: record, visible: !hiddenIds.has(String(record.group ?? record.id)) });
        } else rows.push({ series: group, value: { index: i, value }, visible: true });
      });
      add(source[key] as readonly unknown[], key);
    }
    if (source.grid && typeof source.grid === 'object') {
      const grid = source.grid as Record<string, unknown>, x = grid.x, y = grid.y, values = grid.values, sampleIds = grid.ids;
      if (!Array.isArray(x) || !x.length || !Array.isArray(y) || !y.length || !Array.isArray(values) || !Array.isArray(sampleIds) || x.length * y.length !== values.length || values.length !== sampleIds.length) return invalid('INVALID_GRID', 'data.grid');
      values.forEach((value, i) => rows.push({series: String(grid.id), value: {id: sampleIds[i], x: x[i % x.length], y: y[Math.floor(i / x.length)], value, ...(grid.unit === undefined ? {} : {unit: grid.unit})}, visible: true}));
    }
    if (source.root && typeof source.root === 'object') {
      const visit = (node: Record<string, unknown>) => { const { children, ...own } = node; rows.push({ series: '', value: own, visible: true }); if (Array.isArray(children)) children.forEach(n => visit(n)); };
      visit(source.root as Record<string, unknown>);
    }
    if (!rows.length && Object.hasOwn(source, 'value')) rows.push({ series: '', value: { value: source.value }, visible: true });
    const names = new Set<string>(); for (const row of rows) for (const key of Object.keys(row.value)) names.add(key);
    model = {rows, keys: [...names]}; if (models.size >= 2) models.delete(models.keys().next().value!); models.set(hiddenKey, model); sourceModels.set(source, models);
    }
    const {rows, keys} = model;
    const labels = messages(locale), text = (v: unknown) => v === null || v === undefined ? labels.missing : typeof v === 'object' ? JSON.stringify(v) : String(v);
    const sourceAxes = source.axes as Readonly<Record<string, unknown>> | undefined;
    const axisLabels: { name: string; value: (row: Record<string, unknown>) => string }[] = [];
    for (const key of ['x', 'y']) {
      const axis = sourceAxes?.[key] as Readonly<Record<string, unknown>> | undefined;
      if (axis?.type === 'category' && Array.isArray(axis.values)) {
        const names = new Map(axis.values.map((value: unknown) => { const item = typeof value === 'object' && value !== null ? value as Record<string, unknown> : { id: value, label: value }; return [String(item.id), String(item.label ?? item.id)] as const; }));
        axisLabels.push({ name: labels.category + key.toUpperCase(), value: row => names.get(String(row[key])) ?? labels.missing });
      } else if (axis?.type === 'time') axisLabels.push({ name: labels.date + key.toUpperCase() + ' (UTC)', value: row => { const value = row[key]; return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 8.64e15 ? new Date(value).toISOString() : labels.missing; } });
    }
    const displayed = requested ? rows.slice(offset, offset + requested.limit) : rows;
    return { status: 'ok', value: Object.freeze({ columns: Object.freeze([labels.series, ...axisLabels.map(axis => axis.name), ...keys, labels.visible]), rows: Object.freeze(displayed.map(r => Object.freeze([r.series, ...axisLabels.map(axis => axis.value(r.value)), ...keys.map(k => text(r.value[k])), r.visible ? labels.yes : labels.no]))), ...(requested ? {totalRows: rows.length} : {}) }) };
  } catch { return invalid('INVALID_DATA', 'data'); }
}
