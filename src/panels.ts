import type { PlanViewportValue } from '@neural-charts/core';
import { createChart } from './owner.js';
import { invalid, snapshot, validateOptions } from './planning.js';
import type { ChartController, ChartData, ChartDiagnostic, ChartOptions, ChartResult } from './types.js';

export type ChartPanelViewportValue = PlanViewportValue;
export interface ChartPanel { readonly id: string; readonly data: ChartData; }
export interface ChartPanelViewportLink { readonly id: string; readonly axis: 'x'; readonly panelIds: readonly string[]; }
export interface ChartPanelsData {
  readonly panels: readonly ChartPanel[];
  readonly viewportLinks?: readonly ChartPanelViewportLink[];
}
export interface ChartPanelsOptions {
  readonly chart?: ChartOptions;
  readonly panels?: Readonly<Record<string, ChartOptions>>;
  readonly columns?: 'auto' | 1 | 2;
}
export interface ChartPanelViewportChange {
  readonly panelId: string;
  readonly value: ChartPanelViewportValue;
  readonly linkId: string | null;
}
export interface ChartPanelVisibilityChange { readonly panelId: string; readonly hiddenSeriesIds: readonly string[]; }
export interface ChartPanelDiagnostic { readonly panelId: string | null; readonly diagnostic: ChartDiagnostic; }
export interface ChartPanelsMountOptions {
  readonly instanceId: string;
  readonly onViewportChange?: (event: ChartPanelViewportChange) => void;
  readonly onHiddenSeriesChange?: (event: ChartPanelVisibilityChange) => void;
  readonly onDiagnostic?: (event: ChartPanelDiagnostic) => void;
}
export interface ChartPanelsController {
  update(data: ChartPanelsData, options?: ChartPanelsOptions): ChartResult<true>;
  setViewport(panelId: string, value: ChartPanelViewportValue): ChartResult<ChartPanelViewportValue>;
  getViewport(panelId: string): ChartPanelViewportValue | undefined;
  getHiddenSeriesIds(panelId: string): readonly string[] | undefined;
  destroy(): void;
}
export interface ResolvedChartPanel extends ChartPanel { readonly options: ChartOptions; }
export interface ResolvedChartPanels {
  readonly panels: readonly ResolvedChartPanel[];
  readonly columns: NonNullable<ChartPanelsOptions['columns']>;
}

interface Prepared extends ResolvedChartPanels {
  readonly data: ChartPanelsData;
  readonly options: ChartPanelsOptions;
  readonly links: ReadonlyMap<string, ChartPanelViewportLink>;
}
interface MountedPanel {
  panel: ResolvedChartPanel;
  applied: ChartOptions;
  readonly surface: HTMLDivElement;
  readonly controller: ChartController;
}

const record = (value: unknown): boolean => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][\w-]{0,63}$/.test(value);
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const linkedTypes = new Set(['line', 'area', 'spline', 'column', 'mixed']);

/** Link original coordinates. Every child remains responsible for its own projection. */
function coordinateKey(panel: ResolvedChartPanel): string | undefined {
  const viewport = panel.options.viewport;
  if (!linkedTypes.has(panel.data.type) || !viewport || viewport.axes === 'y' || panel.options.scales?.x) return;
  const axes = 'axes' in panel.data && panel.data.axes;
  const axis = axes && 'x' in axes ? axes.x : undefined;
  if (!axis) return;
  const window = viewport.value?.x;
  if (axis.type === 'category') {
    const ids = axis.values.map(value => value.id);
    if (!ids.length || new Set(ids).size !== ids.length) return;
    if (window !== undefined) {
      if (!('firstId' in window)) return;
      const first = ids.indexOf(window.firstId);
      if (first < 0 || ids.indexOf(window.lastId) < first) return;
    }
    return JSON.stringify(['category', ids]);
  }
  if (axis.type !== 'linear' && axis.type !== 'time') return;
  const domain = 'domain' in axis ? axis.domain : undefined;
  if (!domain || domain.length !== 2 || !domain.every(Number.isFinite) || domain[0] >= domain[1]
    || 'nice' in axis && axis.nice === true) return;
  if (axis.type === 'time' && !domain.every(value => Number.isInteger(value) && Math.abs(value) <= 8.64e15)) return;
  if (window !== undefined && ('firstId' in window || !Array.isArray(window) || window.length !== 2
    || !window.every(Number.isFinite) || window[0] >= window[1] || window[0] < domain[0] || window[1] > domain[1]
    || axis.type === 'time' && !window.every(Number.isInteger))) return;
  return JSON.stringify([axis.type, domain, 'includeZero' in axis && axis.includeZero === true]);
}

function fixedYDomain(panel: ResolvedChartPanel): readonly number[] | undefined {
  const axes = 'axes' in panel.data && panel.data.axes;
  const axis = axes && 'y' in axes ? axes.y : undefined;
  return axis && 'domain' in axis ? axis.domain : undefined;
}

function prepare(data: ChartPanelsData, options: ChartPanelsOptions, previous?: Prepared): ChartResult<Prepared> {
  try {
    data = snapshot(data, false, previous?.data);
    options = snapshot(options, false, previous?.options);
    if (!record(data) || Object.keys(data).some(key => key !== 'panels' && key !== 'viewportLinks')
      || !Array.isArray(data.panels) || !data.panels.length || data.panels.length > 16
      || data.viewportLinks !== undefined && (!Array.isArray(data.viewportLinks) || data.viewportLinks.length > 8)) {
      return invalid('INVALID_CHART_PANELS', 'data');
    }
    if (!record(options) || Object.keys(options).some(key => !['chart', 'panels', 'columns'].includes(key))
      || options.chart !== undefined && !record(options.chart)
      || options.panels !== undefined && !record(options.panels)
      || options.columns !== undefined && !['auto', 1, 2].includes(options.columns)) return invalid('INVALID_PANEL_OPTIONS');
    const common = validateOptions(options.chart ?? {});
    if (common.status === 'invalid') return common;
    const byId = new Map<string, ResolvedChartPanel>();
    for (const panel of data.panels as readonly ChartPanel[]) {
      if (!record(panel) || Object.keys(panel).some(key => key !== 'id' && key !== 'data')
        || !validId(panel.id) || byId.has(panel.id) || !record(panel.data)) return invalid('INVALID_PANEL', 'data.panels');
      const local = options.panels && Object.hasOwn(options.panels, panel.id) ? options.panels[panel.id] : {};
      if (!record(local)) return invalid('INVALID_PANEL_OPTIONS', 'options.panels.' + panel.id);
      const settings = validateOptions({ ...common.value, ...local });
      if (settings.status === 'invalid') return settings;
      byId.set(panel.id, { id: panel.id, data: panel.data, options: settings.value });
    }
    if (Object.keys(options.panels ?? {}).some(id => !byId.has(id))) return invalid('UNKNOWN_PANEL', 'options.panels');
    const links = new Map<string, ChartPanelViewportLink>(), linkIds = new Set<string>();
    for (const link of data.viewportLinks ?? []) {
      if (!record(link) || Object.keys(link).some(key => key !== 'id' && key !== 'axis' && key !== 'panelIds')
        || !validId(link.id) || linkIds.has(link.id) || link.axis !== 'x' || !Array.isArray(link.panelIds)
        || link.panelIds.length < 2 || link.panelIds.length > 16) return invalid('INVALID_PANEL_VIEWPORT_LINK', 'data.viewportLinks');
      linkIds.add(link.id);
      let key: string | undefined, initial: PlanViewportValue['x'];
      for (const id of link.panelIds) {
        const panel = byId.get(id);
        if (!panel || links.has(id)) return invalid('INVALID_PANEL_VIEWPORT_LINK', 'data.viewportLinks');
        const coordinate = coordinateKey(panel), x = panel.options.viewport?.value?.x;
        if (!coordinate || key !== undefined && (coordinate !== key || !same(x, initial))) {
          return invalid('INCOMPATIBLE_PANEL_VIEWPORT', 'data.viewportLinks', 'Linked panels need the same X coordinates and initial X window.');
        }
        key = coordinate;
        initial = x;
        links.set(id, link);
      }
    }
    return { status: 'ok', value: { data, options, panels: [...byId.values()], columns: options.columns ?? 'auto', links } };
  } catch { return invalid('INVALID_PANEL_CONFIG', 'data'); }
}

/** Resolve the initial panel composition without acquiring browser resources. */
export function resolveChartPanels(data: ChartPanelsData, options: ChartPanelsOptions = {}): ChartResult<ResolvedChartPanels> {
  const prepared = prepare(data, options);
  return prepared.status === 'invalid' ? prepared : { status: 'ok', value: { panels: prepared.value.panels, columns: prepared.value.columns } };
}

export function chartPanelColumns(columns: ResolvedChartPanels['columns']): string {
  return columns === 'auto'
    ? 'repeat(auto-fit,minmax(min(100%,max(340px,calc(50% - 8px))),1fr))'
    : 'repeat(' + columns + ',minmax(0,1fr))';
}

function ownMount(mount: ChartPanelsMountOptions): ChartResult<ChartPanelsMountOptions> {
  try {
    if (!record(mount)) return invalid('INVALID_PANEL_MOUNT', 'mount');
    const descriptors = Object.getOwnPropertyDescriptors(mount);
    if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string'
      || !['instanceId', 'onViewportChange', 'onHiddenSeriesChange', 'onDiagnostic'].includes(key)
      || !Object.hasOwn(descriptors[key]!, 'value')
      || key !== 'instanceId' && typeof descriptors[key]!.value !== 'function')) return invalid('INVALID_PANEL_MOUNT', 'mount');
    const id: unknown = descriptors.instanceId?.value;
    if (typeof id !== 'string' || !/^[A-Za-z][\w-]{0,99}$/.test(id)) return invalid('INVALID_INSTANCE_ID', 'mount.instanceId');
    return { status: 'ok', value: Object.freeze(Object.fromEntries(Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value]))) as unknown as ChartPanelsMountOptions };
  } catch { return invalid('INVALID_PANEL_MOUNT', 'mount'); }
}

const viewportValue = (panel: MountedPanel): PlanViewportValue | undefined => panel.controller.getFrame().viewport?.value;
const viewportWithX = (value: PlanViewportValue, x: PlanViewportValue['x']): PlanViewportValue =>
  ({ ...(x !== undefined ? { x } : {}), ...(value.y !== undefined ? { y: value.y } : {}) });
const viewKey = (options: ChartOptions): unknown =>
  [options.viewport, options.layout, options.scales, options.hierarchy, options.hiddenSeriesIds];

/** Own a bounded collection of chart controllers and synchronize explicitly linked X windows. */
export function createChartPanels(
  host: HTMLElement, data: ChartPanelsData, options: ChartPanelsOptions, mount: ChartPanelsMountOptions,
): ChartResult<ChartPanelsController> {
  const owner = ownMount(mount);
  if (owner.status === 'invalid') return owner;
  const doc = host?.ownerDocument, win = doc?.defaultView;
  if (!doc || !win || !(host instanceof win.HTMLElement)) return invalid('INVALID_HOST', 'host');
  const first = prepare(data, options);
  if (first.status === 'invalid') return first;
  const config = owner.value, document = doc;
  const root = doc.createElement('div');
  root.dataset.ncPanels = '';
  root.style.cssText = 'display:grid;align-items:start;gap:16px;position:relative';
  let prepared = first.value, mounted = new Map<string, MountedPanel>(), serial = 0, destroyed = false;
  const alive = (panel: MountedPanel): boolean => !destroyed && mounted.get(panel.panel.id) === panel;
  const report = (panelId: string, diagnostic: ChartDiagnostic): void => {
    if (!destroyed) config.onDiagnostic?.({ panelId, diagnostic });
  };

  function applyWindow(source: MountedPanel, value: PlanViewportValue): ChartResult<PlanViewportValue> {
    if (!alive(source)) return invalid('DESTROYED');
    const previous = viewportValue(source);
    const viewport = source.applied.viewport;
    if (!viewport || !previous) return invalid('VIEWPORT_UNAVAILABLE');
    const changed = new Map<MountedPanel, ChartOptions>();
    const set = (panel: MountedPanel, next: PlanViewportValue): ChartResult<number> => {
      const saved = panel.applied;
      const result = panel.controller.updateOptions({ ...saved, viewport: { ...saved.viewport!, value: next } });
      if (result.status === 'ok') {
        changed.set(panel, saved);
        panel.applied = { ...saved, viewport: { ...saved.viewport!, value: viewportValue(panel) ?? next } };
      }
      return result;
    };
    const own = set(source, value);
    if (own.status === 'invalid') return own;
    const applied = viewportValue(source) ?? value, link = prepared.links.get(source.panel.id);
    if (link && !same(previous.x, applied.x)) for (const id of link.panelIds) {
      if (id === source.panel.id) continue;
      const peer = mounted.get(id)!;
      const before = viewportValue(peer) ?? {};
      if (same(before.x, applied.x)) continue;
      const result = set(peer, viewportWithX(before, applied.x));
      if (result.status === 'invalid') {
        for (const [panel, saved] of changed) { panel.controller.updateOptions(saved); panel.applied = saved; }
        return result;
      }
    }
    config.onViewportChange?.({ panelId: source.panel.id, value: applied, linkId: link?.id ?? null });
    return { status: 'ok', value: applied };
  }

  function render(next: Prepared): ChartResult<true> {
    const keepView = new Map(next.panels.map(panel => {
      const prior = mounted.get(panel.id);
      const compatible = prior && (prior.panel.data === panel.data ||
        (next.links.has(panel.id) && coordinateKey(prior.panel) === coordinateKey(panel)));
      return [panel.id, !!compatible && same(viewKey(prior.panel.options), viewKey(panel.options))] as const;
    }));
    const staging = document.createElement('div');
    staging.style.cssText = 'display:grid;grid-template-columns:' + chartPanelColumns(next.columns) + ';gap:16px;position:absolute;inset:0;visibility:hidden';
    root.append(staging);
    const fresh: MountedPanel[] = [];
    const assembled = new Map<string, MountedPanel>();
    for (const panel of next.panels) {
      const prior = mounted.get(panel.id), base = panel.options, link = next.links.get(panel.id);
      const preserve = keepView.get(panel.id);
      let value = preserve && prior ? viewportValue(prior) : base.viewport?.value;
      if (preserve && prior && prior.panel.data !== panel.data) {
        const domain = fixedYDomain(panel);
        if (!domain || !same(domain, fixedYDomain(prior.panel))) {
          const y = base.viewport?.value?.y;
          value = viewportWithX(y === undefined ? {} : { y }, value?.x);
        }
      }
      if (link && (!same(link, prepared.links.get(panel.id)) || link.panelIds.some(id => !keepView.get(id)))) {
        value = viewportWithX(value ?? {}, base.viewport?.value?.x);
      }
      const seriesIds = preserve && prior?.panel.data !== panel.data && 'series' in panel.data
        ? new Set(panel.data.series.map(series => series.id)) : undefined;
      const hiddenSeriesIds = preserve && prior
        ? prior.controller.getHiddenSeriesIds().filter(id => !seriesIds || seriesIds.has(id))
        : base.hiddenSeriesIds ?? [];
      const applied: ChartOptions = {
        ...base, hiddenSeriesIds,
        ...(base.viewport ? { viewport: { ...base.viewport, value: value ?? {} } } : {}),
      };
      if (prior && prior.panel.data === panel.data && same(prior.applied, applied)) { assembled.set(panel.id, prior); continue; }
      const surface = document.createElement('div');
      surface.style.minWidth = '0';
      surface.dataset.ncPanel = panel.id;
      staging.append(surface);
      let entry: MountedPanel | undefined;
      const result = createChart(surface, panel.data, applied, {
        instanceId: config.instanceId + '-panel-' + ++serial,
        onViewportChange: proposal => {
          if (!entry || !alive(entry)) return;
          const result = applyWindow(entry, proposal);
          if (result.status === 'invalid') report(panel.id, result.diagnostic);
        },
        onHiddenSeriesChange: ids => {
          if (!entry || !alive(entry)) return;
          const settings = { ...entry.applied, hiddenSeriesIds: ids };
          const result = entry.controller.updateOptions(settings);
          if (result.status === 'invalid') { report(panel.id, result.diagnostic); return; }
          entry.applied = settings;
          config.onHiddenSeriesChange?.({ panelId: panel.id, hiddenSeriesIds: ids });
        },
        onDiagnostic: diagnostic => { if (entry && alive(entry)) report(panel.id, diagnostic); },
      });
      if (result.status === 'invalid') {
        fresh.forEach(item => item.controller.destroy());
        staging.remove();
        return result;
      }
      entry = { panel, applied, surface, controller: result.value };
      fresh.push(entry);
      assembled.set(panel.id, entry);
    }
    for (const [id, prior] of mounted) if (assembled.get(id) !== prior) prior.controller.destroy();
    mounted = assembled;
    prepared = next;
    root.style.gridTemplateColumns = chartPanelColumns(next.columns);
    for (const panel of next.panels) mounted.get(panel.id)!.panel = panel;
    root.replaceChildren(...[...mounted.values()].map(item => item.surface));
    return { status: 'ok', value: true };
  }

  host.append(root);
  const initial = render(prepared);
  if (initial.status === 'invalid') { root.remove(); return initial; }
  return { status: 'ok', value: {
    update(nextData, nextOptions = prepared.options) {
      if (destroyed) return invalid('DESTROYED');
      const next = prepare(nextData, nextOptions, prepared);
      return next.status === 'invalid' ? next : render(next.value);
    },
    setViewport(panelId, value) {
      if (destroyed) return invalid('DESTROYED');
      const panel = mounted.get(panelId);
      return panel ? applyWindow(panel, value) : invalid('UNKNOWN_PANEL', 'panelId');
    },
    getViewport: panelId => { const panel = mounted.get(panelId); return panel && viewportValue(panel); },
    getHiddenSeriesIds: panelId => mounted.get(panelId)?.controller.getHiddenSeriesIds(),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      mounted.forEach(item => item.controller.destroy());
      mounted.clear();
      root.remove();
    },
  } };
}
