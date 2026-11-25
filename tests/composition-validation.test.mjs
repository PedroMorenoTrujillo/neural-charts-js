import assert from 'node:assert/strict';
import test from 'node:test';
import { createChartPanels, resolveChartPanels } from '../dist/panels.js';
import { createChartDrilldown, resolveChartDrilldownRoot } from '../dist/drilldown.js';

const categoryAxis = {
  type: 'category',
  values: ['north', 'south'].map(id => ({ id, label: id })),
};
const series = [{
  id: 'sales', name: 'Sales',
  data: [{ id: 'north', x: 'north', y: 0 }, { id: 'south', x: 'south', y: 10 }],
}];
const chart = { type: 'column', axes: { x: categoryAxis, y: { type: 'linear' } }, series };
const detail = { type: 'pie', data: [{ id: 'channel', label: 'Channel', value: 10 }] };
const panels = ['left', 'right'].map(id => ({ id, data: chart }));
const link = { id: 'shared', axis: 'x', panelIds: ['left', 'right'] };
const panelData = { panels, viewportLinks: [link] };
const panelOptions = { chart: { viewport: { axes: 'x' } } };
const graph = {
  rootId: 'overview',
  nodes: [{ id: 'overview', data: chart }, { id: 'detail', data: detail }],
  links: [{ fromNodeId: 'overview', datumId: { seriesId: 'sales', pointId: 'north' }, toNodeId: 'detail' }],
};

function rejects(result, reason, path) {
  assert.equal(result.status, 'invalid', JSON.stringify(result));
  if (reason) assert.equal(result.diagnostic.reason, reason);
  if (path) assert.equal(result.diagnostic.path, path);
}

test('Panel validation identifies malformed collections, records and reused link ownership', () => {
  const dataCases = [
    [null, 'INVALID_CHART_PANELS', 'data'],
    [{ panels: [] }, 'INVALID_CHART_PANELS', 'data'],
    [{ panels, viewportLinks: 'shared' }, 'INVALID_CHART_PANELS', 'data'],
    [{ panels: [null] }, 'INVALID_PANEL', 'data.panels'],
    [{ panels: [{ id: 'north west', data: chart }] }, 'INVALID_PANEL', 'data.panels'],
    [{ panels: [panels[0], panels[0]] }, 'INVALID_PANEL', 'data.panels'],
  ];
  for (const [input, reason, path] of dataCases) rejects(resolveChartPanels(input, panelOptions), reason, path);
  for (const malformed of [
    null, { ...link, axis: 'y' }, { ...link, panelIds: ['left'] },
    { ...link, panelIds: ['left', 'unknown'] }, { ...link, panelIds: ['left', 'left'] },
    { ...link, panelIds: 'left,right' }, { ...link, extra: true },
  ]) {
    rejects(resolveChartPanels({ panels, viewportLinks: [malformed] }, panelOptions),
      'INVALID_PANEL_VIEWPORT_LINK', 'data.viewportLinks');
  }
  rejects(resolveChartPanels({ panels, viewportLinks: [link, { ...link }] }, panelOptions),
    'INVALID_PANEL_VIEWPORT_LINK', 'data.viewportLinks');
  for (const options of [null, { columns: 3 }, { chart: [] }, { panels: true }, { unexpected: 1 }]) {
    rejects(resolveChartPanels(panelData, options), 'INVALID_PANEL_OPTIONS');
  }
  rejects(resolveChartPanels(panelData, { ...panelOptions, panels: { left: 'invalid' } }),
    'INVALID_PANEL_OPTIONS', 'options.panels.left');
  rejects(resolveChartPanels(panelData, { ...panelOptions, panels: { extra: {} } }),
    'UNKNOWN_PANEL', 'options.panels');
});

test('Panel viewport links reject ambiguous coordinates and keep valid child overrides', () => {
  const coordinate = (x, type = 'column') => ({ ...chart, type, axes: { ...chart.axes, x } });
  for (const input of [
    detail, { ...chart, axes: { y: chart.axes.y } }, coordinate({ type: 'log', domain: [1, 100] }),
    coordinate({ type: 'category', values: [] }),
    coordinate({ ...categoryAxis, values: [categoryAxis.values[0], categoryAxis.values[0]] }),
    coordinate({ type: 'linear' }), coordinate({ type: 'linear', domain: [10, 1] }),
    coordinate({ type: 'linear', domain: [0, 10], nice: true }),
    coordinate({ type: 'time', domain: [0, 10.5] }),
    coordinate({ ...categoryAxis, values: [...categoryAxis.values].reverse() }),
  ]) {
    const linked = { panels: [panels[0], { id: 'right', data: input }], viewportLinks: [link] };
    rejects(resolveChartPanels(linked, panelOptions), 'INCOMPATIBLE_PANEL_VIEWPORT', 'data.viewportLinks');
  }
  for (const axes of ['y', 'xy']) {
    const viewport = axes === 'y' ? { axes } : { axes, value: { x: { firstId: 'south', lastId: 'north' } } };
    rejects(resolveChartPanels(panelData, { ...panelOptions, panels: { right: { viewport } } }),
      'INCOMPATIBLE_PANEL_VIEWPORT', 'data.viewportLinks');
  }
  const reason = 'INCOMPATIBLE_PANEL_VIEWPORT';
  const numeric = coordinate({ type: 'linear', domain: [0, 10] });
  const fixed = { ...panelData, panels: ['left', 'right'].map(id => ({ id, data: numeric })) };
  for (const x of [[-1, 3], [7, 11], { firstId: 'north', lastId: 'south' }]) {
    rejects(resolveChartPanels(fixed, { chart: { viewport: { axes: 'x', value: { x } } } }), reason, 'data.viewportLinks');
  }
  const result = resolveChartPanels(panelData, { ...panelOptions, columns: 2, panels: { left: { title: 'Left' } } });
  assert.equal(result.status, 'ok');
  assert.equal(result.value.columns, 2);
  assert.deepEqual(result.value.panels.map(item => item.options.title), ['Left', undefined]);
  assert.equal(chart.series[0].data[0].y, 0);
});

test('Linked axes compare the original time domain and the initial source window before mounting', () => {
  const configuration = (leftAxis, rightAxis, viewport = { axes: 'x' }) => ({
    data: {
      panels: [leftAxis, rightAxis].map((x, index) => ({
        id: panels[index].id, data: { ...chart, axes: { ...chart.axes, x } },
      })),
      viewportLinks: [link],
    },
    options: { chart: { viewport } },
  });
  const time = { type: 'time', domain: [0, 2000] };
  const numeric = { type: 'linear', domain: [-100, 100] };
  for (const input of [
    configuration(time, time, { axes: 'x', value: { x: [0.5, 1000] } }),
    configuration(time, { ...time, domain: [0, 8.64e15 + 1] }),
    configuration(numeric, { ...numeric, includeZero: true }),
    configuration(categoryAxis, categoryAxis, { axes: 'x', value: { x: [0, 1] } }),
    configuration(categoryAxis, categoryAxis, { axes: 'x', value: { x: { firstId: 'missing', lastId: 'south' } } }),
  ]) rejects(resolveChartPanels(input.data, input.options), 'INCOMPATIBLE_PANEL_VIEWPORT', 'data.viewportLinks');

  const utc = configuration(time, time, { axes: 'x', value: { x: [100, 1200] } });
  const unequal = { ...utc.options, panels: { right: { viewport: { axes: 'x', value: { x: [200, 1200] } } } } };
  rejects(resolveChartPanels(utc.data, unequal), 'INCOMPATIBLE_PANEL_VIEWPORT', 'data.viewportLinks');
  assert.equal(resolveChartPanels(utc.data, utc.options).status, 'ok');
  const yOnly = { chart: { viewport: { axes: 'y' } } };
  rejects(resolveChartPanels(utc.data, yOnly), 'INCOMPATIBLE_PANEL_VIEWPORT', 'data.viewportLinks');
  const log = { chart: { viewport: { axes: 'x' }, scales: { x: { type: 'log' } } } };
  rejects(resolveChartPanels(utc.data, log), 'INCOMPATIBLE_PANEL_VIEWPORT', 'data.viewportLinks');

  rejects(resolveChartPanels(utc.data, { chart: { height: 10 } }), 'OPTION_OUT_OF_RANGE', 'options');
  rejects(resolveChartPanels(utc.data, { ...utc.options, panels: { right: { legend: [] } } }), 'OBJECT_REQUIRED', 'options');
  const unsafe = new Proxy(utc.data, { ownKeys() { throw new Error('Source reflection failed'); } });
  rejects(resolveChartPanels(unsafe, utc.options), 'INVALID_PANEL_CONFIG', 'data');
});

test('Drilldown validation builds a safe graph and reports the failing override path', () => {
  const circular = { ...graph };
  circular.nodes = [circular];
  rejects(resolveChartDrilldownRoot(circular), 'INVALID_DRILLDOWN_DATA', 'data');
  const recursive = {};
  recursive.chart = recursive;
  for (const options of [recursive, null, { extra: true }, { chart: [] }, { nodes: 4 }]) {
    rejects(resolveChartDrilldownRoot(graph, options), 'INVALID_DRILLDOWN_OPTIONS');
  }
  rejects(resolveChartDrilldownRoot(graph, { nodes: { nonexistent: {} } }), 'UNKNOWN_DRILLDOWN_NODE', 'options.nodes');
  rejects(resolveChartDrilldownRoot(graph, { nodes: { overview: null } }), 'INVALID_DRILLDOWN_NODE_OPTIONS', 'options.nodes.overview');
  const invalidRoot = resolveChartDrilldownRoot(graph, { chart: { height: -1 } });
  rejects(invalidRoot, undefined, 'options');
  rejects(resolveChartDrilldownRoot(graph, { nodes: { overview: { height: -1 } } }),
    invalidRoot.diagnostic.reason, 'options.nodes.overview');
  const prepared = resolveChartDrilldownRoot(graph, { chart: { title: 'Common', locale: 'es' }, nodes: { overview: { title: 'Overview' } } });
  assert.equal(prepared.status, 'ok');
  assert.equal(prepared.value.options.title, 'Overview');
  assert.equal(prepared.value.options.locale, 'es');
  assert.deepEqual(prepared.value.data, chart);
});

test('Composition controllers reject invalid mounts before reading DOM or running callbacks', () => {
  for (const [create, data, invalidMount] of [
    [createChartPanels, panelData, 'INVALID_PANEL_MOUNT'],
    [createChartDrilldown, graph, 'INVALID_DRILLDOWN_MOUNT'],
  ]) {
    const host = { get ownerDocument() { assert.fail('Host read before mount validation'); } };
    for (const mount of [
      null, { instanceId: 'safe', onDiagnostic: true }, { instanceId: 'safe', [Symbol()]: false },
      { get instanceId() { assert.fail('Accessor side effect'); } },
      new Proxy({}, { ownKeys() { throw new Error('Unavailable mount records'); } }),
    ]) rejects(create(host, data, {}, mount), invalidMount, 'mount');
    for (const instanceId of [undefined, 5, '0unsafe', 'a b']) {
      rejects(create(host, data, {}, { instanceId }), 'INVALID_INSTANCE_ID', 'mount.instanceId');
    }
    rejects(create(undefined, data, {}, { instanceId: 'safe', onDiagnostic: () => assert.fail('Unexpected callback') }),
      'INVALID_HOST', 'host');
  }
});
