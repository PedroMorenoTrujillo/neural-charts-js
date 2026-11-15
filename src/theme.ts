import type { ChartOptions } from './types.js';

export interface ChartTheme { readonly background?: string; readonly foreground?: string; readonly muted?: string; readonly grid?: string; readonly focus?: string; }
export function themeTokens(options: ChartOptions) {
  const dark = options.theme === 'dark';
  return { background: dark ? '#111c2d' : '#ffffff', foreground: dark ? '#e5edf7' : '#26364b', muted: dark ? '#acbbce' : '#53647a', grid: dark ? '#344359' : '#e0e7f0', focus: '#2563eb', ...options.themeTokens };
}
