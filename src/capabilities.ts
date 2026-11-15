/** Generated from the sealed Native baseline and public financial capabilities. */
import { financialFamilies } from '@neural-charts/core/financial';
import { isFinancialFamily } from './financial-family.js';

const groups = [
  {"axes":"cartesian","viewport":"any","measured":true},
  {"axes":"cartesian","viewport":"x","measured":true},
  {"axes":"cartesian","viewport":false,"measured":true},
  {"axes":"hierarchy","viewport":false,"measured":true},
  {"axes":"parallel","viewport":false,"measured":true},
  {"axes":"none","viewport":false,"measured":true},
  {"axes":"cartesian","viewport":"y","measured":true},
  {"axes":"cartesian","viewport":"any","measured":false},
  {"axes":"cartesian","viewport":false,"measured":false},
  {"axes":"cartesian","viewport":"x","measured":false},
  {"axes":"none","viewport":false,"measured":false},
  {"axes":"none","viewport":"xy","measured":true},
  {"axes":"none","viewport":"any","measured":true},
  {"axes":"radial","viewport":false,"measured":true},
] as const;

const families = {
  "fan": 0,
  "regression": 0,
  "flame": 1,
  "violin": 2,
  "dendrogram": 3,
  "parallel": 4,
  "heatmap": 2,
  "venn": 5,
  "wordcloud": 5,
  "pictorial": 2,
  "tilemap": 5,
  "contour": 0,
  "dependencywheel": 5,
  "arcdiagram": 5,
  "chord": 5,
  "bullet": 2,
  "variwide": 6,
  "xrange": 1,
  "timeline": 1,
  "vector": 0,
  "windbarb": 0,
  "line": 7,
  "column": 7,
  "bar": 7,
  "area": 7,
  "spline": 7,
  "areaspline": 7,
  "streamgraph": 7,
  "arearange": 7,
  "areasplinerange": 7,
  "columnrange": 7,
  "boxplot": 7,
  "errorbar": 7,
  "mixed": 7,
  "waterfall": 7,
  "lollipop": 0,
  "dumbbell": 0,
  "columnpyramid": 0,
  "scatter": 0,
  "bubble": 0,
  "polygon": 0,
  "histogram": 8,
  "bellcurve": 8,
  "pareto": 9,
  "pie": 10,
  "donut": 10,
  "gauge": 10,
  "variablepie": 5,
  "item": 5,
  "treemap": 5,
  "sunburst": 5,
  "funnel": 5,
  "pyramid": 5,
  "sankey": 11,
  "treegraph": 12,
  "organization": 12,
  "networkgraph": 12,
  "packedbubble": 11,
  "radar": 13,
  "polar": 13,
  "windrose": 13,
  "radialbar": 5,
} as const;
const cartesianGroups: readonly number[] = [0,1,2,6,7,8,9];
type FamilyGroups = typeof families;
type CapabilityMap = { readonly [K in keyof FamilyGroups]: (typeof groups)[FamilyGroups[K]] };

function copyCapabilities(): CapabilityMap {
  return Object.fromEntries(Object.entries(families).map(([family, group]) => [family, {...groups[group]}])) as CapabilityMap;
}

const financialCapability = {axes: "cartesian", viewport: "xy"} as const;
function publicCapabilities() {
  const finance = Object.fromEntries(financialFamilies.map(family => [family, {...financialCapability}])) as
    Readonly<Record<(typeof financialFamilies)[number], typeof financialCapability>>;
  return {...copyCapabilities(), ...finance} as const;
}
export const chartCapabilities = /* @__PURE__ */ publicCapabilities();

export function isCartesianFamily(family: string): boolean {
  return (Object.hasOwn(families, family) && cartesianGroups.includes(families[family as keyof FamilyGroups])) || isFinancialFamily(family);
}

export function isSupportedChartType(type: unknown): type is Exclude<keyof typeof chartCapabilities, 'bar'> {
  return typeof type === 'string' && type !== 'bar' && (Object.hasOwn(families, type) || isFinancialFamily(type));
}
