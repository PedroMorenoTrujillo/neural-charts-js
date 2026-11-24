# Typed custom content

Custom content is a separate capability port. `data` and `options` stay plain, immutable and serializable. Do not put callbacks, DOM nodes or Angular TemplateRef objects inside them.

All five slots are supported: `title`, `tooltip`, `legend`, `axisLabel`, `dataLabel`. Every slot supplies a synchronous `text(context): string`; it is the canonical representation for accessible names, announcements, server SVG and SVG/PNG export. A browser-only `render(host, context, signal)` can enhance it and return a cleanup function. Contexts are readonly, carry `defaultText`, family/locale and the relevant original observation, tick or stable series identity. Render contexts also carry the canonical `text`.

```ts
import {createChart, type ChartContentPorts} from '@neural-charts/web';
const content: ChartContentPorts = {
  title: {
    text: context => `Revenue · ${context.defaultText}`,
    render: (host, context) => {
      const strong = host.ownerDocument.createElement('strong');
      strong.textContent = context.text;
      host.append(strong);
    },
  },
  tooltip: {text: context => `${context.observation.seriesName}\n${context.defaultText}`},
  legend: {text: context => `${context.name}${context.visible ? '' : ' (hidden)'}`},
  axisLabel: {text: context => context.defaultText},
  dataLabel: {text: context => context.defaultText},
};
const result = createChart(host, data, options, {instanceId:'revenue', content});
if (result.status === 'ok') {
  result.value.updateContent(content);
  result.value.exportSvg(); // same canonical title, legend and label content
  result.value.updateContent(undefined); // restore all built-in presentation
}
```

Adapters that compose capabilities can call the public `validateChartContent(input)` helper. It returns a typed result with a descriptor-validated frozen copy, without invoking getters. A malformed title port returns the default title in `formatChartTitle`; planning/rendering still reports the invalid content transaction rather than applying it.

Replace the port object to change its capabilities. `update(data, options, content)` and `updateOptions(options, content)` can apply them in the same transaction; omitting the last argument retains them, while explicitly passing undefined clears them. Shape-invalid ports return an invalid result before changing the chart. Callback failures use the default text and report through `onError` and the mount diagnostic callback. Returned strings are escaped; they are never interpreted as HTML. Synchronous reentrant updates return `REENTRANT_UPDATE`; destruction during a callback remains supported and aborts/cleans the in-flight view.

## Angular templates

Use the independent `[content]` input for portable text and projected templates for the browser enhancement. Import each directive used in the consumer's standalone component:

- `NeuralChartTitleTemplate`: `ng-template[ncChartTitle]`.
- `NeuralChartTooltipTemplate`: `ng-template[ncChartTooltip]`.
- `NeuralChartLegendTemplate`: `ng-template[ncChartLegend]`.
- `NeuralChartAxisLabelTemplate`: `ng-template[ncChartAxisLabel]`.
- `NeuralChartDataLabelTemplate`: `ng-template[ncChartDataLabel]`.

The implicit value is typed per slot, not any. Both `NeuralChart` and `NeuralCartesianChart` support them. Without a supplied text callback, the template uses the library's default portable text.

```html
<nc-cartesian-chart [data]="data" [options]="options" [content]="content" instanceId="revenue">
  <ng-template ncChartTitle let-title><strong>{{title.text}}</strong></ng-template>
  <ng-template ncChartTooltip let-tooltip><strong>{{tooltip.observation.seriesName}}</strong><br>{{tooltip.text}}</ng-template>
  <ng-template ncChartLegend let-series><em>{{series.text}}</em></ng-template>
  <ng-template ncChartAxisLabel let-label><svg:tspan font-weight="600">{{label.text}}</svg:tspan></ng-template>
  <ng-template ncChartDataLabel let-label><svg:tspan font-weight="700">{{label.text}}</svg:tspan></ng-template>
</nc-cartesian-chart>
```

Title/tooltip/legend templates contain presentational HTML. The library retains the heading, tooltip role, legend buttons, `aria-pressed`, focus, gestures and outputs. Axis/data templates contain SVG text/tspan content; arbitrary HTML in SVG is not supported. Focusable controls, links and media/action owners are rejected inside these slots. Put separate interactive controls outside the chart. Templates must remain presentational after their initial rendering too.

Each browser render gets an AbortSignal. The previous signal aborts and the cleanup runs on replacement, tooltip closure, hidden/replaced geometry and destruction. Angular destroys the associated EmbeddedViewRef. No MutationObserver or listener is created per datum. SVG labels retain the existing density/pruning rules; custom typography must still fit its available space.

## SSR, export and original data

Server rendering and hydration use the portable text representation and never execute browser render callbacks. Templates enhance the browser after hydration; they do not replace the server DOM during hydration. The same text is used by SVG and PNG export. Arbitrary browser HTML, CSS and icons are not automatically converted into equivalent SVG; make the portable text describe the same information. These are explicit representations, not a promise of pixel-identical arbitrary HTML exports.

A per-point data-label context contains its original `observation`. A Core layout/aggregate annotation instead carries `annotation`; it does not invent a point ID. Tooltip contexts expose the active observation and the shared original-value group. Custom presentation never rewrites CSV/table values, units, currencies or domain identities.

## Resource scope

The browser owner releases each custom view and its chart resources on destroy. The unchanged shared chart stylesheet is cached once per Document or ShadowRoot and lives for that scope, not per chart. Moving or remounting a host recovers the correct scope on paint. This bounded stylesheet cache creates no observer, listener or animation handle.
