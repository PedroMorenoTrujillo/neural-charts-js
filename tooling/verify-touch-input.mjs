import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { openInstrumentedPage } from './browser-modules.mjs';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ hasTouch: true, isMobile: true, viewport: { width: 600, height: 620 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const writeCoverage = await openInstrumentedPage(page,
    '<meta name="viewport" content="width=device-width, initial-scale=1"><div id="host" style="width:560px"></div>', 'en');
  await page.evaluate(async () => {
    const { createChart } = await import('/web/index.js');
    const data = {
      type: 'line',
      axes: { x: { type: 'linear', domain: [0, 100] }, y: { type: 'linear', domain: [0, 100] } },
      series: [{ id: 'series', name: 'Measurements', data: [0, 25, 50, 75, 100].map(x => ({ id: 'p' + x, x, y: x })) }],
    };
    const host = document.querySelector('#host');
    window.windows = [];
    window.activations = [];
    window.mountTouch = (axes, pan, pinch) => {
      window.chart?.destroy();
      windows.length = 0;
      activations.length = 0;
      const created = createChart(host, data, { height: 360, viewport: { axes, pan, pinch } }, {
        instanceId: 'touch-input',
        onViewportChange: value => windows.push(value),
        onPointActivate: event => activations.push(event),
      });
      if (created.status !== 'ok') throw Error(JSON.stringify(created.diagnostic));
      window.chart = created.value;
    };
  });
  const client = await page.context().newCDPSession(page);
  const chart = page.locator('#host [data-nc-web]');
  const geometry = chart.locator('svg [data-layer="geometry"]');
  const waitForPreview = () => geometry.evaluate(node =>
    new Promise(resolve => {
      if (node.hasAttribute('transform')) return resolve(true);
      const timer = setTimeout(() => { observer.disconnect(); resolve(false); }, 2000);
      const observer = new MutationObserver(() => {
        if (!node.hasAttribute('transform')) return;
        observer.disconnect();
        clearTimeout(timer);
        resolve(true);
      });
      observer.observe(node, { attributes: true, attributeFilter: ['transform'] });
    }));
  const send = (type, points = []) => client.send('Input.dispatchTouchEvent', {
    type, touchPoints: points.map(([x, y, id]) => ({ x, y, id })),
  });
  async function pair(axes, pan, pinch) {
    await page.evaluate(parameters => mountTouch(...parameters), [axes, pan, pinch]);
    const svg = await chart.locator('svg').boundingBox();
    const x = Math.round(svg.x + svg.width / 2);
    const y = Math.round(svg.y + svg.height / 2);
    await send('touchStart', [[x - 28, y, 0]]);
    await send('touchStart', [[x - 28, y, 0], [x + 28, y, 1]]);
    return [x, y];
  }

  for (const axis of ['x', 'y', 'xy']) {
    const [x, y] = await pair(axis, false, true);
    await send('touchMove', [[x - 70, y, 0], [x + 70, y, 1]]);
    assert.equal(await waitForPreview(), true);
    assert.match(await geometry.getAttribute('transform'), /scale/);
    await send('touchEnd');
    await page.waitForFunction(() => windows.length === 1);
    const value = await page.evaluate(() => windows[0]);
    for (const name of ['x', 'y']) {
      if (axis.includes(name)) {
        assert(value[name][0] > 0 && value[name][1] < 100);
        assert(value[name][1] - value[name][0] < 50);
      } else assert.equal(value[name], undefined);
    }
    assert.equal(await geometry.getAttribute('transform'), null);
    assert.deepEqual(await page.evaluate(() => activations), []);
  }

  let [x, y] = await pair('xy', false, true);
  await send('touchMove', [[x - 69, y, 0], [x + 69, y, 1]]);
  assert.equal(await waitForPreview(), true);
  await send('touchCancel');
  assert.equal(await geometry.getAttribute('transform'), null);
  assert.deepEqual(await page.evaluate(() => windows), []);

  [x, y] = await pair('xy', false, false);
  await send('touchMove', [[x - 70, y, 0], [x + 70, y, 1]]);
  await send('touchEnd');
  assert.equal(await geometry.getAttribute('transform'), null);
  assert.deepEqual(await page.evaluate(() => windows), []);
  await page.evaluate(() => window.chart.destroy());
  assert.equal(await chart.count(), 0);
  assert.deepEqual(errors, []);
  await writeCoverage();
  console.log('Chromium · real touch pinch on X/Y, restricted axes, cancellation and input deactivation');
} finally {
  await browser.close();
}
