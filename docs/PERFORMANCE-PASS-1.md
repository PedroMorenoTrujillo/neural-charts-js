# Performance corrections — first verified pass

This is a completed milestone inside the ongoing user-authorized correction task. It is not final V1 certification, a maximum-performance claim or the end of the configuration/accessibility/variant work.

## Implemented

- Shared Core logical-X viewport capacity now matches explicit planning capacity up to 10,000 categories. Y interval-row limit stays 256; default limits are unchanged. Zoom/pan/reset of 1,000 categories ×3 series works in both orientations in Chromium, Firefox and WebKit.
- Web snapshot validation reuses equal owned immutable subtrees while still detecting changes to mutable caller objects and rejecting accessors/cycles/sparse arrays. No trust in caller identity alone.
- Unchanged geometry preserves the actual SVG, projected observations, hit/navigation indexes and paginated table. Metadata updates do not parse or replace the SVG.
- `updateOptions(options)` applies complete options to the last owned dataset without a replacement-data traversal. Angular and the JavaScript showcase use this route for unchanged readonly input identity.
- Indexed keyboard navigation removes repeated full-dataset scans.
- Actual SSR fallback SVG/table DOM is retained through Angular hydration and no longer recalculated invisibly on every live options update. There is no second live geometry owner.
- Fully immutable Core input subtrees can reuse bounded validated copies. Every cache hit charges node/string/depth budgets. Mutable descendants are never cached.
- Native recipe transport now persistently carries single-series visibility, explicit stack labels and four panel compositions. The complete generated showcase catalogue is byte-for-byte the previously reviewed JSON; the 19 adaptations no longer disappear during package synchronization.

## Measurements

Apple M2 Pro, Node22.22.3, 50,000 deterministic line points, 900×380 configured size, markers/animation disabled. Each current phase: 30 measured samples after three warmups, synchronous API plus forced layout. No paint/FPS claim. Same original baseline retained under `../../neural/audits/stock-comparison-archive-2026-11-04/evidence-20261103/`.

| Browser | Baseline title p95 ms | Current title via update(data,options) p95 ms | Current updateOptions p95 ms | Current keyboard overlay p95 ms |
| --- | ---: | ---: | ---: | ---: |
| Chromium | 437.9 | 40.9 | 0.4 | 0.2 |
| Firefox | 494 | 56 | 1 | 1 |
| WebKit | 449 | 38 | 1 | 1 |

Replacement-data validation remains linear by design and still detects mutation of an already-passed object. Options-only work does not scale with point count. Large initial rendering, real changed-data geometry, zoom/pan, retained heap and per-entrypoint bundle costs need the next profiling/optimization pass; do not claim they are all solved.

## Evidence and limits

`artifacts/performance-corrections/updates.json`: packed isolated consumer; SVG/table/observation identity, applied selection/metadata, rejected-update atomicity, mutation detection, destroy and category gestures. Previous receipt is retained as a timestamped checkpoint.

`artifacts/performance-corrections/sdk/verification.json`: 599 variants in each of Chromium/Firefox/WebKit (1,797 checks), public-import/type/SSR boundaries, 100 resource cycles per engine. 354 same-browser basic dark PNGs match the preceding reviewed Web evidence exactly by SHA-256. These screenshot files are separate; no accepted original image is overwritten. This SDK campaign preceded the generator correction, whose 19 restored cases are independently exercised in the real showcase.

Core unit/property suite: 80 files, 985 tests, every plan integration script and isolated npm-pack consumer verification. Angular unit tests: 3 including preservation of both SVGs and actual changed-data updates. Showcase build remains 498.86kB initial against its unchanged 500kB warning budget.

Showcase lifecycle receipt: `../neural-charts-showcase/artifacts/performance-corrections/lifecycle/lifecycle-results.json` (from the repository's parent): each engine passed actual SSR shell/SVG/path DOM reuse, 100 single-chart and 100 two-panel integration switches, exactly-once activation, cleanup, touch and 12 axe scenarios. Native alignment passed 118 checks with 19 new candidate captures, including the restored visibility/totals/panel cases, desktop/mobile and automated accessibility in both integrations and all three engines. Its receipt is under showcase `artifacts/performance-corrections/native-alignment/`.

Bundle costs remain visible: current first-pass line scenario 64,147 B gzip and factory 169,436 B gzip, versus 63,473 and 168,698 before this pass. Indexing/cache logic has a small distribution cost; entrypoint retention is still a pending optimization. These scenarios are distinct from historical B/C budgets, whose exceptions remain unapproved. Root-unused remains 21 raw /41 gzip /25 Brotli bytes including the fixture's own marker.

No runtime dependencies added. Core commits in the shared repository: `55d3b81` (viewport) and `7e534cb` (immutable input reuse), branch `codex/charts-web-performance`. Current Core npm-pack SHA256 `355c99adf0263c328bc8487388165c6e7ec3c16f82a389c7129b7f2e0fef9051`; Web SHA256 `09c6f1dc16d3c47405ea6ed299ef78f03abfceb56f48b7029108521ba90a26ef`. Original checkout, frozen mathematics, accepted PNGs, Native and Neural UI are unchanged. Human visuals/VoiceOver/NVDA and budget approvals remain pending. No push/tag/release/publish/deploy.

## Continue now

Next: profile large initial/actual changed-data/zoom/pan, eliminate redundant immutable frame copies and unnecessary serialization/index work where the measured profile supports it, then address granular bundle retention. Follow with the configuration/a11y/stacking/export checkpoints in `PERFORMANCE-PRODUCT-EXECUTION.md`; do not end the task after this milestone.
