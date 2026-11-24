# Neural Charts Web

[Documentation and examples](https://charts.neuralui.org/)

TypeScript-source, JavaScript-distribution SVG renderer over the shared npm `@neural-charts/core` calculation engine. The renderer runs directly in JavaScript applications and is also used by the separate Angular adapter. Mathematical scales, layouts and derivations belong to Core.

Install with `npm install @neural-charts/web`. npm installs `@neural-charts/core` as a dependency.

Explore the [showcase](https://charts.neuralui.org/) or see [Web API](./docs/WEB-API.md) and [Custom content](./docs/CUSTOM-CONTENT.md).

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

Typed custom content for titles, tooltips, legends, axis labels and data labels uses a separate capability port. Angular adds typed projected templates; portable text is shared by accessibility, SSR and exports. See [CUSTOM-CONTENT.md](./docs/CUSTOM-CONTENT.md) for ownership, validation, examples and export boundaries.

Use Node22.22.3 or newer compatible tooling. `npm ci`, `npm run build`, `npm test`, `npm run verify`. Package and catalogue evidence lives in artifacts; acceptance status and the exact next work are recorded in EXECUTION-LEDGER.md. No publication, deployment or human approval is implied by a build or generated example.
