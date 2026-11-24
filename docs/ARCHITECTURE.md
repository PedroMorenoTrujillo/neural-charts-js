# Web rendering over the shared calculation engine

Current continuation addendum —2026-11-03: the catalogue now has118 UI families/117 data discriminators and599 variants. The original319 Native recipes are preserved;280 financial recipes use56 new financial capabilities in an isolated shared-Core owner worktree. The candidate source/archive is pinned in core-candidate.json and is not published. This addendum supersedes the earlier catalogue counts and pending capability descriptions below; frozen mathematical foundations are unchanged.

The public Core/Web Cartesian and financial entries are independently bundleable. SVG/PNG/CSV, owned animation, gesture previews, explicit synchronization, collision pruning, reference bands, annotations and custom themes are implemented. Angular owns the static SVG DOM during SSR/hydration and subsequently mounts one interactive Web owner. The adapter requires only Web plus Angular Core/Common peers. See WEB-API.md and the ongoing NC-V1-EXECUTION-LEDGER.md in the showcase for current evidence and gates. The following text records the initial adoption checkpoint rather than claiming those capabilities remain missing.

Decision checkpoint:2026-11-02. Three independent local repositories: neural-charts-js, neural-charts-angular and neural-charts-showcase. Shared calculation engine remains in neural/core, published as @neural-charts/core. Native retains its own renderer and touch experience.

Dependency direction: Angular adapter → Web → public Core. The showcase consumes real archives of the first two. Core never imports Angular/Web. No registry of framework components or alternate hidden chart engine is used.

## Contracts and owners

- ChartData is a readonly discriminated union derived from the public PlanSpec. type replaces family. Numeric/source content and stable IDs stay in data; presentation/layout goes to ChartOptions. Timeline event titles remain domain content.
- Bar is Column data with horizontal orientation. Gauge solid is a presentation mode. Other62 catalogue entries map to61 data discriminators. No fake data discriminator was added to Core.
- planWebChart transports/validates data/options and calls public planChart. It does not implement scales, interpolation, radial packing, stacking or mathematical layouts.
- WordCloud requests real SVG font measurements through a renderer port. The browser measures strings; Core owns font sizing/packing. Server/pure callers must provide a real measurement port or receive TEXT_MEASUREMENT_REQUIRED.
- chartSvg serializes the public frame's commands/rectangles/cells/circles/text glyphs and axis/grid annotations into escaped SVG. No raster chart renderer is used.
- createChart owns its section, one ResizeObserver, delegated listeners, one scheduled resize frame, logical focus and ephemeral selection/viewport when uncontrolled. It never removes foreign host children.
- Applied selectedPoints, hiddenSeriesIds and viewport.value are controlled by consumers when provided. Callbacks propose domain changes; rejected proposals do not mutate applied inputs.
- Identity uses seriesId+pointId, never category text, DOM index or object reference. Observations and tooltip groups are indexed. Focus overlays do not reconstruct the entire SVG.
- Resize handles width changes only; changes to the owner's own height do not cause feedback loops. Invalid updates retain the last valid chart atomically.
- Original tables retain nulls, source distributions, graph relationships and hidden series; browser DOM pages100 rows at a time. Rounded display values do not mutate original data.

The Angular adapter uses signals/OnPush and afterNextRender for browser ownership; DestroyRef releases it. SSR returns a semantic original-data fallback and hydration retains that DOM. Interactive SVG is created after hydration; server-generated SVG is a separate pending capability.

## Catalogue authority

Native baseline37c6916 supplied319 pure example recipes with source hashes. the reference series inventory supplied50 target2D series. solidgauge maps to Gauge solid; Bar maps to horizontal Column.3D/maps/Gantt are excluded. Native adds useful radial, distribution and analytical variants.

All319 fixtures must plan, type-check and paint through public packages. This verifies the imported baseline, not all options/interactions of the comparison baseline. The financial series and indicators remain recorded in series-reference.json; they have not been silently declared implemented or excluded from the user's broad request.

## Distribution

ESM plus declarations, sideEffects:false, one exact runtime dependency Core0.0.23. Core itself has zero runtime dependencies. Web/Angular packages are private/UNLICENSED and unpublished. Cross-repository work uses hashed npm-pack files; no source aliases or symlinks. Angular APF depends on Web and peers only @angular/core.

The generic Core factory currently retains all supported planning families. Root-unused tree shaking is tested; per-family size separation is not claimed. Solve that boundary in the shared engine owner, without copying private Core algorithms into Web.

## Protected references

Historical neural-charts remains at1eb7043; its pre-existing drafts are not imported into these commits.26 NC-01A files and1,544 protected PNGs are verified independently. No existing approvals, historical bundle budgets or licensing terms are rewritten.
