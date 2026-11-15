import type {ChartNumberFormat,ChartOptions} from './types.js';
const formatters = new Map<string, Intl.NumberFormat>();
const dates = new Map<string, Intl.DateTimeFormat>();
// Unsupported requested locales fall back to the UI locale, then English,
// never to an implicit server/machine locale. The complete list keys the cache.
const formatLocales=(options:ChartOptions):string[]=>options.formatting?.locale?[options.formatting.locale,options.locale??'en','en']:[options.locale??'en','en'];
function cachedFormatter<T>(cache: Map<string, T>, key: string, create: () => T): T {
  const existing = cache.get(key);
  if (existing !== undefined) return existing;
  const formatter = create();
  if (cache.size >= 64) cache.delete(cache.keys().next().value!);
  cache.set(key, formatter);
  return formatter;
}
export function valueFormatter(options:ChartOptions,axis?:'primary'|'secondary'):(value:number)=>string {
  // Percentage stacks have a normalized primary tick domain but retain raw
  // observation values. Their tick formatter must not turn original money or
  // measurements into percentages in tooltips/data labels.
  const override=axis==='secondary'?options.axes?.secondaryY?.numberFormat:options.layout?.stacking==='percent'?undefined:options.axes?.y?.numberFormat;
  return numberFormatter(options, override);
}
/** UTC is explicit so server and browser agree regardless of machine timezone. */
export function dateFormatter(options: ChartOptions): (value: number) => string {
  const locales=formatLocales(options);
  const spec = options.formatting?.date ?? {}, key = JSON.stringify([locales, spec]);
  return cachedFormatter(dates, key, () => new Intl.DateTimeFormat(locales, {timeZone: 'UTC', ...spec})).format;
}
export function tickFormatter(options: ChartOptions, number: ChartNumberFormat | undefined): (tick: Readonly<{label: string; value?: number; type?: 'number' | 'time'}>) => string {
  const numeric = number ? numberFormatter(options, number) : undefined, temporal = options.formatting?.date ? dateFormatter(options) : undefined;
  return tick => tick.value === undefined ? tick.label : tick.type === 'time' ? temporal?.(tick.value) ?? tick.label : numeric?.(tick.value) ?? tick.label;
}
/** Bounded formatter cache; raw table/CSV values never use display formatting. */
export function numberFormatter(options: ChartOptions, requested = options.formatting?.number): (value: number) => string {
  if (!requested) return displayNumber;
  const {prefix='',suffix='',...spec}=requested;
  const locales=formatLocales(options),key = JSON.stringify([locales, spec]);
  const format = cachedFormatter(formatters, key, () => new Intl.NumberFormat(locales, spec)).format;
  return prefix || suffix ? value => prefix + format(value) + suffix : format;
}
/** Display rounding removes floating point noise; original values remain in the data table. */
export function displayNumber(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toPrecision(12))) : String(value);
}

/** Time intervals store milliseconds. Choose a readable unit without changing the stored value. */
export function formatTimeDuration(options: ChartOptions, duration: number): string {
  const [unit, scale] = duration >= 86400000 ? ['day', 86400000]
    : duration >= 3600000 ? ['hour', 3600000]
    : duration >= 60000 ? ['minute', 60000]
    : duration >= 1000 ? ['second', 1000] : ['millisecond', 1];
  return numberFormatter(options, {style:'unit', unit, unitDisplay:'short', maximumFractionDigits:2})(duration / scale);
}
