import {planCartesianChart} from '@neural-charts/core/cartesian';
import {createChartWithPlanner} from './owner.js';
import type {ChartController,ChartData,ChartOptions,ChartMountOptions,ChartResult} from './types.js';
import {invalid,validateOptions} from './planning.js';
import {renderSvgWith,type SvgRenderOptions} from './export.js';
export type CartesianChartData=Extract<ChartData,{type:'line'|'spline'|'area'|'areaspline'|'column'}>;
export function createCartesianChart(host:HTMLElement,data:CartesianChartData,options:ChartOptions,mount:ChartMountOptions):ChartResult<ChartController>{
  if(!data||!['line','spline','area','areaspline','column'].includes(data.type))return invalid('UNSUPPORTED_CARTESIAN_TYPE');
  return createChartWithPlanner(planCartesianChart,host,data,options,mount);
}
/** Pure Cartesian SSR/export without retaining the full-catalogue dispatcher. */
export function renderCartesianChartSvg(data:CartesianChartData,options:ChartOptions,settings:SvgRenderOptions):ChartResult<string>{
  if(!data||!['line','spline','area','areaspline','column'].includes(data.type))return invalid('UNSUPPORTED_CARTESIAN_TYPE');
  return renderSvgWith(planCartesianChart,data,options,settings);
}
export const createLineChart=(host:HTMLElement,data:Extract<ChartData,{type:'line'}>,options:ChartOptions,mount:ChartMountOptions)=>createCartesianChart(host,data,options,mount);
export const createColumnChart=(host:HTMLElement,data:Extract<ChartData,{type:'column'}>,options:ChartOptions,mount:ChartMountOptions)=>createCartesianChart(host,data,options,mount);
export function createBarChart(host:HTMLElement,data:Extract<ChartData,{type:'column'}>,options:ChartOptions,mount:ChartMountOptions):ChartResult<ChartController>{
  const checked=validateOptions(options);if(checked.status==='invalid')return checked;
  return createChartWithPlanner(planCartesianChart,host,data,{...checked.value,layout:{...checked.value.layout,orientation:'horizontal'}},mount);
}
export {ChartDownloadFormat,ChartDownloadMenuPosition,ChartToolbarAction,ChartToolbarPosition} from './types.js';
export type {ChartData,ChartOptions,ChartZoomOptions,ChartMountOptions,ChartController} from './types.js';
