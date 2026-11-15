import {planChart, prepareWordCloudMeasurements} from '@neural-charts/core';
import type {ChartPlanner} from './planning.js';

/** Full-catalogue preparation stays out of granular Cartesian consumers. */
export const planDefaultChart: ChartPlanner = (plan, calculation, ports = {}) => {
  if (plan.family !== 'wordcloud') return planChart(plan, calculation);
  if (!ports.measureWords) return {status: 'invalid', diagnostic: {code: 'INVALID_CONFIG', reason: 'TEXT_MEASUREMENT_REQUIRED', path: 'renderer', message: 'TEXT_MEASUREMENT_REQUIRED'}};
  const fontKey = ports.fontKey ?? 'neural-web-system-ui';
  const prepared = prepareWordCloudMeasurements(plan, {width: calculation.width, height: calculation.height, hiddenSeriesIds: calculation.hiddenSeriesIds ?? [], fontKey});
  if (prepared.status === 'invalid') return prepared;
  return planChart(plan, {...calculation, wordcloudText: {fontKey, measurements: ports.measureWords(prepared.preparation.requests)}});
};
