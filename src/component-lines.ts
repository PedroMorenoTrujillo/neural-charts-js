import type {PlanFrame} from '@neural-charts/core';

const ichimokuLines: Readonly<Record<string, string>> = {
  conversion: '',
  base: '8 3',
  spanA: '4 2',
  spanB: '1 3',
  lagging: '9 3 1 3',
};

export function componentDash(family: string, key: string): string | undefined {
  return family === 'ikh' && Object.hasOwn(ichimokuLines, key) ? ichimokuLines[key] : undefined;
}

export function visibleComponentLines(frame: PlanFrame): readonly string[] {
  if (frame.family !== 'ikh') return [];
  const drawn = new Set(frame.series.flatMap(series => (series.parts ?? [])
    .filter(part => !part.fill && part.commands?.length)
    .map(part => part.key)));
  return Object.keys(ichimokuLines).filter(key => drawn.has(key));
}
