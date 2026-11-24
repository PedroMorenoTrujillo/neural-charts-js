# SVG performance round 2 — verified results

2026-11-04. Scoped optimization implemented and automated regression PASS. This is not a universal maximum-performance claim, V1 budget certification, human approval or release approval. The complete catalogue remains604 unique examples:30 principal analytical families/71 base representations, with47 financial indicators counted separately. JavaScript and Angular do not multiply the type count.

## Delivered implementation

- **Shared Core:** exact dense-Line streaming above2048 points avoids the full projected wrapper array, ID Map and remapped runs. Existing scales and step writer remain authoritative. Only eligible observations allocate projected wrappers; stable frozen IDs/group keys are weakly associated with normalized immutable series. Known-owned primitive observation records are frozen directly. Empty viewports do not allocate metadata arrays. All original path prefixes and every coordinate validation remain, preserving border crossings, gaps, dash phase and invalid offscreen-coordinate rejection. This does not claim X-window-only mapping or downsampling.
- **Web ownership/validation:** repeat presentation-tree inspection is reused only for fully detached immutable snapshot roots. Coarse root/array provenance avoids one extra WeakSet entry per point. Borrowed caller-frozen graphs and revocable Proxies remain inspected; options, Core semantics, capacities and nested snapshot budgets still run. Mutable input, accessor, changed-length/prior-snapshot and Proxy regressions are covered.
- **Angular distribution:** optional public NeuralCartesianChart / CartesianChartData and Web renderCartesianChartSvg use public Cartesian planners. Line/Spline/Area/Areaspline/Column/Bar/Cartesian stacking share a neutral private host and safe SVG projection. Existing NeuralChart and public StaticChart APIs remain. No Angular component depends on another public chart component. No geometry duplicated or private Core import. Showcase actual Cartesian examples and their compiled code use the granular adapter.
- **Resource ownership:** same signals, outputs, exports, SSR fallback/table, afterNextRender ownership and destruction rules. There is no server access to browser globals introduced. The SSR hydration verifier was updated from a private component-name selector to the actual fallback SVG; it still compares exact DOM identities and connected path nodes.

## Same-scenario50k measurements

Apple M2 Pro/arm64, Node22.22.3; Chromium153.0.8010.12, Firefox155.0, WebKit26.6. Same deterministic50k dataset and API+forced-layout benchmark,30 measured samples after3 warmups per scenario/engine. Serial execution without concurrent build/browser campaigns. These are synchronous timings, **not paint time or FPS**.

| Engine | Initial p50/p95 ms | Changed data p50/p95 ms | Zoom p50/p95 ms | Pan p50/p95 ms |
| --- | --- | --- | --- | --- |
| chromium | 278.3 / 335.2 | 279.8 / 313.5 | 53.1 / 59.3 | 50 / 59.1 |
| firefox | 305 / 431 | 325 / 530 | 61 / 80 | 62 / 74 |
| webkit | 324 / 360 | 339 / 370 | 80 / 88 | 78 / 87 |

Previous5a042d6515ee sample median zoom79.9/91/127ms and pan80/90/127ms; selected candidate53.1/61/80ms and50/62/78ms. Zoom improves about33–37%; pan about31–39%. Both previous samples remain in artifacts/performance-corrections/large-updates-{5a042d6515ee,0c79ee3e0e5c}.json. Earlier7476 and unfavorable intermediate Core runs remain separate under this round; no favorable-run substitution.

**Unresolved tail:** Firefox full-data update p95 is530ms (median325), versus376ms in one prior run and502ms in its repeated prior run. This does not justify a universal cold-update improvement. Prior GC profiles and the current coarse-provenance CPU profile retain evidence. The round reduces repeat-viewport work and allocation overhead but does not certify all full-data/GC tails resolved. Further improvement needs a separately tested allocation/ownership strategy; do not bypass input validation or silently simplify geometry. No old benchmark dataset or target was changed.

## Real Angular AOT application weight

All emitted application JS chunks, summed compression per file, same Angular22.2.3 runtime, production AOT/zoneless, actual installed archives and browser render. This is different from the standalone Web matrix below.

| Actual AOT app | Raw B | gzip B | Brotli B | Retained Charts modules |
| --- | --- | --- | --- | --- |
| baseline | 93234 | 31161 | 28079 | 0 |
| unused | 93234 | 31161 | 28079 | 0 |
| line | 704854 | 226342 | 186596 | 177 |
| cartesian | 356563 | 115503 | 100181 | 86 |

Cartesian vs generic full-app gzip reduction: 49%. Unused and baseline output hashes are identical, zero retained Charts modules. A strict-template negative consumer rejects Scatter data with TS2322. Metafile assertions reject radial/financial/graph/WordCloud/Scatter retention in the Cartesian consumer. Generic NeuralChart intentionally retains the full catalogue. This does not promise separate Line/Column engines or claim all generic retention solved.

## Memory

Chromium forced-GC retained heap/DOM check:50 warmup +3×100 cycles per dataset, each create→keyboard→zoom→paged table→SVG export→changed-data update→destroy. Local unchanged3MiB heap/20node/5listener thresholds are leak detectors, not approved product memory budgets or an RSS claim.

| Points | Retained heap growth B | Last 100-cycle growth B | DOM nodes | Listeners |
| --- | --- | --- | --- | --- |
| 2000 | 1735688 | 10340 | 11 → 11 | 14 → 14 |
| 5000 | 140108 | 6320 | 11 → 11 | 14 → 14 |

The2k run's first measured batch increases retained heap more than the earlier candidate, then approaches a plateau; that increase is preserved.5000-point run is independent. Neither implies Firefox/WebKit heap certification. Cross-engine listener/observer cleanup is separately covered by lifecycle tests.

## Automated evidence

- Core:1012 tests in87 files; complete npm run check package/public-consumer gates. Zero runtime dependencies, no DOM types,206 runtime modules,415 packaged files and28 README consumer modules. Log: /Users/pedromorenotrujillo/Documents/neural/.worktrees/charts-web-performance/work/performance-round-2-check-final-expanded.log.
- Web51, Angular5, showcase13 tests and production builds PASS. Logs: final-sync.log/final-angular-unit.log/final-showcase-unit.log/final-showcase-build.log.
- Packed SDK: 1812 cases (604×3 engines), pure/public types, resource gates and exports PASS; final-sdk/verification.json.
- Showcase: 3624 cases (604×2 integrations×3 engines), real SSR→hydration, SVG parity, navigation/updates and audit checks PASS; /Users/pedromorenotrujillo/Documents/neural-charts-showcase/artifacts/performance-round-2/browser/browser-results.json.
- Documentation: 2420 generated examples compile, including English/Spanish and both integrations; installed inherited Angular input declarations are resolved without relaxing requiredness.
- Lifecycle:100 single-chart +100 two-panel switches **per engine**, exact hydrated shell/SVG/path reuse, once-only outputs, no retained owning listeners/observers after removal, real touch and12 axe cases per engine. No simulated VoiceOver/NVDA.
- Configuration, narrow widths, light/dark/RTL, composed SVG/PNG headers/legend/patterns and cleanup PASS; configuration/results.json. Native visual alignment148 checks; showcase shell201 checks. Existing harnesses reused.
- Exact renderer preservation:24/24 comparisons, zero raster pixels or native geometry drift, original observations/CSV/identity/keyboard/controlled selection preserved; path-preservation/final/results.json.
- Integrity:26 frozen NC-01A sources,1544 historical PNGs and354 prior Web PNGs unchanged. PNG hash equality is automated preservation, **not inferred human approval**. Original Core checkouts remain at their original HEADs and clean. No symlinks/secret markers/diff whitespace defects in changed sources.

## Rejected experiments

Orthogonal segment compaction is **NOT SHIPPED**. Corrected same-position comparator reproduces10/24 raster failures:3 solid WebKit and7 dashed cases, maximum4017 changed pixels/channel delta218. Earlier13 apparent failures included comparator false positives; both receipts are retained. The exact production serializer was restored. Prototype/source/tarball/diffs remain under experiments and path-compaction. A generic for-in freezer attempt also regressed timings and was reverted. No hidden Canvas/WebGL renderer, approximate reduction or thresholds were introduced.

Two user-authorized agents provided independent checks: read-only Core review found empty-viewport allocation and borrowed-Proxy provenance edges, fixed and regressed by the primary; renderer verifier owned only its new harness/artifacts. Final primary-owned certification reran on the final archive. No external service received source.

## Reproduction commands

Use Node22 and the committed npm-pack archives with the existing package locks. Run npm run check in the isolated Core owner; npm test in Web; npm test and npm run build in Angular/showcase. The actual receipts above were generated serially with:

- Web: node tooling/profile-large-updates.mjs; node tooling/verify-update-performance.mjs; node tooling/verify-retained-memory.mjs (default2000, then NEURAL_MEMORY_POINTS=5000); node tooling/verify-path-compaction.mjs (production preservation default); node tooling/verify-configuration.mjs; node tooling/verify.mjs.
- Showcase on the owned SSR server: node tooling/measure-angular-consumer.mjs; node tooling/verify-documentation.mjs; node tooling/verify-lifecycle.mjs; node tooling/verify-native-alignment.mjs; node tooling/verify-showcase-shell.mjs; node tooling/verify-browser.mjs.
- Set NEURAL_REVIEW_ARTIFACTS to a **new** directory per rerun; the shell verifier uses NEURAL_SHELL_ARTIFACTS. Preserve existing measurements. Do not run CPU timings alongside builds or browser campaigns. The failed-selector receipt remains separate from the completed lifecycle rerun; no production fix was hidden in that test-only correction.
- The first long catalogue run hit a30s Firefox page-load timeout on ikh/parameters after2074 completed checks. The same exact navigation/interception passed3 consecutive vanilla/Angular pairs in249–544ms, unchanged30s timeout; root cause was not proven. Original failure and targeted reproduction receipts are preserved. The existing --resume mode verifies identical build hashes and exact completed prefix before retrying that uncompleted pair and finishing the remaining matrix. No timeout increase or suppressed assertion.

## Standalone import matrix

| Standalone import scenario | Raw B | gzip B | Brotli B |
| --- | --- | --- | --- |
| unused | 21 | 41 | 25 |
| factory | 558936 | 178668 | 144648 |
| line | 212764 | 68869 | 58976 |
| column | 212766 | 68869 | 59020 |
| bar | 212730 | 68839 | 59033 |
| cartesian | 212739 | 68859 | 58998 |
| line-column | 212814 | 68881 | 59025 |
| line-bar | 212926 | 68913 | 59036 |
| spline-area | 212739 | 68859 | 58998 |
| pie-donut-scatter | 558936 | 178668 | 144648 |
| full-api | 560277 | 179102 | 145178 |
| financial | 238207 | 77611 | 66407 |
| core-cartesian | 115300 | 36400 | 30999 |
| core-financial | 141324 | 45478 | 38769 |
| core-combined | 461040 | 146536 | 117332 |
| server-export | 513551 | 163221 | 131644 |

Raw/gzip/Brotli are actual bundled scenarios in final-sdk/verification.json, not per-module source sizes. Root-unused21B is the fixture's own output (no Charts code), and is not literally a21B library. The generic dispatcher/server-export still retains unrelated catalogue engines. No budget was relaxed: historical NC-01B30720B gzip and NC-01C6144B incremental targets remain pending, and these newer distribution scenarios must not be presented as the original frozen measurement. Showcase initial build warning remains **501.49kB vs500kB**, +1.49kB; already-lazy routes are not a new optimization. Human budget exceptions are not approved.

## Provenance, Git and continuation

**Additional publication gate requested during this round:** complete typed customization templates for tooltips/titles/axis labels/data labels/legends. Current options support style/configuration, but not a complete JavaScript renderer-port + Angular ng-template system. Do not claim that feature exists. It belongs to Web/Angular, not pure calculation Core, and requires real lifecycle/performance, SSR, accessible fallback and export tests. This scope is not certified by the optimization receipts and must be implemented before publication approval.

Core owner worktree /Users/pedromorenotrujillo/Documents/neural/.worktrees/charts-web-performance, branch codex/charts-web-performance; local commits9fa14bd,86346c6,ac64b21. Original Core and historical frozen worktrees untouched. Core candidate 0.0.24 is local/unpublished, owner HEAD ac64b2172a60665283cc5c3fa00ac21cbfcd3bd1, SHA256 ecb72b6c3e1906198051594c0630c41c6f8f25841bd2e69ccded058ae5834145. Final Web SHA256 46da5f51b9d887695a4e1f2453016c36beeb2b336799f2bd951aeca39da8d7d6; Angular archive e5dba6a6e37ed16d5ee21208a37fb12391d1d09d4bb7db907bb285ac8f8c0da7. Actual npm-pack archives are installed; no source aliases or node_modules patches.

Initial Web8ea0485f79442ce84de04e64d0bafff0634ea469, Angular e5f380ee8e0a5ec97ae3c3c26bd21e6de786aa04, showcase f43095c2d432c44f9b1483d9666bd91b2c661162. Local final commits/status are recorded after commit in artifacts/performance-round-2/git-state.json.10 untracked unused intermediate tarballs generated by this task were reversibly moved to checkpoint-archives with hashes; active and previously tracked vendor files remain.

Showcase: http://127.0.0.1:53620/charts/line/basic?framework=angular&lang=es . All evidence under artifacts/performance-round-2 in Web/showcase; earlier evidence remains. No push/tag/release/publish/deployment/ZIP. Human visual, VoiceOver/Safari, NVDA/Firefox and budget approvals stay PENDING. Next work should target generic dispatcher splitting and Firefox full-data allocation tails, using these exact receipts and preserving geometry/ownership; do not re-audit the catalogue from scratch or claim maximum performance.
