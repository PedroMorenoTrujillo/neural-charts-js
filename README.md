# Neural Charts Web

[Documentation and examples](https://charts.neuralui.org/)

TypeScript-source, JavaScript-distribution SVG renderer over the shared npm `@neural-charts/core` calculation engine. The renderer runs directly in JavaScript applications and is also used by the separate Angular adapter. Mathematical scales, layouts and derivations belong to Core.

Install with `npm install @neural-charts/web`. npm installs `@neural-charts/core` as a dependency.

The showcase contains 71 chart representations, 47 financial indicators and 634 examples. Browse the documentation for configuration, export, gestures and synchronization.

```js
import { createChart } from '@neural-charts/web';
const data = {
  type: 'line',
  axes: { x: { type: 'linear' }, y: { type: 'linear' } },
  series: [{ id: 'visits', name: 'Visits', data: [
    { id: 'a', x: 0, y: 29 }, { id: 'b', x: 1, y: 46 },
  ] }],
};
const result = createChart(document.getElementById('chart'), data, { title: 'Activity' }, { instanceId: 'activity' });
if (result.status === 'ok') {
  // result.value.update(nextData, nextOptions);
  // result.value.destroy() when the owning view is removed.
}
```

Typed custom content for titles, tooltips, legends, axis labels and data labels uses a separate capability port. Angular adds typed projected templates. Accessibility, SSR and exports share the portable text representation.

## Zoom toolbar

Configure the axes in `viewport.axes` and add `ChartToolbarAction.Zoom` to `toolbar.actions` to show the zoom controls with the download buttons. The three controls zoom in, zoom out and reset. With the slider hidden by default, the buttons and the + and − keys use 1× steps up to 20×, within the chart’s available range.

Set `viewport.zoom.position` to `ChartZoomPosition.Below` for a separate row below the chart. Set `viewport.zoom.showSlider` to `true` to show the slider, then use `min`, `max`, `step`, `increment` and `label` to customize it. Import the enums from `@neural-charts/web`.

To build the source, use Node.js 22.22.3 or newer. Run `npm ci` and `npm run build`.

Licensed under [MIT](./LICENSE).
