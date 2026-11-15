import {planFinancialChart,type PlanFinancialSpec} from '@neural-charts/core/financial';
import {createChartWithPlanner} from './owner.js';
import type {ChartData,ChartOptions,ChartMountOptions} from './types.js';
export type FinancialChartData=Extract<ChartData,{type:PlanFinancialSpec['family']}>;
export function createFinancialChart(host:HTMLElement,data:FinancialChartData,options:ChartOptions,mount:ChartMountOptions){
  return createChartWithPlanner((spec,settings)=>planFinancialChart(spec as PlanFinancialSpec,settings),host,data,options,mount);
}
export type {ChartData,ChartOptions,ChartMountOptions,ChartController} from './types.js';
