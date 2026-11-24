import test from 'node:test';
import assert from 'node:assert/strict';
import {renderChartSvg} from '../dist/index.js';
import {catalog} from '../tooling/catalog.mjs';

test('explicit stack labels paint Core totals independently and before segment labels',()=>{
 for(const family of ['column','bar','area']){
  const recipe=catalog.find(item=>item.family===family&&item.id==='stacked');assert(recipe);
  const options={...recipe.options,appearance:{...recipe.options.appearance,dataLabels:false,stackLabels:true}};
  const result=renderChartSvg(recipe.data,options,{instanceId:'total-'+family});assert.equal(result.status,'ok');
  const total=recipe.data.series.reduce((sum,series)=>sum+series.data[0].y,0);assert(result.value.includes(`data-stack-total="${total}"`));
  const labels=[...result.value.matchAll(/<g data-label=""[^>]*>/g)];assert(labels.length>0);assert(labels.every(label=>label[0].includes('data-stack-total')));
  const both=renderChartSvg(recipe.data,{...options,appearance:{...options.appearance,dataLabels:true}},{instanceId:'both-'+family});assert.equal(both.status,'ok');const totals=[...both.value.matchAll(/<g data-label="" data-stack-total="[^"]+"[^>]*>/g)];assert(totals.length>0);assert(totals.every(total=>total[0].includes('data-label-priority="stack"')),'Explicit totals retain collision priority even when point labels are also present');
  const hidden=renderChartSvg(recipe.data,{...options,hiddenSeriesIds:[recipe.data.series[1].id]},{instanceId:'hidden-'+family});assert.equal(hidden.status,'ok');assert(hidden.value.includes(`data-stack-total="${recipe.data.series[0].data[0].y}"`),'Totals follow actual visible Core series');
  assert(!/NaN|Infinity/.test(result.value));
 }
});
test('stack-label presentation validates booleans without changing data or requiring a new Core API',()=>{
 const recipe=catalog.find(item=>item.family==='column'&&item.id==='stacked'),before=JSON.stringify(recipe);
 assert.equal(renderChartSvg(recipe.data,{...recipe.options,appearance:{stackLabels:'yes'}},{instanceId:'bad'}).status,'invalid');
 assert.equal(JSON.stringify(recipe),before);
});
