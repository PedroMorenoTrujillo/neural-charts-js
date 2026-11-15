import type {ChartOptions,ChartAxisOptions} from './types.js';
// A different explicit style starts a complete formatter. Currency/unit fields
// from the old style must never leak into the replacement.
function mergeAxis(base: ChartAxisOptions | undefined, patch: ChartAxisOptions): ChartAxisOptions {
  const axis = {...base, ...patch};
  if (patch.labels) axis.labels = {...base?.labels, ...patch.labels};
  if (patch.numberFormat) {
    const replace = patch.numberFormat.style !== undefined && patch.numberFormat.style !== (base?.numberFormat?.style ?? 'decimal');
    axis.numberFormat = {...(replace ? undefined : base?.numberFormat), ...patch.numberFormat};
  }
  return axis;
}

/** Validated options only. Never measures DOM or modifies the base configuration. */
export function resolveResponsive(base: ChartOptions, containerWidth: number): ChartOptions {
  if (!base.responsive?.length) return base;
  const {responsive, ...initial} = base;
  let result: ChartOptions = initial;
  for (const rule of responsive) {
    if (containerWidth < (rule.minWidth ?? 0) || containerWidth > (rule.maxWidth ?? Infinity)) continue;
    const patch = rule.options;
    const next = {...result, ...patch};
    for (const key of ['appearance', 'legend', 'tooltip'] as const) {
      if (patch[key]) (next as Record<string, unknown>)[key] = {...result[key], ...patch[key]};
    }
    if (patch.axes) {
      const axes = {...result.axes, ...patch.axes};
      for (const key of ['x', 'y', 'secondaryY'] as const) {
        const axis = patch.axes[key];
        if (axis) axes[key] = mergeAxis(result.axes?.[key], axis);
      }
      next.axes = axes;
    }
    result = next;
  }
  return result;
}
