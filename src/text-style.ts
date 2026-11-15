import type { ChartTextStyle } from './types.js';

export const systemFontFamily = 'system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';

export function headingStyle(style: ChartTextStyle | undefined, description = false) {
  const fontSize = style?.fontSize ?? (description ? 13 : 18);
  return {
    align: style?.align,
    color: style?.color,
    fontSize,
    fontWeight: style?.fontWeight ?? (description ? 400 : 600),
    lineHeight: Math.ceil(fontSize * (description ? 1.5 : 1.4)),
  };
}
