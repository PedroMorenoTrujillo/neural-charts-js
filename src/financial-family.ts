import { financialFamilies } from '@neural-charts/core/financial';

const familySet = /* @__PURE__ */ new Set<string>(financialFamilies);

export function isFinancialFamily(family: string): boolean {
  return familySet.has(family);
}
