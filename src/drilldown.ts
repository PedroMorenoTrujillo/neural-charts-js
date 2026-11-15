import {
  backDrilldown, createDrilldownState, currentDrilldownNode, drilldownDestination,
  drilldownGeneration, enterDrilldown, ownDrilldownGraph, reconcileDrilldown,
  rememberDrilldownView, restoredDrilldownView, type DrilldownData, type DrilldownState,
  type DrilldownViewportValue, type OwnedDrilldownGraph,
} from '@neural-charts/core/drilldown';
import { createChart } from './owner.js';
import { invalid, snapshot, validateOptions } from './planning.js';
import type {
  ChartController, ChartData, ChartDiagnostic, ChartOptions, ChartPointId, ChartResult,
} from './types.js';

type DrilldownType = 'column' | 'pie' | 'donut' | 'treemap' | 'sunburst' | 'treegraph' | 'organization';
export type ChartDrilldownNodeData = Extract<ChartData, { readonly type: DrilldownType }>;
export type ChartDrilldownData = DrilldownData<ChartDrilldownNodeData>;

export interface ChartDrilldownOptions {
  /** Common defaults. A node may replace any top-level option. */
  readonly chart?: ChartOptions;
  readonly nodes?: Readonly<Record<string, ChartOptions>>;
}

export interface ChartDrilldownNavigation {
  readonly nodeId: string;
  readonly trail: readonly string[];
}

export interface ChartDrilldownMountOptions {
  readonly instanceId: string;
  readonly onNavigationChange?: (value: ChartDrilldownNavigation) => void;
  readonly onDiagnostic?: (diagnostic: ChartDiagnostic) => void;
}

export interface ChartDrilldownController extends Pick<ChartController, 'exportSvg' | 'exportCsv' | 'exportPng' | 'destroy'> {
  update(data: ChartDrilldownData, options?: ChartDrilldownOptions): ChartResult<ChartDrilldownNavigation>;
  enter(): boolean;
  back(): boolean;
  getTrail(): readonly string[];
}

export interface ChartDrilldownRoot {
  readonly data: ChartDrilldownNodeData;
  readonly options: ChartOptions;
}

interface PreparedGraph {
  readonly data: ChartDrilldownData;
  readonly options: ChartDrilldownOptions;
  readonly graph: OwnedDrilldownGraph<ChartDrilldownNodeData>;
  readonly byNode: ReadonlyMap<string, ChartOptions>;
}

type State = DrilldownState<PreparedGraph['graph']>;

function plainOptions(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function prepare(
  data: ChartDrilldownData, options: ChartDrilldownOptions, previous?: PreparedGraph,
): ChartResult<PreparedGraph> {
  try { data = snapshot(data, false, previous?.data); }
  catch { return invalid('INVALID_DRILLDOWN_DATA', 'data'); }
  try { options = snapshot(options, false, previous?.options); }
  catch { return invalid('INVALID_DRILLDOWN_OPTIONS'); }

  if (!plainOptions(options) || Object.keys(options).some(key => key !== 'chart' && key !== 'nodes')
    || options.chart !== undefined && !plainOptions(options.chart)
    || options.nodes !== undefined && !plainOptions(options.nodes)) return invalid('INVALID_DRILLDOWN_OPTIONS');
  const common = validateOptions(options.chart ?? {});
  if (common.status === 'invalid') return common;

  const source = ownDrilldownGraph(data);
  if (source.status === 'invalid') return { status: 'invalid', diagnostic: source.error.diagnostic };
  if (Object.keys(options.nodes ?? {}).some(id => !source.value.nodes.has(id))) return invalid('UNKNOWN_DRILLDOWN_NODE', 'options.nodes');

  const byNode = new Map<string, ChartOptions>();
  const semantics = Object.create(null) as Record<string, string>;
  for (const id of source.value.nodes.keys()) {
    const override = options.nodes && Object.hasOwn(options.nodes, id) ? options.nodes[id] : {};
    if (!plainOptions(override)) return invalid('INVALID_DRILLDOWN_NODE_OPTIONS', 'options.nodes.' + id);
    const result = validateOptions({ ...common.value, ...override });
    if (result.status === 'invalid') {
      const diagnostic = result.diagnostic;
      return { status: 'invalid', diagnostic: { ...diagnostic, path: 'options.nodes.' + id + diagnostic.path.slice('options'.length) } };
    }
    const { viewport, layout, scales, hierarchy, unit, hiddenSeriesIds } = result.value;
    // These change the meaning of a saved viewport. A title, theme or palette does not.
    semantics[id] = JSON.stringify({
      viewport: viewport && { axes: viewport.axes, value: viewport.value },
      orientation: layout?.orientation, stacking: layout?.stacking, stackGroups: layout?.stackGroups,
      scales, hierarchy, unit, hiddenSeriesIds,
    });
    byNode.set(id, result.value);
  }
  const graph = ownDrilldownGraph(data, { semantics });
  return graph.status === 'invalid'
    ? { status: 'invalid', diagnostic: graph.error.diagnostic }
    : { status: 'ok', value: { data, options, graph: graph.value, byNode } };
}

/** Resolve the first node without acquiring DOM or starting browser resources. */
export function resolveChartDrilldownRoot(
  data: ChartDrilldownData, options: ChartDrilldownOptions = {},
): ChartResult<ChartDrilldownRoot> {
  const result = prepare(data, options);
  if (result.status === 'invalid') return result;
  const { graph, byNode } = result.value;
  return { status: 'ok', value: { data: graph.nodes.get(graph.rootId)!.data, options: byNode.get(graph.rootId)! } };
}

function ownMount(mount: ChartDrilldownMountOptions): ChartResult<ChartDrilldownMountOptions> {
  try {
    if (!plainOptions(mount)) return invalid('INVALID_DRILLDOWN_MOUNT', 'mount');
    const descriptors = Object.getOwnPropertyDescriptors(mount);
    if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string'
      || !['instanceId', 'onNavigationChange', 'onDiagnostic'].includes(key)
      || !Object.hasOwn(descriptors[key]!, 'value')
      || key !== 'instanceId' && typeof descriptors[key]!.value !== 'function')) {
      return invalid('INVALID_DRILLDOWN_MOUNT', 'mount');
    }
    const id: unknown = descriptors.instanceId?.value;
    if (typeof id !== 'string' || !/^[A-Za-z][\w-]{0,99}$/.test(id)) return invalid('INVALID_INSTANCE_ID', 'mount.instanceId');
    return { status: 'ok', value: Object.freeze(Object.fromEntries(Object.entries(descriptors).map(([key, value]) => [key, value.value]))) as unknown as ChartDrilldownMountOptions };
  } catch { return invalid('INVALID_DRILLDOWN_MOUNT', 'mount'); }
}

/** Browser owner. The Core graph selects a node and one chart renders its source data. */
export function createChartDrilldown(
  host: HTMLElement, data: ChartDrilldownData, options: ChartDrilldownOptions, mount: ChartDrilldownMountOptions,
): ChartResult<ChartDrilldownController> {
  const checkedMount = ownMount(mount);
  if (checkedMount.status === 'invalid') return checkedMount;
  const doc = host?.ownerDocument, win = doc?.defaultView;
  if (!doc || !win || !(host instanceof win.HTMLElement)) return invalid('INVALID_HOST', 'host');
  const settings = checkedMount.value;
  const prepared = prepare(data, options);
  if (prepared.status === 'invalid') return prepared;

  let graph = prepared.value, state = createDrilldownState(graph.graph), applied: ChartOptions = {};
  let controller: ChartController | undefined, surface: HTMLDivElement | undefined;
  let destroyed = false, serial = 0;
  const root = doc.createElement('section');
  root.dataset.ncDrilldown = '';
  const navigation = doc.createElement('div'), trail = doc.createElement('p');
  navigation.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-block-end:12px';
  trail.setAttribute('role', 'status');
  trail.style.margin = '0';
  const backButton = doc.createElement('button'), enterButton = doc.createElement('button');
  backButton.type = enterButton.type = 'button';
  backButton.dataset.drilldownBack = '';
  enterButton.dataset.drilldownEnter = '';
  navigation.append(trail, backButton, enterButton);
  const area = doc.createElement('div');
  area.style.position = 'relative';
  root.append(navigation, area);

  const current = (): ChartDrilldownNavigation => Object.freeze({ nodeId: currentDrilldownNode(state), trail: state.trail });
  const report = (diagnostic: ChartDiagnostic): void => { if (!destroyed) settings.onDiagnostic?.(diagnostic); };
  const isSelected = (id: ChartPointId): boolean => controller?.getFrame().observations.some(point =>
    point.id.seriesId === id.seriesId && point.id.pointId === id.pointId) ?? false;
  const selection = () => {
    const id = controller?.getSelection()[0];
    return id && isSelected(id) ? { ...drilldownGeneration(state), datumId: id } : undefined;
  };
  function updateNavigation(): void {
    const spanish = applied.locale === 'es';
    root.lang = spanish ? 'es' : 'en';
    root.dir = applied.direction ?? 'ltr';
    const path = state.trail.map(id => graph.byNode.get(id)?.title ?? id).join(' / ');
    if (trail.textContent !== path) trail.textContent = path;
    backButton.textContent = spanish ? 'Volver' : 'Back';
    enterButton.textContent = spanish ? 'Ver detalle' : 'View detail';
    backButton.disabled = state.trail.length <= 1;
    const picked = selection();
    enterButton.disabled = !picked || drilldownDestination(state, picked) === undefined;
  }
  function appliedOptions(next: State, prepared: PreparedGraph): ChartOptions {
    const options = prepared.byNode.get(currentDrilldownNode(next))!;
    const restored = restoredDrilldownView(next);
    return {
      ...options,
      hiddenSeriesIds: restored?.hiddenSeriesIds ?? options.hiddenSeriesIds ?? [],
      ...(options.viewport ? { viewport: { ...options.viewport, value: restored?.viewport ?? options.viewport.value ?? {} } } : {}),
    };
  }
  function saveView(viewport?: DrilldownViewportValue): void {
    if (!controller) return;
    const value = viewport ?? controller.getFrame().viewport?.value;
    state = rememberDrilldownView(state, drilldownGeneration(state), {
      hiddenSeriesIds: controller.getHiddenSeriesIds(), ...(value ? { viewport: value } : {}),
    });
  }
  function applyInteraction(next: ChartOptions): boolean {
    if (!controller || destroyed) return false;
    const result = controller.updateOptions(next);
    if (result.status === 'invalid') { report(result.diagnostic); return false; }
    applied = next;
    return true;
  }
  function show(next: State, prepared: PreparedGraph): ChartResult<ChartDrilldownNavigation> {
    const token = drilldownGeneration(next);
    const node = next.graph.nodes.get(token.nodeId)!;
    const nextOptions = appliedOptions(next, prepared);
    if (controller && next.generation === state.generation) {
      const result = controller.update(node.data, nextOptions);
      if (result.status === 'invalid') return result;
    } else {
      const staging = doc!.createElement('div');
      // Keep the old view until the new chart accepts its data and options.
      staging.style.cssText = 'position:absolute;inset:0;visibility:hidden';
      area.append(staging);
      const accept = () => !destroyed && state.generation === token.generation && surface === staging;
      const result = createChart(staging, node.data, nextOptions, {
        instanceId: settings.instanceId + '-node-' + ++serial,
        onSelectionChange: ids => {
          if (!accept()) return;
          if (applied.selectedPoints !== undefined) applyInteraction({ ...applied, selectedPoints: ids });
          updateNavigation();
        },
        onHiddenSeriesChange: ids => {
          if (!accept() || !applyInteraction({ ...applied, hiddenSeriesIds: ids })) return;
          saveView();
          updateNavigation();
        },
        onViewportChange: value => {
          if (!accept() || !applied.viewport || !applyInteraction({ ...applied, viewport: { ...applied.viewport, value } })) return;
          saveView(value);
          updateNavigation();
        },
        onDiagnostic: diagnostic => { if (accept()) report(diagnostic); },
      });
      if (result.status === 'invalid') { staging.remove(); return result; }
      controller?.destroy();
      surface?.remove();
      surface = staging;
      staging.removeAttribute('style');
      controller = result.value;
    }
    state = next;
    graph = prepared;
    applied = nextOptions;
    updateNavigation();
    return { status: 'ok', value: current() };
  }
  function navigate(next: State): boolean {
    if (destroyed || next === state) return false;
    const result = show(next, graph);
    if (result.status === 'invalid') { report(result.diagnostic); return false; }
    // Focus remains in the chart experience even when a navigation button becomes disabled.
    surface?.querySelector<HTMLElement>('[data-nc-web]')?.focus({ preventScroll: true });
    settings.onNavigationChange?.(result.value);
    return true;
  }
  function enter(): boolean {
    if (destroyed) return false;
    const picked = selection();
    if (!picked || !drilldownDestination(state, picked)) return false;
    saveView();
    return navigate(enterDrilldown(state, picked));
  }
  function back(): boolean {
    if (destroyed || state.trail.length <= 1) return false;
    saveView();
    return navigate(backDrilldown(state));
  }

  host.append(root);
  const initial = show(state, graph);
  if (initial.status === 'invalid') { root.remove(); return initial; }
  backButton.addEventListener('click', back);
  enterButton.addEventListener('click', enter);
  return { status: 'ok', value: {
    update(nextData, nextOptions = graph.options) {
      if (destroyed) return invalid('DESTROYED');
      const next = prepare(nextData, nextOptions, graph);
      if (next.status === 'invalid') return next;
      const previous = current();
      const nextState = reconcileDrilldown(state, next.value.graph);
      const result = show(nextState, next.value);
      if (result.status === 'ok' && previous.trail.join('\u0000') !== result.value.trail.join('\u0000')) settings.onNavigationChange?.(result.value);
      return result;
    },
    enter, back, getTrail: () => state.trail,
    exportSvg: settings => { if (!controller) throw Error('DESTROYED'); return controller.exportSvg(settings); },
    exportCsv: settings => controller ? controller.exportCsv(settings) : invalid('DESTROYED'),
    exportPng: settings => controller ? controller.exportPng(settings) : Promise.reject(new Error('DESTROYED')),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      backButton.removeEventListener('click', back);
      enterButton.removeEventListener('click', enter);
      controller?.destroy();
      controller = undefined;
      surface = undefined;
      root.remove();
    },
  } };
}
