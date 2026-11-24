import test from 'node:test';
import assert from 'node:assert/strict';
import {renderChartSvg} from '../dist/index.js';
const data={type:'line',axes:{x:{type:'linear'},y:{type:'linear'}},series:[{id:'s',name:'One',data:[{id:'a',x:0,y:10000},{id:'b',x:1,y:20000}]}]};
test('long reference labels wrap in a plot-clipped group and retain full escaped text and color',()=>{
  const label='Annual target <before adjustment> with the complete original reference value';
  const result=renderChartSvg(data,{width:320,references:[{id:'target',axis:'y',value:15000}],referenceLabels:[{id:'target',text:label}],referenceStyles:[{id:'target',color:'#9b3150'}]},{instanceId:'narrow'});
  assert.equal(result.status,'ok');assert(result.value.includes('data-reference-label="target" clip-path="url(#narrow-clip)"'));assert(result.value.includes('aria-label="Annual target &lt;before adjustment&gt; with the complete original reference value"'));assert(result.value.includes('<title>Annual target &lt;before adjustment&gt; with the complete original reference value</title>'));assert(!result.value.includes('<before adjustment>'));assert(result.value.includes('fill="#9b3150"'));
  assert(result.value.includes('stroke="#ffffff" stroke-width="3" stroke-linejoin="round" paint-order="stroke"'),'Reference text retains contrast when crossing series ink');
});
test('wide formatted axes reserve the outer margin for the title',()=>{
  const result=renderChartSvg(data,{formatting:{number:{style:'currency',currency:'USD'}},axes:{y:{title:'Revenue'}}},{instanceId:'title'});assert.equal(result.status,'ok');assert(result.value.includes('x="-112"'));assert(result.value.includes('rotate(-90,-112,'));
});
test('vertical reference labels choose available space at both domain edges',()=>{
  const label='The complete vertical reference label with its original domain value';
  const result=renderChartSvg(data,{width:320,references:[{id:'left',axis:'x',value:0},{id:'right',axis:'x',value:1}],referenceLabels:[{id:'left',text:label},{id:'right',text:label}]},{instanceId:'edges'});assert.equal(result.status,'ok');
  const left=result.value.split('data-reference-label="left"')[1]?.split('data-reference-label="right"')[0],right=result.value.split('data-reference-label="right"')[1];assert(left&&right);assert(left.includes('text-anchor="start"'));assert(right.includes('text-anchor="end"'));assert(left.includes('aria-label="'+label+'"'));assert(right.includes('aria-label="'+label+'"'));
});

test('explicit compact numeric axes recover plot width without changing full-value title margins',()=>{
  const compact={style:'currency',currency:'EUR',currencyDisplay:'narrowSymbol',notation:'compact',minimumFractionDigits:0,maximumFractionDigits:0};
  const r=renderChartSvg(data,{width:320,axes:{y:{numberFormat:compact}}},{instanceId:'compact'});assert.equal(r.status,'ok');assert(r.value.includes('transform="translate(88,22)"'));
  for(const numberFormat of [{...compact,currencyDisplay:'name'},{...compact,maximumFractionDigits:2}]){const result=renderChartSvg(data,{axes:{y:{numberFormat}}},{instanceId:'wide'});assert.equal(result.status,'ok');assert(result.value.includes('transform="translate(128,22)"'));}
  const titled=renderChartSvg(data,{axes:{y:{numberFormat:compact,title:'Revenue'}}},{instanceId:'titled'});assert.equal(titled.status,'ok');assert(titled.value.includes('transform="translate(128,22)"'));
});
