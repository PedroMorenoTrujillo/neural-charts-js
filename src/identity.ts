import type { ChartPointId } from './types.js';
const escaped = /["\\\u0000-\u001f\ud800-\udfff]/;
export const pointKeyParts = (seriesId: string, pointId: string): string =>
  typeof seriesId === 'string' && typeof pointId === 'string' && !escaped.test(seriesId) && !escaped.test(pointId)
    ? '["' + seriesId + '","' + pointId + '"]' : JSON.stringify([seriesId, pointId]);
export const pointKey = (id: ChartPointId) => pointKeyParts(id.seriesId, id.pointId);
export const samePoint = (a: ChartPointId | undefined, b: ChartPointId | undefined) => !!a && !!b && a.seriesId === b.seriesId && a.pointId === b.pointId;
