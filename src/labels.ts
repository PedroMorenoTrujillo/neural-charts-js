/** Real SVG glyph bounds, with a uniform spatial index. Hidden labels remain in original data tables. */
export function pruneLabels(svg: SVGElement, gap = 4): void {
  const grid = new Map<string, DOMRect[]>(), cell = 64;
  const labels=Array.from(svg.querySelectorAll<SVGGElement>('[data-label]'));
  const ordered=[...labels.filter(label=>label.dataset.labelPriority==='stack'),...labels.filter(label=>label.dataset.labelPriority!=='stack')];
  for (const label of ordered) {
    const bounds = label.getBBox(), rect = new DOMRect(bounds.x - gap, bounds.y - gap, bounds.width + gap * 2, bounds.height + gap * 2);
    if (rect.width <= 0 || rect.height <= 0) continue;
    const x0 = Math.floor(rect.x / cell), x1 = Math.floor(rect.right / cell), y0 = Math.floor(rect.y / cell), y1 = Math.floor(rect.bottom / cell);
    let collision = false;
    for (let x = x0; x <= x1 && !collision; x++) for (let y = y0; y <= y1 && !collision; y++) for (const other of grid.get(x + ':' + y) ?? []) if (rect.x < other.right && rect.right > other.x && rect.y < other.bottom && rect.bottom > other.y) { collision = true; break; }
    if (collision) { label.setAttribute('visibility', 'hidden'); label.setAttribute('aria-hidden', 'true'); }
    else for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const key = x + ':' + y, values = grid.get(key) ?? []; values.push(rect); grid.set(key, values); }
  }
}
