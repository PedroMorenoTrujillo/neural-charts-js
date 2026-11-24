import test from 'node:test';
import assert from 'node:assert/strict';
import {renderChartSvg,planWebChart,exportChartCsv} from '../dist/index.js';
import {valueFormatter} from '../dist/format.js';
import {webExtensions} from '../examples/web-extensions.mjs';

for(const family of ['areaspline','mixed'])test(`normalized ${family} axes do not inherit currency formatting from original values`,()=>{
  const recipe=webExtensions.find(r=>r.family===family&&r.id==='stacked-percent'),options={...recipe.options,formatting:{locale:'en-US',number:{style:'currency',currency:'USD'}}};
  const planned=planWebChart(recipe.data,options,{width:600,height:320});assert.equal(planned.status,'ok');assert(planned.value.grid.some(t=>t.value===100));
  const result=renderChartSvg(recipe.data,options,{instanceId:'normalized'});assert.equal(result.status,'ok');assert(!result.value.includes('$100.00'),'Normalized100 must not be painted as100 dollars');
  const explicit={...options,axes:{...options.axes,y:{...options.axes?.y,numberFormat:{maximumFractionDigits:0,suffix:' %'}}},appearance:{...options.appearance,dataLabels:true}};
  const formatted=renderChartSvg(recipe.data,explicit,{instanceId:'normalized'});assert.equal(formatted.status,'ok');assert(formatted.value.includes('100 %'));assert(formatted.value.includes('$18.00'),'Data labels retain original monetary values');assert.equal(valueFormatter(explicit)(18),'$18.00');
  assert.equal(valueFormatter({...explicit,axes:{...explicit.axes,secondaryY:{numberFormat:{style:'percent'}}}},'secondary')(.35),'35%');
  assert(exportChartCsv(recipe.data).value.includes('18'),'Original CSV remains unchanged');
});
for(const orientation of ['vertical','horizontal'])test(`normalized ${orientation} columns preserve the represented percent domain and raw labels`,()=>{
  const data={type:'column',axes:{x:{type:'category',values:[{id:'a',label:'A'}]},y:{type:'linear'}},series:[{id:'s',name:'One',data:[{id:'s-a',x:'a',y:20}]},{id:'t',name:'Two',data:[{id:'t-a',x:'a',y:30}]}]};
  const options={layout:{stacking:'percent',orientation},formatting:{locale:'en-US',number:{style:'currency',currency:'USD'}},axes:{y:{numberFormat:{maximumFractionDigits:0,suffix:' %'}}},appearance:{dataLabels:true}};
  const result=renderChartSvg(data,options,{instanceId:'percent-column'});assert.equal(result.status,'ok');assert(result.value.includes('100 %'));assert(result.value.includes('$20.00'));assert(result.value.includes('$30.00'));assert(!result.value.includes('$100.00'));
});
