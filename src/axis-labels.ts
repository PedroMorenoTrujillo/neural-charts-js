/** A deterministic text-content budget, not a claim about measured font metrics.
 * Full labels remain in SVG titles and the original-data table. */
export function axisLabelLines(label: string, limit: number, maximumLines: number): readonly string[] {
  const units = (text: string) => Array.from(text).reduce((sum, character) => sum + (/[MWmw@\u2e80-\u9fff\uac00-\ud7af]/u.test(character) || character.codePointAt(0)! > 0xffff ? 2 : 1), 0);
  const trim = (text: string, budget: number) => { let result = ''; for (const character of text) { if (units(result + character) > budget) break; result += character; } return result; };
  const words = label.trim().split(/\s+/u), lines: string[] = []; let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (units(next) <= limit) { line = next; continue; }
    if (line) lines.push(line);
    line = units(word) > limit ? trim(word, limit - 1) + '…' : word;
  }
  if (line || !lines.length) lines.push(line);
  if (lines.length > maximumLines) { const remaining = lines.slice(maximumLines - 1).join(' '); lines.length = maximumLines; lines[maximumLines - 1] = trim(remaining, limit - 1).replace(/…$/, '') + '…'; }
  return lines;
}
export function axisLabelIndices(count: number, budget: number): ReadonlySet<number> {
  let visible = Math.min(count, Math.max(2, Math.floor(budget)));
  while (visible > 2 && (count - 1) % (visible - 1) !== 0) visible--;
  const indices = new Set<number>();
  for (let i = 0; i < visible; i++) indices.add(visible === 1 ? 0 : Math.round(i * (count - 1) / (visible - 1)));
  return indices;
}
