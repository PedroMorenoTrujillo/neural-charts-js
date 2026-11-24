/** Keep compact render-time capabilities and the public catalogue in sync. */
export function capabilitySource(capabilities, financialFamilies = []) {
  const groups = new Map();
  const finance = new Set(financialFamilies);
  const families = Object.entries(capabilities).filter(([family]) => !finance.has(family)).map(([family, capability]) => {
    const key = JSON.stringify(capability);
    if (!groups.has(key)) groups.set(key, groups.size);
    return [family, groups.get(key)];
  });
  const financialSource = financialFamilies.length ? [
    "import { financialFamilies } from '@neural-charts/core/financial';",
    "import { isFinancialFamily } from './financial-family.js';",
    '',
  ] : [];
  if (financialFamilies.length) {
    if (!financialFamilies.every(family => capabilities[family]?.axes === 'cartesian' && capabilities[family]?.viewport === 'xy' &&
        Object.keys(capabilities[family]).length === 2)) {
      throw Error('Financial capabilities no longer share a single layout');
    }
  }
  const groupValues = [...groups.keys()].map(value => '  ' + value + ',');
  const cartesianGroups = [...groups].filter(([value]) => JSON.parse(value).axes === 'cartesian').map(([, group]) => group);
  const groupForFamily = families.map(([family, group]) => '  ' + JSON.stringify(family) + ': ' + group + ',');
  const publicCapabilities = financialFamilies.length ? [
    'const financialCapability = {axes: "cartesian", viewport: "xy"} as const;',
    'function publicCapabilities() {',
    '  const finance = Object.fromEntries(financialFamilies.map(family => [family, {...financialCapability}])) as',
    '    Readonly<Record<(typeof financialFamilies)[number], typeof financialCapability>>;',
    '  return {...copyCapabilities(), ...finance} as const;',
    '}',
    'export const chartCapabilities = /* @__PURE__ */ publicCapabilities();',
  ] : ['export const chartCapabilities = /* @__PURE__ */ copyCapabilities();'];
  const financialFallback = financialFamilies.length ? ' || isFinancialFamily(family)' : '';
  const financialType = financialFamilies.length ? ' || isFinancialFamily(type)' : '';
  return ['/** Generated from the sealed Native baseline and public financial capabilities. */',
    ...financialSource, 'const groups = [', ...groupValues, '] as const;', '',
    'const families = {', ...groupForFamily, '} as const;',
    'const cartesianGroups: readonly number[] = ' + JSON.stringify(cartesianGroups) + ';',
    'type FamilyGroups = typeof families;',
    'type CapabilityMap = { readonly [K in keyof FamilyGroups]: (typeof groups)[FamilyGroups[K]] };', '',
    'function copyCapabilities(): CapabilityMap {',
    '  return Object.fromEntries(Object.entries(families).map(([family, group]) => [family, {...groups[group]}])) as CapabilityMap;',
    '}', '',
    ...publicCapabilities, '',
    'export function isCartesianFamily(family: string): boolean {',
    "  return (Object.hasOwn(families, family) && cartesianGroups.includes(families[family as keyof FamilyGroups]))" + financialFallback + ';',
    '}', '',
    "export function isSupportedChartType(type: unknown): type is Exclude<keyof typeof chartCapabilities, 'bar'> {",
    "  return typeof type === 'string' && type !== 'bar' && (Object.hasOwn(families, type)" + financialType + ');',
    '}', ''].join('\n');
}
