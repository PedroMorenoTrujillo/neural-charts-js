import type { ChartType } from './types.js';
import { isFinancialFamily } from './financial-family.js';

const gaps = ['groupGap', 'barGap', 'maxBarWidth'] as const;
/** Transport of approved presentation fields into the public Core seam, not geometry. */
export const rootLayoutKeys = Object.freeze({
  column: [...gaps, 'orientation'], lollipop: [...gaps, 'markerRadius'], dumbbell: [...gaps, 'markerRadius'],
  columnpyramid: [...gaps, 'markerRadius'], columnrange: gaps, arearange: gaps, areasplinerange: gaps,
  boxplot: [...gaps, 'whiskerWidth', 'capWidth'], errorbar: [...gaps, 'whiskerWidth', 'capWidth'],
  mixed: gaps, waterfall: ['groupGap', 'maxBarWidth'],
  violin: ['bandwidth', 'resolution', 'normalization', 'gapRatio'], flame: ['rowPadding'],
  dendrogram: ['orientation'], parallel: ['coordinates'], windrose: ['stacking', 'gapRatio'],
  radialbar: ['gapRatio', 'innerRadiusRatio'], heatmap: ['gapRatio', 'opacity'],
  venn: ['padding'], wordcloud: ['minFontSize', 'maxFontSize', 'padding', 'rotations', 'seed', 'maxWords'],
  tilemap: ['tileShape', 'pointPadding', 'opacity'], dependencywheel: ['startAngle', 'nodePadding', 'nodeWidth'],
  chord: ['startAngle', 'nodePadding', 'nodeWidth'], arcdiagram: ['reversed', 'nodeRadius', 'linkWidth'],
  bullet: ['orientation', 'pointPadding', 'bands'], variwide: ['pointPadding'],
  xrange: ['grouping', 'rowPadding'], timeline: ['labelPosition', 'labelMaxWidth', 'markerRadius'],
  sankey: ['orientation', 'nodeWidth', 'nodePadding'], packedbubble: ['splitSeries'],
  variablepie: ['minRadiusRatio', 'radiusScale'], item: ['columns'], histogram: ['binCount'],
  bellcurve: ['intervals', 'standardDeviations'], funnel: ['neckWidth', 'neckHeight', 'reversed'],
  pyramid: ['reversed'], donut: ['holeRatio'], gauge: ['preset'], polar: ['radiusScale'],
} as const satisfies Partial<Record<ChartType, readonly string[]>>);

export const layoutKeysFor = (type: ChartType): readonly string[] => isFinancialFamily(type) ? ['parameters'] : rootLayoutKeys[type as keyof typeof rootLayoutKeys] ?? [];
const stacking = ['stacking'];
const angles = ['startAngle', 'endAngle'];
/** Layout keys translated into nested planner options instead of forwarded to the spec. */
const translatedKeys: Partial<Record<ChartType, readonly string[]>> = {
  column: [...stacking, 'stackGroups'], area: stacking, areaspline: stacking, mixed: stacking,
  pie: angles, donut: angles, gauge: [...angles, 'style', 'tickCount'],
  pictorial: [...stacking, 'shape', 'gap', 'background'], contour: ['levels', 'segmentBudget'],
};
export const translatedLayoutKeysFor = (type: ChartType): readonly string[] => translatedKeys[type] ?? [];
export const allLayoutKeys = Object.freeze([...new Set([...Object.values(rootLayoutKeys).flat(), ...Object.values(translatedKeys).flat(), 'parameters'])]);
