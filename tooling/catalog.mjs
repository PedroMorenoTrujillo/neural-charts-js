import fs from 'node:fs';
import path from 'node:path';
import { layoutKeysFor } from '../dist/layout.js';
import {featureRecipe} from '../examples/featured-presentation.mjs';
import {webExtensions} from '../examples/web-extensions.mjs';
import {migrateRecipeDiscriminators} from './core-fixture-migration.mjs';

const root = path.resolve(import.meta.dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'examples/native-recipes.json')));
const clean = value => Array.isArray(value) ? value.map(clean) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([k]) => !['color', 'datum', 'markers', 'dash', 'labels'].includes(k)).map(([k, v]) => [k, clean(v)])) : value;

/** Recipe transport only; no source scale, accumulated total or screen coordinate is recalculated. */
export function recipeForWeb(item) {
  const spec = structuredClone(item.spec), family = spec.family;
  const layout = Object.fromEntries(layoutKeysFor(family).filter(k => Object.hasOwn(spec, k)).map(k => [k, spec[k]]));
  Object.assign(layout, item.layout ?? {});
  if (spec.pictorial) Object.assign(layout, spec.pictorial);
  if (spec.contour) Object.assign(layout, spec.contour);
  const colorAxis = spec.colorAxis;
  for (const k of ['family', 'title', 'description', 'color', 'unit', 'pictorial', 'colorAxis', 'contour', 'centerName', 'centerColor', ...layoutKeysFor(family)]) delete spec[k];
  if (spec.axes) for (const axis of Object.values(spec.axes)) if (axis && typeof axis === 'object') for (const k of ['title', 'grid', 'labels']) delete axis[k];
  if (['column', 'area', 'windrose', 'pictorial'].includes(family)) {
    if (item.settings.columnLayout === 'stacked') layout.stacking = 'sum';
    if (item.settings.columnLayout === 'percent') layout.stacking = 'percent';
  }
  const appearance = { colors: [item.settings.color, item.settings.comparisonColor].filter(c => /^#[0-9a-f]{6}$/i.test(c)), markers: item.settings.showMarkers, dataLabels: item.settings.showDataLabels, lineWidth: item.settings.strokeWidth, markerRadius: item.settings.markerSize };
  if (item.settings.showStackLabels === true) appearance.stackLabels = true;
  if (!appearance.colors.length) delete appearance.colors;
  if (family === 'gauge' && item.spec.bands) appearance.bandColors = item.spec.bands.map(b => b.color);
  for (const key of Object.keys(appearance)) if (appearance[key] === undefined) delete appearance[key];
  const options = { title: item.title, description: item.description, height: 380, ...(Object.keys(layout).length ? { layout } : {}), appearance,
    legend: { visible: item.settings.legend, position: item.settings.legendPosition }, tooltip: { enabled: item.settings.tooltipMode !== 'off', content: item.settings.tooltipContent, placement: item.settings.tooltipMode === 'docked' ? 'docked' : 'auto', crosshair: item.settings.showCrosshair },
    axes: { grid: item.settings.grid, x: { visible: item.settings.xAxis, title: item.settings.xTitle }, y: { visible: item.settings.yAxis, title: item.settings.yTitle } },
    ...(colorAxis ? { colorAxis } : {}), ...(item.spec.unit ? { unit: item.spec.unit } : {}) };
  // Parallel coordinates have dimension names and value ticks, independent of Cartesian axis settings in the source recipes.
  if (family === 'parallel') {
    options.axes.x.visible = true;
    options.axes.y.visible = true;
  }
  if (item.settings.zoomEnabled && source.capabilities[item.family].viewport) options.viewport = { axes: source.capabilities[item.family].viewport === 'any' ? item.settings.viewportAxes : source.capabilities[item.family].viewport };
  if (item.settings.referenceEnabled) options.references = [{ id: 'example-reference', axis: item.settings.referenceAxis ?? 'y', value: item.settings.referenceValue ?? 0 }];
  if (['column', 'bar'].includes(item.family) && item.settings.columnLayout === 'single') options.hiddenSeriesIds = item.spec.series.slice(1).map(series => series.id);
  const composition = item.family === 'mixed' && ['panels-pie', 'panels-linked', 'panels-missing', 'panels-responsive'].includes(item.id) ? { columns: item.id === 'panels-responsive' ? 'auto' : 1, linkedVisibility: ['panels-linked', 'panels-responsive'].includes(item.id) } : undefined;
  return migrateRecipeDiscriminators({ family: item.family, id: item.id, title: item.title, description: item.description, data: { ...clean(spec), type: family }, options: JSON.parse(JSON.stringify(options)), ...(composition ? { composition } : {}) });
}
export const nativeCatalog = source.examples.map(recipeForWeb);
const financial = JSON.parse(fs.readFileSync(path.join(root, 'examples/financial-recipes.json')));
const financialMetadata = JSON.parse(fs.readFileSync(path.join(root, 'examples/financial-metadata.json')));
export const catalog = [...nativeCatalog, ...financial.map(migrateRecipeDiscriminators), ...webExtensions].map(featureRecipe);
export const capabilities = { ...source.capabilities, ...financialMetadata.capabilities };
if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  fs.writeFileSync(path.join(root, 'examples/web-catalog.json'), JSON.stringify(catalog, null, 2));
  console.log('Prepared ' + catalog.length + ' source recipes for the public web contract.');
}
