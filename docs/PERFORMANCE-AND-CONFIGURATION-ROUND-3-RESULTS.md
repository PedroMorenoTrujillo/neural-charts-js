# Round3 — measured performance, configuration and hardening

2026-11-04. **Scoped functional/package/browser gates PASS; V1 NOT CERTIFIED; release approval pending.** No push, tags, release, publication, deployment or review ZIP. Full custom templates and budget acceptance remain open. This report records actual fixes and measurements, not a claim of maximum possible performance.

## Package and ownership

- Web archive SHA256: ab95d8ed3d4586c67dd064d9b5e215278b97752756d9eb6553bced4a094a112e.
- Core0.0.24 candidate SHA256: ecb72b6c3e1906198051594c0630c41c6f8f25841bd2e69ccded058ae5834145. Owner worktree remains clean at ac64b2172a60665283cc5c3fa00ac21cbfcd3bd1; no Core production change ships in this round.
- Initial Web e54be9cfe345b4f197e5b16d8763ab3191bb22b8; Angular685dddeaa626d77f9b834094965f9020b666e9a3; showcase6976cf9ba082ba19b2f514d96863e071dd76b7c2. Post-commit identities/status are recorded in artifacts/performance-round-3/git-state.json.
- Core runtime/optional/peer dependency counts remain zero. Actual archives are installed in consumers; no source symlinks, engine dependency or framework dependency was added to Core. The Angular distribution reexports the presentation types; its chart runtime is unchanged.

## Implemented and corrected

Raw selection-ID indexing now runs only when a nonempty uncontrolled selection needs reconciliation. Empty and controlled selections avoid the offscreen-data scan and its Sets. Existing offscreen, hidden, reconstructed, missing and consumer-rejected selection semantics are covered by packed-browser tests. The nonempty uncontrolled case still scans the source; this report does not claim that scan was eliminated universally.

Added typed Intl units, currency display/accounting, literal prefix/suffix, regional formatting independent of built-in UI language, and reference color/dash/width by stable ID. Explicit axis formatting replaces global formatting. Same-style responsive patches inherit fields; an explicit style change starts a complete formatter. Both patch shape and effective options are validated. Unsupported regional locales fall back to UI language then English, with complete locale-list cache keys.

Percentage-stack primary ticks represent0–100 independently of raw currency/measurement values. Tooltips/data labels retain original-value formatting, while secondary axes retain their own format. Financial OHLC prices use the price formatter; volume remains a plain quantity, including zero and absence. Original data and CSV are unchanged.

Real review defects corrected: money/category ticks colliding with Y titles; long reference labels escaping the plot; X-edge and Bar-zero references needing the opposite text anchor; Firefox's one-pixel rotated-title clipping; reference text losing contrast over blue marks; falsy JSON referenceStyles reaching serialization; and WebKit native selects shrinking to23px despite min-height. Titles now reserve a measured outer margin, references wrap/clip with full accessible text and retain a background outline, invalid styles fail atomically, and lab selects measure44px with explicit height. No frozen foundation source changed.

## Executable bilingual lab

Open [Axes — reference configuration](http://127.0.0.1:53620/guide/axes?framework=angular&lang=en#section-3), then “Try interactive configuration”. JavaScript and Angular share the same data/options example. The lab loads on request and supports currency/accounting, temperature/speed, regional formats, precision, colors, fixed targets, a mean over visible/all original values, hide/update and responsive rules. It includes zero and gaps; a missing mean is never invented as zero. Its code panel shows complete input options, not a falsely resolved responsive snapshot.

options.locale changes built-in chart messages between en/es. Application titles, categories, series names, references and affixes remain application translations with stable IDs. formatting.locale independently selects number/date conventions. See [configuration contract](CONFIGURATION-AND-FORMATTING.md).

## Final evidence

| Gate | Actual result |
| --- | --- |
| Web unit/build |68 tests PASS |
| Angular unit |6 tests PASS |
| Showcase unit/build |16 tests PASS; budget warning remains |
| Packed SDK |604 recipes ×3 engines =1812 checks;604 positive type cases and3 negative controls; SSR import has0 browser-global reads |
| Formatting/selection/layout |2928 assertions;39 formats,39 layouts,15 normalized cases,90 atomic invalid updates,3 financial-volume cases;78 PNGs |
| New lab |120 checks;6 axe audits;12 candidate screenshots;320/375/430/768px, both integrations, English/Spanish and RTL |
| Configuration/export |3 engines;12 axe audits; currency/secondary axes, responsive restoration, patterns, PNG header ink and Blob cleanup |
| Exact path preservation |24 cases; zero changed pixels and native geometry differences; rejected compaction remains NO_SHIP |
| Compiled consumption documentation |2420 examples;0 TypeScript diagnostics |
| Documentation browser |703 checks, including24 accessibility pages |
| Angular lifecycle/SSR/hydration |3 engines;100 single-chart +100 two-panel switches per engine; actual SSR DOM reuse, exactly-once outputs, touch and36 axe cases |
| Final showcase regression |498 targeted checks across83 recipes, both integrations,3 engines; full current SDK coverage is separate |

Browser versions: Chromium153.0.8010.12, Firefox155 and WebKit26.6. Scoped axe passes are automated evidence, not VoiceOver/NVDA certification. The earlier full3624-case showcase campaign is historical; it is not represented as rerun here.

## Performance with50000 points

Apple M2 Pro/arm64, Node22.22.3; unchanged deterministic dataset,30 samples after3 warmups. Values are p50/p95 milliseconds for synchronous API plus forced layout. They are not paint/FPS. The final exact archive ran serially without QA contention. All raw samples and earlier candidates remain in artifacts/performance-round-3.

| Engine | Operation | Previous p50/p95 | Final p50/p95 |
| --- | --- | --- | --- |
| chromium | initial | 278.3 / 335.2 | 262.6 / 325.9 |
| chromium | changedData | 279.8 / 313.5 | 269 / 293.4 |
| chromium | zoom | 53.1 / 59.3 | 38.6 / 44.4 |
| chromium | pan | 50 / 59.1 | 37.3 / 51.2 |
| firefox | initial | 305 / 431 | 305 / 475 |
| firefox | changedData | 325 / 530 | 318 / 466 |
| firefox | zoom | 61 / 80 | 56 / 123 |
| firefox | pan | 62 / 74 | 51 / 76 |
| webkit | initial | 324 / 360 | 275 / 299 |
| webkit | changedData | 339 / 370 | 288 / 310 |
| webkit | zoom | 80 / 88 | 62 / 73 |
| webkit | pan | 78 / 87 | 59 / 67 |

Medians improve, but Firefox's final zoom p95 is123ms versus80ms in the historical checkpoint. This tail is explicitly unresolved as a stable maximum-performance guarantee. Investigation retained two complete earlier passes and four contemporaneous alternating Firefox runs: previous zoom63/105 and71/101 versus candidate57/78 and52/91; previous pan64/83 and66/101 versus candidate51/65 and51/69. Those pairs did not reproduce a consistent >20% candidate regression, while historical-tail variation remained. These are separate runs and archive hashes, not merged into a favorable synthetic result. Pure export timings near0–1ms have timer-quantization limits. Do not promise universal throughput or maximum FPS.

Two other optimization experiments did not show consistent gains and do not ship: extracting per-node Core ownership closures, and replacing exact SVG map/join string construction. Their rejected patch, before/after data and scripts are preserved in experiments/. No approximation, Canvas chart renderer or silent geometry reduction was introduced.

## Memory and cleanup

Packed SDK100 create/destroy cycles per engine and formatting30 extra cycles retain0 owned observers/rAF/Blob URLs/late outputs in their detectors. Angular lifecycle separately verifies its single/two-panel resources. These results are scoped to each harness, not a whole-process zero-memory claim.

The Chromium forced-GC test uses50 warmup +3×100 measured create/keyboard/zoom/table/export/update/destroy cycles.2000 points passes.5000 points initially exceeded the unchanged3MiB local heap threshold, but the old harness asserted before writing numeric results. That failure log is preserved. The harness now saves measurements before assertions without changing the scenario or thresholds. Two separate repeats pass with1,190,668 and1,188,728 bytes growth,11 DOM nodes and14 page listeners unchanged. The initial failure's cause remains unproven; it has not been relabeled as a successful measurement. The local threshold is not an approved product memory budget, and this is not Firefox/WebKit heap or RSS certification.

## Bundles — bytes, no budget waiver

Standalone esbuild/minified ESM from installed archives:

| Import scenario | Raw | Gzip | Brotli |
| --- | ---: | ---: | ---: |
| unused | 21 | 41 | 25 |
| factory | 562445 | 179639 | 145638 |
| line | 216323 | 69809 | 59913 |
| column | 216325 | 69809 | 59908 |
| bar | 216289 | 69781 | 59839 |
| cartesian | 216298 | 69799 | 59848 |
| line-column | 216373 | 69814 | 59988 |
| line-bar | 216485 | 69864 | 59929 |
| spline-area | 216298 | 69799 | 59848 |
| pie-donut-scatter | 562445 | 179639 | 145638 |
| full-api | 563786 | 180127 | 146070 |
| financial | 241785 | 78593 | 67409 |
| core-cartesian | 115300 | 36400 | 30999 |
| core-financial | 141324 | 45478 | 38769 |
| core-combined | 461040 | 146536 | 117332 |
| server-export | 517089 | 164200 | 132433 |

Line gzip increases from68869 to69809bytes (+940) with this configuration/hardening work. Generic factory increases from178668 to179639bytes. Core-only numbers remain unchanged. The Cartesian entry excludes unrelated financial/radial/network/text engines; it does not promise one tiny engine per public chart function. Root-unused is21bytes of marker code, with no chart retention.

Actual complete minimal Angular AOT application JavaScript, summed compression per emitted file (includes Angular runtime):

| Scenario | Raw | Gzip | Brotli |
| --- | ---: | ---: | ---: |
| baseline | 93234 | 31161 | 28079 |
| unused | 93234 | 31161 | 28079 |
| line | 708367 | 227299 | 187479 |
| cartesian | 360142 | 116513 | 101141 |

Baseline and unused are byte-identical. Generic NeuralChart with Line data retains the full factory; NeuralCartesianChart uses the granular Cartesian surface. These are different consumer scenarios and are not compared as identical imports. The wrong-family Cartesian type control fails as intended.

The showcase initial bundle remains about504.04kB against500kB, warning visible. Historical NC-01B30720-byte gzip and NC-01C exploratory6144-byte incremental targets have not been waived or silently changed; those historical gates are not declared met by comparing a different current V1 import. Full bundle acceptance remains pending.

## Protected visuals and scope

All26 frozen files match a96c2ce2576c77221a52b806453a73f2bee0b64f. All1544 protected historical PNGs and all354 original Web baseline files retain their hashes.348 current Web captures are byte-identical. Six current Bullet/VBP captures differ only in the left axis margin: the Y title no longer collides with labels, and long price-category labels reserve title space while retaining full accessible text. Pixel-diff bounds remain left of148px; marks and plot pixels are unchanged. [Before/after/diffs](../artifacts/performance-round-3/visual-changes/index.html) retain each original separately. Technical review PASS does not attribute human approval.

The original Core checkout, earlier Core worktree, Neural UI, Native and iCloud sources were not edited. Ten task-generated intermediate archives are reversibly retained in checkpoint-archives/; active installed archives remain in vendor. No accepted baseline was regenerated.

## Remaining publication gates and next operation

Full typed custom content ports/templates for tooltip, title, axis/data labels and legend remain unimplemented and are a publication gate. Text prefixes/suffixes are not rich templates. Budget acceptance, human review of candidate captures, manual VoiceOver/Safari and NVDA/Firefox, and publication authorization remain pending. Firefox tails and the initial non-reproduced memory detector failure remain visible limitations. V1 must not be declared TECHNICAL PASS or RELEASE APPROVED on this report alone.

Next implementation: typed custom content with coherent ownership, keyboard/a11y, SSR and export behavior; then final budgets and human review. Existing functional chart catalogue is not multiplied by JavaScript/Angular integration counts. No new family was invented in this round.

Commands used: npm test in each repo; sync-local-consumers.mjs; profile-large-updates.mjs; verify-formatting-selection.mjs; verify.mjs; verify-update-performance.mjs; verify-retained-memory.mjs (2000/5000); verify-path-compaction.mjs; measure-angular-consumer.mjs; verify-configuration.mjs; verify-configuration-lab.mjs; verify-documentation.mjs; verify-documentation-browser.mjs; verify-lifecycle.mjs; targeted verify-browser.mjs. Exact paths, hashes and checkpoint completion are recorded in artifacts/performance-round-3/certification.json and qa.json.
