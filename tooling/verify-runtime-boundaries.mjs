import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { openInstrumentedPage } from './browser-modules.mjs';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1050, height: 820 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const writeCoverage = await openInstrumentedPage(page,
    '<main style="width:900px"><div id="host"></div><div id="second"></div></main>', 'en');
  await page.evaluate(async () => {
    window.web = await import('/web/index.js');
    const groups = 12;
    const samples = 18;
    window.data = {
      type: 'line',
      axes: { x: { type: 'linear' }, y: { type: 'linear' } },
      series: Array.from({ length: groups }, (_, series) => ({
        id: 's' + series, name: 'Measurement ' + series,
        data: Array.from({ length: samples }, (_, point) => ({ id: 'p' + point, x: point, y: series * 100 + point })),
      })),
    };
    window.options = {
      title: 'Measurements', height: 280, locale: 'en',
      legend: { position: 'left' },
      appearance: {
        markers: true,
        series: [
          { id: 's0', marker: 'square', color: '#224488', pattern: 'dots' },
          { id: 's1', marker: 'triangle', color: '#663322', pattern: 'crosshatch' },
          { id: 's2', marker: 'diamond', color: '#226644', pattern: 'diagonal' },
          { id: 's3', dash: 'dotted' },
          { id: 's4', dash: 'dashed' },
        ],
      },
    };
    const mounted = web.createChart(document.querySelector('#host'), data, options, { instanceId: 'boundaries' });
    if (mounted.status !== 'ok') throw Error(JSON.stringify(mounted.diagnostic));
    window.chart = mounted.value;
  });
  const root = page.locator('#host [data-nc-web]');
  const firstSeries = root.locator('[data-series="s0"][data-action="legend"]');
  const firstLegend = await firstSeries.evaluate(button => ({
    layout: button.parentElement.parentElement.style.gridTemplateColumns,
    capped: button.parentElement.style.maxBlockSize,
    scroll: button.parentElement.style.overflowY,
    marker: button.firstElementChild.style.backgroundImage,
  }));
  assert.equal(firstLegend.layout, '150px minmax(0px, 1fr)');
  assert.equal(firstLegend.capped, '12rem');
  assert.equal(firstLegend.scroll, 'auto');
  assert.match(firstLegend.marker, /radial-gradient/);
  const marks = await root.locator('[data-action="legend"] > span[aria-hidden="true"]').evaluateAll(items => ({
    triangle: items[1].style.backgroundImage,
    diagonal: items[2].style.backgroundImage,
    dotted: items[3].textContent.trim(),
    dashed: items[4].textContent.trim(),
  }));
  assert.match(marks.triangle, /repeating-linear-gradient/);
  assert.match(marks.diagonal, /repeating-linear-gradient/);
  assert.deepEqual([marks.dotted, marks.dashed], ['┈', '┄']);

  const table = root.locator('details');
  await table.locator('summary').click();
  const rows = table.locator('tbody tr');
  const next = table.locator('[data-action="table-next"]');
  const previous = table.locator('[data-action="table-previous"]');
  await rows.first().waitFor();
  assert.equal(await rows.count(), 100);
  assert.match(await rows.first().innerText(), /Measurement 0/);
  assert.equal(await previous.isDisabled(), true);
  await next.click();
  assert.equal(await rows.count(), 100);
  assert.match(await rows.first().innerText(), /Measurement 5/);
  await next.click();
  assert.equal(await rows.count(), 16);
  assert.match(await rows.last().innerText(), /1117/);
  assert.equal(await next.isDisabled(), true);
  assert.equal(await previous.evaluate(node => node === document.activeElement), true);
  await previous.press('Enter');
  await previous.press('Enter');
  assert.equal(await previous.isDisabled(), true);
  assert.equal(await next.evaluate(node => node === document.activeElement), true);

  const passing = await page.evaluate(() =>
    chart.updateOptions({ ...options, title: 'Original values', legend: { position: 'right', maxHeight: 100, interactive: false, reverse: true } }).status);
  assert.equal(passing, 'ok');
  const staticLegend = await root.locator('span[data-series="s11"]').evaluate(node => ({
    layout: node.parentElement.parentElement.style.gridTemplateColumns,
    capped: node.parentElement.style.maxBlockSize,
    interactive: node.hasAttribute('aria-pressed'),
    first: node.parentElement.firstElementChild === node,
  }));
  assert.equal(staticLegend.layout, 'minmax(0px, 1fr) 150px');
  assert.equal(staticLegend.capped, '100px');
  assert.equal(staticLegend.interactive, false);
  assert.equal(staticLegend.first, true);
  assert.match(await table.locator('caption').innerText(), /Original values/);

  const boundary = await page.evaluate(() => {
    const second = document.querySelector('#second');
    const call = mount => web.createChart(second, data, options, mount);
    const reasons = [];
    const append = result => reasons.push(result.diagnostic?.reason);
    const unread = { get instanceId() { throw Error('Caller accessor must stay unread'); } };
    append(call(unread));
    append(call(null));
    append(call(new Proxy({}, { ownKeys() { throw Error('Unavailable descriptors'); } })));
    append(call({ instanceId: 'duplicate', onViewportChange: true }));
    append(call({ instanceId: 'duplicate', synchronization: {} }));
    append(call({ instanceId: 'duplicate', content: { title: { text: true } } }));
    append(call({ instanceId: 'boundaries' }));
    append(call({ instanceId: 'detached-sync', synchronization: { join() { throw Error('Closed group'); } } }));
    const failedMountsRemoved = second.childElementCount === 0;
    append(chart.setViewport({ x: [0, 1] }));
    append(chart.zoomBy(2));
    const before = chart.getFrame();
    const next = { ...data, get series() { throw Error('Accessor data must stay unread'); } };
    append(chart.update(next));
    append(chart.updateOptions({ ...options, appearance: { points: [{ seriesId: 'missing', pointId: 'p0', color: '#226644' }] } }));
    const originalCommitted = chart.getFrame() === before;
    chart.destroy();
    append(chart.setViewport({ x: [0, 1] }));
    append(chart.zoomBy(2));
    return { reasons, failedMountsRemoved, originalCommitted };
  });
  assert.deepEqual(boundary.reasons.slice(0, 8), [
    'INVALID_MOUNT_OPTIONS', 'INVALID_MOUNT_OPTIONS', 'INVALID_MOUNT_OPTIONS', 'INVALID_MOUNT_OPTIONS',
    'INVALID_MOUNT_OPTIONS', 'INVALID_CONTENT_PORTS', 'DUPLICATE_INSTANCE_ID', 'INVALID_SYNCHRONIZATION',
  ]);
  assert(boundary.failedMountsRemoved && boundary.originalCommitted);
  const rejectedRichMount = await page.evaluate(() => {
    const host = document.querySelector('#second');
    let signal, releases = 0;
    const result = web.createChart(host, data, options, {
      instanceId: 'rejected-rich-sync',
      synchronization: { join() { throw Error('Adapter could not subscribe'); } },
      content: {
        title: {
          text: context => context.defaultText,
          render(target, context, lifecycle) {
            signal = lifecycle;
            target.textContent = context.text;
            return () => releases++;
          },
        },
      },
    });
    return { reason: result.diagnostic?.reason, aborted: signal?.aborted, releases, remaining: host.childElementCount };
  });
  assert.deepEqual(rejectedRichMount, { reason: 'INVALID_SYNCHRONIZATION', aborted: true, releases: 1, remaining: 0 });
  assert.deepEqual(boundary.reasons.slice(8, 11), ['VIEWPORT_UNAVAILABLE', 'VIEWPORT_UNAVAILABLE', 'INVALID_DATA']);
  assert.match(boundary.reasons[11], /POINT/);
  assert.deepEqual(boundary.reasons.slice(12), ['DESTROYED', 'DESTROYED']);
  assert.equal(await root.count(), 0);

  const dense = await page.evaluate(() => {
    const denseData = {
      type: 'line',
      axes: { x: { type: 'linear' }, y: { type: 'linear' } },
      series: [
        { id: 'history', name: 'History', data: Array.from({ length: 600 }, (_, x) => ({ id: String(x), x, y: (x % 13) + Math.floor(x / 30) })) },
        { id: 'stale', name: 'Retired', data: [{ id: 'retired', x: 0, y: 3 }, { id: 'end', x: 599, y: 3 }] },
      ],
    };
    const host = document.querySelector('#host');
    const base = { height: 280, locale: 'en' };
    const mounted = web.createChart(host, denseData, base, { instanceId: 'dense-runtime' });
    if (mounted.status !== 'ok') throw Error(JSON.stringify(mounted.diagnostic));
    const chart = mounted.value;
    const path = () => host.querySelector('[data-layer="geometry"] path');
    const original = path();
    const data = original.getAttribute('d');
    const originalLength = original.getTotalLength();
    const styled = chart.updateOptions({ ...base, appearance: { series: [{ id: 'history', color: '#114455', dash: 'dashed' }] } });
    const dashed = path().parentElement.getAttribute('stroke-dasharray');
    const retainedWhenStyled = path() === original && original.getAttribute('stroke') === '#114455';
    const restored = chart.updateOptions(base);
    const retainedWhenRestored = path() === original && original.getAttribute('d') === data &&
      original.getTotalLength() === originalLength && !original.parentElement.hasAttribute('stroke-dasharray');
    const retired = host.querySelector('[data-action="legend"][data-series="stale"]');
    retired.click();
    const hidden = chart.getHiddenSeriesIds();
    const replaced = chart.update({ ...denseData, series: [denseData.series[0]] });
    const remaining = chart.getHiddenSeriesIds();
    const visible = chart.getFrame().legend.map(item => item.id);
    chart.destroy();
    return { count: data.match(/[ML]/g).length, styled: styled.status, restored: restored.status, dashed,
      retainedWhenStyled, retainedWhenRestored, hidden, replaced: replaced.status, remaining, visible };
  });
  assert.equal(dense.count, 600);
  assert.equal(dense.styled, 'ok');
  assert.equal(dense.restored, 'ok');
  assert.equal(dense.dashed, '6 4');
  assert(dense.retainedWhenStyled && dense.retainedWhenRestored, JSON.stringify(dense));
  assert.deepEqual(dense.hidden, ['stale']);
  assert.equal(dense.replaced, 'ok');
  assert.deepEqual(dense.remaining, []);
  assert.deepEqual(dense.visible, ['history']);
  assert.equal(await root.count(), 0);

  await page.evaluate(() => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    window.barData = {
      type: 'column',
      axes: { x: { type: 'category', values: ids.map(id => ({ id, label: id })) }, y: { type: 'linear', domain: [0, 100] } },
      series: [{ id: 'series', name: 'Activity', data: ids.map((id, i) => ({ id, x: id, y: 10 + i * 10 })) }],
    };
    window.barOptions = { layout: { orientation: 'horizontal' }, height: 300, viewport: { axes: 'y', wheel: 'always' } };
    window.windows = [];
    const result = web.createChart(document.querySelector('#host'), barData, barOptions,
      { instanceId: 'bar-scroll', onViewportChange: value => windows.push(value) });
    if (result.status !== 'ok') throw Error(JSON.stringify(result.diagnostic));
    window.chart = result.value;
    window.scrollEvent = ctrlKey => {
      const svg = document.querySelector('#host svg');
      const rect = svg.getBoundingClientRect();
      const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey, deltaY: -170,
        clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 });
      svg.dispatchEvent(event);
      return event.defaultPrevented;
    };
  });
  assert.equal(await page.evaluate(() => scrollEvent(false)), true);
  await page.waitForFunction(() => windows.length === 1);
  const zoomed = await page.evaluate(() => chart.getFrame().viewport.value.y);
  assert(zoomed[1] - zoomed[0] < 100);
  assert.equal(await page.evaluate(() => chart.getFrame().viewport.value.x), undefined);
  await root.press('Shift+ArrowDown');
  assert.equal(await page.evaluate(() => windows.length), 1);
  await root.press('Shift+ArrowRight');
  assert.equal(await page.evaluate(() => windows.length), 2);
  await root.press('0');
  assert.equal(await page.evaluate(() => chart.getFrame().viewport.value.y), undefined);
  await root.press('Equal');
  assert.ok(await page.evaluate(() => chart.getFrame().viewport.value.y));
  await root.press('-');
  await page.evaluate(() => {
    const changed = chart.updateOptions({ ...barOptions, viewport: { axes: 'y', wheel: false, pan: false } });
    if (changed.status !== 'ok') throw Error(JSON.stringify(changed.diagnostic));
  });
  assert.equal(await page.evaluate(() => scrollEvent(true)), false);
  const beforeDisabled = await page.evaluate(() => windows.length);
  await root.press('Shift+ArrowLeft');
  assert.equal(await page.evaluate(() => windows.length), beforeDisabled);
  await page.evaluate(() => chart.destroy());
  assert.equal(await root.count(), 0);

  await page.evaluate(() => {
    const result = web.createChart(document.querySelector('#host'), {
      type: 'line',
      axes: { x: { type: 'category', values: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }] }, y: { type: 'linear' } },
      series: [{ id: 'readings', name: 'Readings', data: [{ id: 'zero', x: 'a', y: 0 }, { id: 'later', x: 'b', y: 24 }] }],
    }, {
      locale: 'en', height: 280, tooltip: { pinnable: true, placement: 'below' },
      accessibility: { description: 'Readings by period' },
    }, { instanceId: 'pinned-detail' });
    if (result.status !== 'ok') throw Error(JSON.stringify(result.diagnostic));
    window.chart = result.value;
  });
  await root.press('Home');
  assert.match(await root.getByRole('tooltip').innerText(), /Alpha.*Readings: 0/);
  const pin = root.locator('[data-action="tooltip-pin"]');
  await pin.click();
  assert.equal(await pin.getAttribute('aria-pressed'), 'true');
  const detail = root.locator('[role="region"][aria-label]');
  assert.match(await detail.innerText(), /Alpha.*Readings: 0/);
  await root.press('ArrowRight');
  assert.match(await root.getByRole('status').innerText(), /Beta.*Readings: 24/);
  assert.match(await detail.innerText(), /Alpha.*Readings: 0/);
  await root.press('Escape');
  const liveDetail = root.getByRole('tooltip');
  assert.match(await liveDetail.innerText(), /Beta.*Readings: 24/);
  assert.equal(await liveDetail.getAttribute('aria-label'), null, 'Unpinned detail must release its old accessible name');
  assert.equal(await pin.getAttribute('aria-pressed'), 'false');
  await page.evaluate(() => chart.destroy());
  assert.equal(await root.count(), 0);

  await page.evaluate(() => {
    const container = document.querySelector('main');
    container.style.height = '520px';
    container.style.overflow = 'hidden';
    window.visibilityOptions = { title: 'Readings in a tab', locale: 'en', height: 260, tooltip: { placement: 'auto' } };
    const result = web.createChart(document.querySelector('#host'), data, visibilityOptions, { instanceId: 'visibility-clip' });
    if (result.status !== 'ok') throw Error(JSON.stringify(result.diagnostic));
    window.chart = result.value;
    window.readingVisibility = (hidden, height, title) => {
      const host = document.querySelector('#host');
      host.hidden = hidden;
      container.style.height = height;
      const update = chart.updateOptions({ ...visibilityOptions, title });
      if (update.status !== 'ok') throw Error(JSON.stringify(update.diagnostic));
      const tooltip = host.querySelector('[role="tooltip"]');
      return { visibility: tooltip.style.visibility, text: tooltip.textContent.trim() };
    };
  });
  await root.press('Home');
  const expectedTooltip = await root.getByRole('tooltip').textContent();
  const hidden = await page.evaluate(() => readingVisibility(true, '520px', 'Hidden tab'));
  assert.equal(hidden.visibility, 'hidden');
  assert.equal(hidden.text, expectedTooltip.trim());
  const clipped = await page.evaluate(() => readingVisibility(false, '15px', 'Clipped plot'));
  assert.equal(clipped.visibility, 'hidden');
  assert.equal(clipped.text, expectedTooltip.trim());
  const restored = await page.evaluate(() => readingVisibility(false, '520px', 'Restored tab'));
  assert.equal(restored.visibility, '');
  assert.equal(restored.text, expectedTooltip.trim());
  await page.evaluate(() => chart.destroy());
  assert.equal(await root.count(), 0);

  for (const type of ['scatter', 'pie']) {
    await page.evaluate(type => {
      const container = document.querySelector('main');
      container.style.height = '';
      container.style.overflow = '';
      const group = web.createChartSyncGroup();
      const series = (id, y) => ({ id, name: id === 'source-series' ? 'Source' : 'Peer', data: [{ id: id + '-point', x: 2, y }] });
      const chartData = type === 'scatter' ? [
        { type, axes: { x: { type: 'linear' }, y: { type: 'linear' } }, series: [series('source-series', 6)] },
        { type, axes: { x: { type: 'linear' }, y: { type: 'linear' } }, series: [series('peer-series', 12)] },
      ] : [
        { type, data: [{ id: 'same-id', label: 'Source', value: 6 }] },
        { type, data: [{ id: 'same-id', label: 'Peer', value: 12 }] },
      ];
      window.syncControllers = chartData.map((item, i) => {
        const result = web.createChart(document.querySelector(i === 0 ? '#host' : '#second'), item, { height: 220, locale: 'en' }, {
          instanceId: type + '-linked-' + i, synchronization: group,
          onPointActivate: () => { throw Error('Synchronization must not activate a point'); },
        });
        if (result.status !== 'ok') throw Error(JSON.stringify(result.diagnostic));
        return result.value;
      });
    }, type);
    const peer = page.locator('#second [data-nc-web]');
    await root.press('Home');
    assert.match(await peer.getByRole('tooltip').innerText(), /Peer[\s\S]*12/);
    assert.deepEqual(await page.evaluate(() => syncControllers.map(controller => controller.getSelection())), [[], []]);
    await root.press('Escape');
    await peer.getByRole('tooltip').waitFor({ state: 'hidden' });
    await page.evaluate(() => syncControllers.forEach(controller => controller.destroy()));
    assert.equal(await root.count(), 0);
    assert.equal(await peer.count(), 0);
  }

  for (const key of ['title', 'legend', 'tooltip']) {
    for (const stage of ['text', 'render', 'diagnostic']) {
      const outcome = await page.evaluate(({ key, stage }) => {
        const host = document.querySelector('#host');
        const calls = { text: 0, render: 0, abort: 0, cleanup: 0, diagnostic: 0, observer: 0 };
        const result = web.createChart(host, data, { height: 240, locale: 'en' }, {
          instanceId: 'content-disposal',
          onDiagnostic() { calls.observer++; },
        });
        if (result.status !== 'ok') throw Error(JSON.stringify(result.diagnostic));
        const owner = result.value;
        const root = host.querySelector('[data-nc-web]');
        const update = owner.updateContent({
          [key]: {
            text(context) {
              calls.text++;
              if (stage === 'text') owner.destroy();
              if (stage === 'diagnostic') throw Error('Consumer text failed');
              return context.defaultText;
            },
            render(target, context, signal) {
              calls.render++;
              target.textContent = context.text;
              signal.addEventListener('abort', () => calls.abort++, { once: true });
              if (stage === 'render') owner.destroy();
              return () => calls.cleanup++;
            },
          },
          onError() {
            calls.diagnostic++;
            owner.destroy();
          },
        });
        if (key === 'tooltip') root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
        const beforeStaleEvent = { ...calls };
        root.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
        return { calls, beforeStaleEvent, status: update.status, reason: update.diagnostic?.reason,
          remaining: host.querySelectorAll('[data-nc-web]').length };
      }, { key, stage });
      assert.equal(outcome.status, key === 'tooltip' ? 'ok' : 'invalid');
      assert.equal(outcome.reason, key === 'tooltip' ? undefined : 'DESTROYED');
      assert.equal(outcome.remaining, 0);
      assert.deepEqual(outcome.calls, outcome.beforeStaleEvent);
      const rich = stage === 'render' ? 1 : 0;
      assert.deepEqual(outcome.calls, {
        text: 1, render: rich, abort: rich, cleanup: rich, diagnostic: stage === 'diagnostic' ? 1 : 0, observer: 0,
      }, key + ' ' + stage);
    }
  }

  await page.evaluate(() => {
    const host = document.querySelector('#host');
    host.style.width = '390px';
    window.scrollingOptions = { title: 'Long source series', locale: 'en', height: 250,
      appearance: { minPlotWidth: 1100 }, tooltip: { content: 'point', placement: 'below', pinnable: true },
    };
    window.selectionEvents = [];
    const oneSeries = { ...data, series: [data.series[0]] };
    const mounting = web.createChart(host, oneSeries, scrollingOptions, {
      instanceId: 'scroll-for-keyboard', onSelectionChange: selection => selectionEvents.push(selection),
    });
    if (mounting.status !== 'ok') throw Error(JSON.stringify(mounting.diagnostic));
    window.chart = mounting.value;
  });
  const scroll = root.locator('svg').first();
  const scrollLeft = () => scroll.evaluate(svg => svg.parentElement.scrollLeft);
  assert.equal(await scrollLeft(), 0);
  await root.press('Control+End');
  assert(await scrollLeft() > 300, 'Keyboard navigation must reveal the end of a scrollable plot');
  await root.press('Enter');
  assert.deepEqual(await page.evaluate(() => chart.getSelection()), [{ seriesId: 's0', pointId: 'p17' }]);
  await root.press('Control+Home');
  assert(await scrollLeft() < 100, 'Returning to the first datum must reveal the beginning of the plot');
  await scroll.evaluate(svg => { svg.parentElement.scrollLeft = 0; });
  await scroll.click({ position: { x: 4, y: 4 } });
  assert.deepEqual(await page.evaluate(() => chart.getSelection()), []);
  assert.deepEqual(await page.evaluate(() => selectionEvents), [[{ seriesId: 's0', pointId: 'p17' }], []]);
  await root.press('Home');
  const pinForScroll = root.locator('[data-action="tooltip-pin"]');
  await pinForScroll.click();
  const pinnedInScroll = root.locator('[role="region"][aria-label]');
  await pinnedInScroll.press('Escape');
  assert.equal(await root.evaluate(node => node === document.activeElement), true);
  assert.equal(await pinForScroll.getAttribute('aria-pressed'), 'false');
  await page.evaluate(() => chart.destroy());
  assert.equal(await root.count(), 0);
  await page.evaluate(() => {
    const host = document.querySelector('#host');
    host.style.width = '';
    window.toolbarOptions = {
      locale: 'en', height: 260,
      toolbar: { actions: ['download-svg', 'zoom-in', 'zoom-out', 'download-csv'], position: 'top' },
      viewport: { axes: 'x', zoom: { showSlider: true, label: 'Time window' } },
    };
    window.downloadDiagnostics = [];
    const mounted = web.createChart(host, { ...data, series: [data.series[0]] }, toolbarOptions, {
      instanceId: 'ordered-toolbar', onDiagnostic: diagnostic => downloadDiagnostics.push(diagnostic),
    });
    if (mounted.status !== 'ok') throw Error(JSON.stringify(mounted.diagnostic));
    window.chart = mounted.value;
    window.placeToolbar = zoom => chart.updateOptions({
      ...toolbarOptions, viewport: { ...toolbarOptions.viewport, zoom },
    });
  });
  const zoomGroup = root.locator('[data-action="zoom"]');
  const toolbar = root.locator('[data-download-toolbar]');
  const actions = () => toolbar.evaluate(node => [...node.children].map(item => item.dataset.action));
  assert.deepEqual(await actions(), ['download-svg', 'zoom', 'download-csv']);
  const slider = zoomGroup.locator('input[type="range"]');
  await slider.focus();
  assert.equal(await page.evaluate(() => placeToolbar({ showSlider: true, position: 'below' }).status), 'ok');
  assert.equal(await zoomGroup.getAttribute('data-zoom-position'), 'below');
  assert.deepEqual(await actions(), ['download-svg', 'download-csv']);
  assert.equal(await slider.evaluate(node => node === document.activeElement), true);
  assert.equal(await page.evaluate(() => placeToolbar({ showSlider: false, position: 'below' }).status), 'ok');
  assert.equal(await root.evaluate(node => node === document.activeElement), true);
  const firstDownloadError = await page.evaluate(async () => {
    const previous = URL.createObjectURL;
    const button = document.querySelector('#host [data-action="download-svg"]');
    let calls = 0;
    URL.createObjectURL = () => { calls++; throw Error('Simulated failed download'); };
    try {
      for (let click = 0; click < 2; click++) button.click();
      const until = Date.now() + 2000;
      while (!downloadDiagnostics.length && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 20));
      return { calls, diagnostics: downloadDiagnostics.map(item => [item.reason, item.path]) };
    } finally {
      URL.createObjectURL = previous;
    }
  });
  assert.deepEqual(firstDownloadError, { calls: 1, diagnostics: [['DOWNLOAD_FAILED', 'options.downloadMenu']] });
  await page.evaluate(() => chart.destroy());
  assert.equal(await root.count(), 0);
  const proposals = await page.evaluate(() => {
    const host = document.querySelector('#host');
    const source = { ...data, series: [data.series[0]] };
    window.controlledOptions = {
      locale: 'en', height: 260, tooltip: { enabled: true, content: 'point', placement: 'below' },
      viewport: { axes: 'x', value: { x: [2, 15] } },
    };
    const windows = [], diagnostics = [];
    window.controlledChanges = windows;
    const mounted = web.createChart(host, source, controlledOptions, {
      instanceId: 'controlled-window', onViewportChange: proposal => windows.push(proposal),
      onDiagnostic: diagnostic => diagnostics.push(diagnostic.reason),
    });
    if (mounted.status !== 'ok') throw Error(JSON.stringify(mounted.diagnostic));
    window.chart = mounted.value;
    const before = chart.getFrame();
    const invalid = chart.setViewport({ x: { firstId: 'a', lastId: 'b' } });
    const accepted = chart.setViewport({ x: [5, 12] });
    const invalidZoom = chart.zoomBy(0);
    return { invalid: invalid.status, accepted, invalidZoom: invalidZoom.status, diagnostics,
      windows, unchanged: before === chart.getFrame(), view: chart.getFrame().viewport.value,
      upperBound: chart.getFrame().viewport.bounds.x.domain[1] };
  });
  assert.equal(proposals.invalid, 'invalid');
  assert.equal(proposals.invalidZoom, 'invalid');
  assert.equal(proposals.diagnostics.length, 1);
  assert.deepEqual(proposals.accepted, { status: 'ok', value: { x: [5, 12] } });
  assert.deepEqual(proposals.windows, [{ x: [5, 12] }]);
  assert(proposals.unchanged);
  assert.deepEqual(proposals.view, { x: [2, 15] });
  const thumb = root.locator('[data-viewport-scroll]');
  const appliedPosition = await thumb.inputValue();
  await thumb.press('End');
  await page.waitForFunction(() => controlledChanges.length === 2);
  const proposedEnd = await page.evaluate(() => controlledChanges[1].x);
  assert(Math.abs(proposedEnd[1] - proposals.upperBound) < 1e-8);
  assert(Math.abs(proposedEnd[1] - proposedEnd[0] - 13) < 1e-8);
  assert.equal(await thumb.inputValue(), appliedPosition);
  assert.deepEqual(await page.evaluate(() => chart.getFrame().viewport.value.x), [2, 15]);
  assert.equal(await page.evaluate(() => chart.updateOptions({
    ...controlledOptions, viewport: { ...controlledOptions.viewport, pan: false },
  }).status), 'ok');
  assert.equal(await thumb.isHidden(), true);
  assert.equal(await root.evaluate(node => node === document.activeElement), true);
  await root.press('Home');
  await root.press('Enter');
  assert.equal((await page.evaluate(() => chart.getSelection())).length, 1);
  assert.equal(await page.evaluate(() => chart.updateOptions({
    ...controlledOptions, animation: { enabled: true, duration: 80, revision: 1 },
  }).status), 'ok');
  assert.deepEqual(await page.evaluate(() => chart.getSelection()), []);
  await root.getByRole('tooltip').waitFor({ state: 'hidden' });
  await page.evaluate(() => chart.destroy());
  assert.equal(await root.count(), 0);
  assert.deepEqual(errors, []);
  await writeCoverage();
  console.log('Chromium · original-data pagination, responsive legend, synchronous mount validation, atomic rejection and teardown');
} finally {
  await browser.close();
}
