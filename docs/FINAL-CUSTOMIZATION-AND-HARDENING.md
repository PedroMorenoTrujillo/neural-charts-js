# Custom content and final runtime hardening —2026-11-04

**Implementation and the 20 scoped automated gates PASS. V1 budget approval is still pending; release approval is not inferred.** This report supersedes earlier entries that listed typed templates or the500kB showcase warning as still open. The catalogue remains30 principal analytical families,71 base representations and47 financial indicators,604 unique executable recipes. JavaScript and Angular do not multiply the inventory. No new chart family, dependency, mathematical engine, deployment or ZIP was introduced.

## Implemented

Web provides independent typed text/render capabilities for title, tooltip, legend, axis labels and data labels. Plain data/options remain serializable and readonly. Canonical text feeds accessible names, announcements, SSR, SVG and PNG; browser-only renderers enhance it with owned AbortSignal/cleanup. Angular provides all five typed projected TemplateRef directives, without copying geometry. The optional Cartesian adapter remains granular. Full contract and compiling examples: [CUSTOM-CONTENT.md](CUSTOM-CONTENT.md), also included in the actual Web archive.

Descriptor validation rejects getters, symbols, malformed and falsy capability objects without invoking getters. Angular validates before composing template slots; malformed initial SSR titles safely fall back and serializers still report invalid content. Invalid updates preserve the last valid chart. Recursive update/export attempts are rejected, destroy during an in-flight render is safe, and every acquired embedded view is destroyed exactly once. Interactive controls inside presentational slots and non-SVG content inside label slots are rejected. Browser HTML/CSS is not promised as a pixel-identical SVG export: the canonical text is the portable representation.

Additional real fixes: avoid building synchronization lookup indices when no synchronization exists; clear retained custom views and destroyed DOM/callbacks; register snapshot provenance per validated root instead of every datum; cache the unchanged stylesheet once per Document/ShadowRoot and recover it after scope migration; share one live reduced-motion query per Window without listeners. Validation still traverses and charges every current node/depth; frozen borrowed fragments never bypass limits. No26-file foundation or Core production source changed.

The custom showcase uses compact mobile axis formatting, fewer labels and full-precision original tooltip values. Explicit compact numeric axes recover plot space only under the tested short-format contract; wide currency/unit names and titled axes retain their original margin. Original categories, data table and CSV remain complete. The catalogue counter now separates71 representations from47 financial indicators instead of calling its118 internal records separate families.

An expanded regression discovered that a composed export background rectangle overrode explicit PNG backgrounds. SVG now marks its own background paint; the rasterizer replaces only that paint and nested SVG background CSS for an explicit override. Custom and transparent pixels pass in chart and plot compositions in all3 engines. Unmarked SVG rectangles, data marks and patterns keep their fills. Default SVG/PNG appearance is preserved.

## Actual final verification

| Gate | Result |
| --- | --- |
| Pure units/build | Core 1012; Web 80; Angular 10; showcase 16 PASS |
| Installed-archive SDK |1812 actual recipe/browser checks;604 positive type fixtures and3 negative controls;100 create/destroy cycles per engine |
| Typed content and ShadowRoot |33 cases,2622 per-case assertions +153 cleanup checks,3 engines;5 positive/5 negative typed-slot controls; actual Node SSR with0 browser renderer calls |
| Real Angular/JavaScript custom page |12 bilingual/RTL cases;5 slots; actual SSR DOM reuse, exactly-once outputs, responsive, updates, restore and teardown;36 actual SVG/PNG/CSV downloads;12 axe audits |
| Advanced browser |3 engines; PNG RGBA/transparent pixels and unowned-rect preservation, abort/destroy, real animation and live reduced motion, controlled selection, synchronization, wheel/drag/pending-gesture cleanup; physical pinch tested only in Chromium |
| Configuration/formatting | Actual unit/currency/reference/layout/normalized/raw-value and invalid-update regression,3 engines; receipts retain individual assertions and captures |
| Package/Angular AOT | Actual minimal applications baseline,unused,generic,Cartesian and all5 content templates; wrong-family and wrong-template-context builds fail as intended |
| Documentation |2421 compiled public-import consumption examples,0 diagnostics;703 actual browser checks |
| Angular lifecycle |3 engines;100 single-chart and100 two-panel switches per engine; SSR SVG/path DOM reuse, touch, exactly-once outputs, resource and automated a11y checks |
| Showcase targeted regression |498 current checks; earlier full3624 showcase campaign remains historical, not relabeled as rerun |
| Exact path preservation |24 same-geometry/raster cases;0 changed pixels; approximation remains excluded |
| Frozen/source/visual protection |26 frozen sources,1544 historical PNGs,354 original Web baselines unchanged; all354 new default captures identical to the last technical candidate |

Browsers: Chromium,Firefox,WebKit from the existing pinned harness. Automated axe checks are not manual VoiceOver/NVDA certification. New custom screenshots are technical review candidates, not human approvals.

## Memory evidence and limits

The exact final package completed50 warmups plus600 measured5000-point create/keyboard/zoom/table/export/update/destroy cycles with double forced GC and saved before/after snapshots. Final heap growth:161676B; last200 cycles:14224B. DOM-node delta and listener delta are both0. No objects/closures/string growth was found in the snapshot category comparison. All raw results and snapshots remain local.

The reproduced b8 candidate grew1,211,552B. Its per-datum WeakSet backing grew1,048,596→2,097,172B despite no live datum retention. Root-level provenance removed that capacity growth; an intermediate post-fix snapshot demonstrated a stable1,044B backing. Final unchanged canonical2000/5000-point detector runs also pass without changing their3MiB/20-node/5-listener local thresholds. These local detectors are not an approved product heap budget or a proof of zero whole-process growth.

The final snapshot still records600 additional native MediaQuerySet objects. Its cause remains unproven, separate from the demonstrated WeakSet fix. Animation is disabled in this fixture, so the preventive reduced-motion cache is not falsely credited with explaining it. The stylesheet is intentionally bounded per Document/ShadowRoot lifetime. Historical failed runs, native-focus WebKit control and all earlier candidates remain preserved; none was converted into PASS. WebKit native Tab skips buttons in the control page too; its passing focus test uses its actual Alt+Tab policy and keeps focus-visible/outline assertions.

## Performance —50000 points

Unchanged deterministic dataset,30 samples after3 warmups, exact archive, serial run without build/browser contention. p50/p95 milliseconds measure synchronous API plus forced layout, not paint or sustained FPS. Previous column is the last committed round3 archiveab95; all samples remain in the receipts. Values are measurements, not universal maximum-throughput promises.

| Engine | Operation | Previous p50/p95 | Final p50/p95 | p95 change |
| --- | --- | --- | --- | --- |
| chromium | initial | 262.6 / 325.9 | 245.5 / 295.5 | -9.33% |
| chromium | changedData | 269 / 293.4 | 250.6 / 265.4 | -9.54% |
| chromium | zoom | 38.6 / 44.4 | 37.2 / 40.8 | -8.11% |
| chromium | pan | 37.3 / 51.2 | 34.1 / 38.7 | -24.41% |
| firefox | initial | 305 / 475 | 248 / 353 | -25.68% |
| firefox | changedData | 318 / 466 | 251 / 374 | -19.74% |
| firefox | zoom | 56 / 123 | 44 / 72 | -41.46% |
| firefox | pan | 51 / 76 | 42 / 59 | -22.37% |
| webkit | initial | 275 / 299 | 274 / 317 | 6.02% |
| webkit | changedData | 288 / 310 | 273 / 317 | 2.26% |
| webkit | zoom | 62 / 73 | 60 / 68 | -6.85% |
| webkit | pan | 59 / 67 | 59 / 69 | 2.99% |

## Distribution and budgets

Web archive SHA256:6532526d3a0d029b96d7d10df8ab7d378ed34adf55ed2195b8478937819331c8. Shared Core candidate SHA256:ecb72b6c3e1906198051594c0630c41c6f8f25841bd2e69ccded058ae5834145, ownerac64b2172a60665283cc5c3fa00ac21cbfcd3bd1 unchanged. Core runtime/optional/peer dependencies remain0. Web depends only on Core; Angular APF depends only on Web with the two necessary Angular peers. Tools/development dependencies did not become engine dependencies. All consumers install actual hashed local archives, without source aliases or patched node_modules.

Standalone minified ESM, raw/gzip/Brotli bytes:

| Import | Raw | Gzip | Brotli |
| --- | ---: | ---: | ---: |
| unused | 21 | 41 | 25 |
| factory | 571688 | 182780 | 148247 |
| line | 225281 | 72884 | 62533 |
| column | 225283 | 72883 | 62434 |
| bar | 225247 | 72855 | 62436 |
| cartesian | 225256 | 72873 | 62546 |
| line-column | 225331 | 72896 | 62476 |
| line-bar | 225443 | 72941 | 62566 |
| spline-area | 225256 | 72873 | 62546 |
| pie-donut-scatter | 571688 | 182780 | 148247 |
| full-api | 573664 | 183356 | 148762 |
| financial | 250788 | 81644 | 69950 |
| core-cartesian | 115300 | 36400 | 30999 |
| core-financial | 141324 | 45478 | 38769 |
| core-combined | 461040 | 146536 | 117332 |
| server-export | 521166 | 165399 | 133533 |

Complete minimal Angular AOT application JavaScript, compression summed per emitted file, including Angular runtime:

| Application | Raw | Gzip | Brotli |
| --- | ---: | ---: | ---: |
| baseline | 93234 | 31161 | 28079 |
| unused | 93234 | 31161 | 28079 |
| line | 721538 | 231296 | 190904 |
| cartesian | 373036 | 120599 | 104426 |
| content | 373992 | 120810 | 104714 |

Root-unused has no chart retention. Generic Angular intentionally retains the full factory; the Cartesian adapter excludes unrelated radial/financial/network engines. A Line factory still shares the Cartesian module: no unmeasured per-series tree-shaking claim or artificial tiny-bundle scenario is made.

**Showcase initial:484.68kB against500kB PASS**, no threshold change. Eager navigation retains only metadata it uses;20,579B of family usage prose now loads with the already lazy example page, preserving its content. Historical NC-01B30,720B gzip target and NC-01C exploratory6,144B incremental target remain unwaived. Their last historical measurements were33,792B and9,556B respectively; the current broad V1 imports above are different scenarios and do not silently pass those gates. Current package-budget acceptance remains pending.

## Review and Git

Open [custom content — Angular](http://127.0.0.1:53620/custom-content?framework=angular&lang=es), [custom content — JavaScript](http://127.0.0.1:53620/custom-content?framework=vanilla&lang=es), or [catalogue](http://127.0.0.1:53620/charts?framework=angular&lang=es). The showcase remains local. Candidate screenshots/downloads/manifests live under showcase artifacts/final-customization; new Web content images and snapshots under Web artifacts/content-final. The previous six axis-margin before/after/diffs remain in artifacts/performance-round-3/visual-changes; all protected originals remain unchanged.

Starting HEADs: Web4ba8e369a080a11566372dc2cbba9ceaf91c5930; Angular3e0ce91f6bca04038b01682db5f98e8d6170b5a1; showcasea40508dd703256361c745c3cc68f769f28c6fa4c. Final local commits/status are recorded after committing in artifacts/final-customization/qa-complete/git-state.json. The original Core checkouts, historical project, Native, Neural UI and iCloud sources were not modified. Only tested task-owned changes are committed. No push, tags, release, npm publication, deployment or ZIP.

Remaining approval gates: human visual review, manual VoiceOver/Safari and NVDA/Firefox, explicit import-budget decisions and release/publication authorization. The implemented customization is no longer a pending feature. Global V1 TECHNICAL PASS and release approval are not declared while those gates remain open.
