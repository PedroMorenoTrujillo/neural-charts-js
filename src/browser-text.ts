import type { PlanWordCloudMeasurement, PlanWordCloudMeasurementRequest } from '@neural-charts/core';
import {svgNamespace} from './svg.js';

/** One owned measurement surface per batch; actual SVG font metrics, no packing math. */
export function measureBrowserWords(doc: Document, requests: readonly PlanWordCloudMeasurementRequest[]): readonly PlanWordCloudMeasurement[] {
  const svg = doc.createElementNS(svgNamespace, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;left:-20000px;top:0;visibility:hidden;pointer-events:none;font-family:system-ui';
  (doc.body ?? doc.documentElement).append(svg);
  try {
    return requests.map(request => {
      const text = doc.createElementNS(svgNamespace, 'text'); text.setAttribute('font-size', String(request.fontSize)); text.textContent = request.text; svg.replaceChildren(text);
      const box = text.getBBox();
      return { ...request, width: box.width, height: box.height + request.fontSize * .4 };
    });
  } finally { svg.remove(); }
}
