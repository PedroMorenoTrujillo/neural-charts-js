# Explicit stack-total label correction

Adds optional typed/validated appearance.stackLabels and prioritizes the existing Core total annotations during SVG label pruning. Core mathematics, coordinates and dependencies are unchanged. Omitting the option preserves previous dataLabels behavior. Explicit false suppresses totals.

23 pure tests PASS; 1797 packed-consumer browser cases PASS in Chromium/Firefox/WebKit; 100 resource cycles per browser. Packed archive SHA-256: afb2d319d96bf355eb948bdd0b72e03a2a2a60307923d7385f453ea6642a55a2. Real Angular/showcase consumers additionally verify all 13 total variants, the 599-variant regression baseline in both integrations, the current option-only recipe deltas and multi-owner cleanup.

Evidence: [packed verification](../artifacts/documentation-review/verification.json) and [showcase review](../../neural-charts-showcase/docs/SHOWCASE-CONTENT-EVIDENCE.json). Historical bundle exceptions and manual approvals remain pending. No Core/reference modification or publication.
