# Web consumption contract

Neural Charts Web provides ESM JavaScript and TypeScript declarations. It uses @neural-charts/core for scales, layouts and data calculations.

## Installation and boundaries

Run `npm install @neural-charts/web` in your application. npm installs Core automatically.

Public entrypoints:

| Import | Purpose |
| --- | --- |
| `@neural-charts/web` | Full catalogue, pure planning, mounting, exports, synchronization, types |
| `@neural-charts/web/cartesian` | `createCartesianChart`, `createLineChart`, `createColumnChart`, `createBarChart`, and pure `renderCartesianChartSvg` using the public Cartesian Core planner |
| `@neural-charts/web/financial` | `createFinancialChart` using the public financial Core planner |

The granular entries remove unrelated engines. Cartesian still shares its ordered-family capabilities; it is not represented as an individually isolated Line engine. Raw/gzip/Brotli and actual module contributions are recorded by `tooling/verify.mjs`. Historical B/C budgets remain pending; no budget is changed by creating a new measurement scenario.

## Data and presentation

`ChartData` is a readonly discriminated union. `type` selects a supported family. Series and points have stable IDs; category labels are presentation, not unique identity. Axes in data describe the represented domain. `ChartOptions` owns titles, descriptions, layout, palette, labels, axes presentation, legend, tooltip, animation, references, selection and viewport.

`planWebChart(data, options, size, hiddenSeriesIds?, ports?)` returns a contained result. `createChart(host, data, options, mount)` returns either `{status:'ok', value:controller}` or `{status:'invalid', diagnostic}`. An invalid update preserves the previous valid render.

Default resource limits remain 10,000 points and 64 categories. Explicit `capacity` permits up to 50,000 points and 10,000 categories through Web where the selected Core family supports them. Larger limits are not silently enabled. Line and Column capacity scenarios are tested independently; a family with a narrower contract still returns a diagnostic.

## Owner lifecycle and events

`mount.instanceId` must be stable, unique in the document and match `[A-Za-z][\w-]{0,95}`. A controller offers `update`, `updateOptions`, `getFrame`, `getSelection`, `getHiddenSeriesIds`, `exportSvg`, `exportCsv`, `exportPng`, and `destroy`. `getFrame` exposes a readonly owned snapshot. Destroy disconnects its observer, listeners, gesture preview, wheel timer, animation, synchronization channel and pending exports.

Domain callbacks are `onPointActivate`, `onSelectionChange`, `onHiddenSeriesChange`, `onViewportChange`, and `onDiagnostic`. They contain logical identities and values, never business state encoded in a DOM Event. With `selectedPoints`, `hiddenSeriesIds`, or `viewport.value` supplied, the consumer owns that applied state: events are proposals. Rejected proposals do not self-apply. Without those inputs, the owner manages the corresponding local state.

## Interaction

Keyboard: arrows traverse observations/series, Home/End choose endpoints, Enter/Space activates, Escape closes detail, `+`/`-` zoom, and `0` resets when viewport is available. Set `ChartToolbarAction.Zoom` in `toolbar.actions` to place the three icon buttons together. By default the slider is hidden. The magnifiers and the `+`/`-` keys change the applied zoom by 1×, from 1× to at most 20×, subject to the chart’s domain. Reset returns to 1×.

Set `viewport.zoom.showSlider: true` to place the slider to the left of the zoom buttons. Moving it selects the increment for both magnifiers without changing the viewport. In this mode, `ChartZoomOptions` supports `min`, `max`, `step`, `increment` and `label`, with defaults of 0.1, 15, 0.1, 1 and “Zoom”. For example, `zoom: { showSlider: true, max: 50, label: 'Magnification' }` lets you select an increment up to 50×. The chart’s domain still constrains the applied zoom. With a viewport and default controls, the zoom group is added automatically when omitted. Use `viewport.controls: false` to opt out of that automatic group. The horizontal scrollbar appears when the physical horizontal axis has room to pan. Arrow keys on the scrollbar and Shift+arrows on the chart pan the applied viewport. Mouse drag pans; Ctrl/Cmd plus wheel zooms, or `viewport.wheel:'always'` explicitly opts into unmodified wheel. Two fingers pan/pinch while one finger preserves document scrolling. `pan:false`, `pinch:false`, and `wheel:false` disable the corresponding gesture.

Choose `viewport.zoom.position: ChartZoomPosition.Below` for a dedicated row after the chart. `ChartZoomPosition.Toolbar` groups zoom with the download buttons and follows `toolbar.position`. The separate row stays below the chart even if the download toolbar is above it. If both rows are below, zoom comes before downloads.

Gesture moves show a physical preview without rebuilding Core geometry; completion proposes one represented viewport. Reset, data changes and destruction cancel stale previews. Tooltips use logical identity, can share category values, support docking, RTL and financial source values. The mobile dock occupies layout space rather than covering the selected datum.

`createChartSyncGroup()` provides an explicit local synchronization port. Pass it as `mount.synchronization`, then destroy the group at its owner's end of life. There is no global registry and receiving a point never republishes it.

## Presentation and accessibility

`theme:'light'|'dark'` establishes defaults. `themeTokens` overrides background, foreground, muted, grid and focus with validated hex colors. `appearance.colors` is the series palette; rising/falling and band colors are separate. `locale:'en'|'es'` localizes built-in controls and data-table metadata and declares the chart language for assistive technology. Consumer text is preserved.

`appearance.series` applies presentation by stable `id`: HEX `color`, `dash:'solid'|'dashed'|'dotted'`, `marker:'circle'|'square'|'diamond'|'triangle'`, marker radius, area `fillOpacity`, and `pattern:'none'|'diagonal'|'dots'|'crosshatch'`. Marker shapes apply to ordered curves and Scatter; quantitative bubble sizes are not replaced. Patterns use internal SVG definitions, including in exports. Legends/focus retain the series color.

Each `axes.x`, `axes.y` and `axes.secondaryY` accepts `numberFormat` and `labels:{maxLines,maxCharacters,rotation,layout}`. Maximum lines are1–3, character limits are upper bounds constrained by available space, and rotation is between−90 and90 degrees. `layout` accepts `auto`, `all` or `truncate`. `all` shows full labels within renderer limits. `truncate` reserves one line with the complete text in the SVG title. Parallel coordinates use `axes.x.visible` for dimension names and `axes.y.visible` for value ticks. Full axis text remains available in SVG titles/descriptions. `formatting.number` controls value formatting using cached Intl decimal/currency/percent/notation options; numeric X retains its own units unless explicitly formatted. `formatting.date` formats raw time ticks and defaults to UTC. Precomposed semantic annotation strings retain their Core wording. Raw table/CSV values are never rounded by display formatting.

`legend` additionally accepts `interactive`, `reverse`, `maxLabelCharacters` and `itemSpacing`. A static legend has no fake pressed-button ARIA; truncated names retain full labels. Reversal changes presentation, not data identity. Without itemSpacing, the original8px row/16px column gap is preserved.

Up to32 ordered `responsive` rules use inclusive `minWidth`/`maxWidth` conditions against the owning container. Overrides are limited to height, axes, legend, appearance and tooltip; nested axis label/format fields merge. Widening restores the original base options. Rules cannot replace data, selection, viewport or observed width. Pure SVG rendering resolves against configured width or640px; browser rendering uses the actual container. Merged options are validated before application.

Labels are sampled within `labelLimit` and collision-pruned using actual rendered SVG bounds. Full original values remain in the accessible table. `annotations` anchor escaped text to series/point IDs; reference lines, bands and labels use represented axis values. SVG color axes and Bullet targets/bands use Core-projected geometry. Custom palettes require the consumer to preserve suitable contrast.

Heatmap/Tilemap cell labels choose black or white against the actual cell color composited with its opacity and the configured chart background. The bounded renderer tests verify at least4.5:1 for opaque/translucent light,dark and custom surfaces. This does not certify arbitrary consumer palettes for every other visual element.

Labels without a known filled-cell/box background use a thin chart-surface-colored text outline. It preserves legibility when a Sankey node, link or other ink passes underneath, without moving Core-projected anchors. Axes and labels with a calculated contrasting fill do not receive this outline.

The chart exposes a name, description, visible focus, keyboard navigation, live detail and an original-data table with100-row DOM pagination. Closed disclosures defer table construction. `describeChartData(data, hidden?, locale?, {offset,limit})` formats only the requested page and returns totalRows; CSV still exports all originals. Contours retain every original sample's ID, x/y coordinates and value.

`accessibility.description` supplies chart context; `seriesDescriptions` and `pointDescriptions` add keyboard/activation descriptions by stable identity. Hover stays quiet in the live region. `announceDataChanges` optionally announces actual dataset replacements. `keyboard:false` disables the plot tab stop/navigation while retaining the table and accessible controls. Automated axe checks are separate from manual VoiceOver/NVDA review, which remains pending. No manual approval is inferred.

`animation:{enabled:true,duration:180}` uses one cancellable opacity transition. Reduced motion always disables it. It does not create a second geometry owner or animate on the server.

## Presentation by observation

Set `appearance.points` to at most 256 entries with `seriesId`, `pointId` and a hexadecimal `color`. The IDs are the original data IDs, including known zero and absent values. A hidden or absent observation produces no extra mark. Lines and areas apply the override to point markers while keeping the connected stroke and area paint. Columns, horizontal bars, mixed columns, waterfall, scatter and bubble apply it to their individual marks. A point fill takes priority over the series pattern or palette. The legend continues to describe the series.

Keep the geometry in `referenceBands` and key `referenceBandStyles` by the same ID. Each style accepts `color`, `opacity` and `label`. An interval outside the window stays hidden. A label uses the available width and preserves its full text in the SVG.

With `tooltip.pinnable: true`, activate an observation and use the Pin detail control. The detail docks while pinned, survives pointer movement, and closes with Escape or the same control. Changing the data, replaying animation, or removing the observation from the visible frame releases it.

`setViewport(value)`, `zoomBy(factor)` and `resetViewport()` use the same viewport validation and proposal callback as built-in controls. With an applied `options.viewport.value`, update that value from the accepted proposal. A new `animation.revision` replays the enabled animation, clears transient exploration and releases a pinned detail. Controlled selection remains under the consumer's ownership.

## Drilldown

Import `createChartDrilldown` from `@neural-charts/web/drilldown`. Pass a root ID, nodes containing chart data and links keyed by source node, series ID and point ID. A link with a zero-valued point remains usable. Use `options.chart` for defaults and `options.nodes` for per-view overrides.

The owner presents an explicit detail action after selection and keeps one chart mounted at a time. Going back restores the parent viewport, hidden series and focus. Call `exportSvg`, `exportPng` or `exportCsv` for the current view and call `destroy` when the host unmounts. `resolveChartDrilldownRoot` resolves the initial chart for server rendering. Angular consumers can use `NeuralChartDrilldown` from `@neural-charts/angular`.

## Linked chart panels

Import `createChartPanels` from `@neural-charts/web/panels`. Give each panel a stable ID and chart data. Declare a link with `axis: 'x'` and the member panel IDs. Category links require the same ordered category IDs. Numeric and time links require matching explicit domains. Each panel owns its Y range and series visibility.

`setViewport(panelId, value)` applies a viewport and synchronizes the linked X range. `getViewport(panelId)` reads the applied value. Use `update` for a new data snapshot and `destroy` when the host unmounts. `resolveChartPanels` resolves panel data and options for server rendering. Angular consumers can use `NeuralChartPanels` from `@neural-charts/angular`.

## Export and server use

For stacked Column, Bar, Area, Area spline and scalar Mixed, `appearance.stackLabels:true` displays Core stack-total annotations independently of `appearance.dataLabels`. Totals receive collision priority; crowded labels can still be omitted while original values remain accessible. `stackLabels:false` suppresses totals. The renderer does not recalculate stack sums or positions. `layout.stacking:'sum'|'percent'` supports smooth stacked areas and mixed columns. In Mixed, line/area values remain independent; columns accumulate within their value axis. Two Y-axis stacks occupy separate category subslots. Percent columns require nonnegative, complete displayed rows and preserve original tooltip/table values.

`renderChartSvg(data, options, {instanceId, ports?, composition?})` is a pure server-safe SVG serializer. Its default remains plot-only for SSR; composition:'chart' produces a complete image. Controller `exportSvg()` and `exportPng()` default to a composition containing visible title, context, plot and legend. SVG export options are composition:'chart'|'plot', legend and description. PNG additionally accepts width, height, pixelRatio, background and signal and returns a Blob. Both preserve theme, RTL, patterns, selection and legend ordering. Export labels wrap at word boundaries, splitting only oversized words. Canvas only rasterizes exports. `exportChartCsv(data,{delimiter,bom})` retains original precision, missing values and spreadsheet-formula protection.

WordCloud requires actual font measurements on the server through `ChartPlanningPorts`. The browser renderer supplies SVG `getBBox` measurements. A server host must supply matching measured metrics or accept the explicit diagnostic; the package does not fabricate font widths. The showcase contains a measured build-time font cache and its provenance.

The Angular adapter consumes this package, owns inputs/outputs and lifecycle, and delegates all calculation to Core/Web. Its static SSR SVG is an Angular-owned projection whose nodes hydrate, followed by one interactive Web owner. It does not use `innerHTML`, `ngSkipHydration`, source aliases or a parallel Angular geometry engine.

`renderCartesianChartSvg` has the same SVG settings/result as `renderChartSvg`, but accepts `CartesianChartData` (Line, Spline, Area, Area spline and Column, including horizontal Bar/stacking options). It supports server rendering without retaining unrelated chart engines. The Angular package also offers `NeuralCartesianChart` / `<nc-cartesian-chart>` with the same inputs, domain outputs and export methods as the generic component.

Dense lines preserve complete command paths and original observations, keyboard targets, tables and CSV. No geometric downsampling or segment compaction is enabled. Validation of presentation fields can be reused only for a detached deeply immutable dataset constructed by the snapshot copier; caller-borrowed frozen graphs and changed mutable data still go through inspection and Core validation.
# Options-only updates

`controller.updateOptions(options)` applies a complete options object to the last owned immutable data. Use it for title, selection, tooltip or theme changes that do not replace the dataset. It preserves the same validation and controlled-state semantics as `update(data, options)` and returns the new revision or a contained diagnostic. Rejected updates leave the previous frame and DOM intact.

`update(data, options)` still validates caller data, including mutations made to a previously passed object; matching object identity alone is never treated as evidence that data are unchanged. Equal validated snapshots reuse the owned data and geometry. The options-only method avoids the necessarily linear inspection of replacement data. Both methods fail after destroy.
