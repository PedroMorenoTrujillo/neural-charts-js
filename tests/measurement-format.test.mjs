import test from 'node:test';
import assert from 'node:assert/strict';
import {planWebChart,validateOptions} from '../dist/planning.js';
import {numberFormatter,dateFormatter,valueFormatter} from '../dist/format.js';
import {resolveResponsive} from '../dist/responsive.js';
import {renderChartSvg,exportChartCsv} from '../dist/index.js';
import {escapeXml,plotInsets} from '../dist/svg.js';

const data={type:'line',axes:{x:{type:'linear'},y:{type:'linear'}},series:[{id:'s',name:'Temperature',data:[{id:'a',x:0,y:18.125},{id:'b',x:1,y:-3.125}]}]};
test('single-line formatted value labels can reserve a narrower explicit gutter', () => {
  const options = {formatting:{number:{maximumFractionDigits:2}},axes:{y:{title:'Price'}}};
  assert.equal(plotInsets('ikh',undefined,options).left,128);
  const bounded = {...options,axes:{y:{...options.axes.y,labels:{maxLines:1,maxCharacters:6}}}};
  assert.equal(plotInsets('ikh',undefined,bounded).left,84);
});

test('tooltip and legend dimensions are bounded public options', () => {
  assert.equal(validateOptions({legend:{maxHeight:96},tooltip:{maxWidth:200,maxHeight:120}}).status,'ok');
  assert.equal(validateOptions({legend:{maxHeight:1}}).status,'invalid');
  assert.equal(validateOptions({tooltip:{maxWidth:0}}).status,'invalid');
});

test('axis label typography is validated, merged at breakpoints and drawn in SVG', () => {
  const options = {
    axes: {x: {labels: {style: {color: '#334455', fontWeight: 600}}}},
    responsive: [{maxWidth: 480, options: {axes: {x: {labels: {style: {fontSize: 16}}}}}}],
  };
  const checked = validateOptions(options);
  assert.equal(checked.status, 'ok');
  const narrow = resolveResponsive(checked.value, 400);
  assert.deepEqual(narrow.axes.x.labels.style, {color:'#334455',fontWeight:600,fontSize:16});
  const svg = renderChartSvg(data,narrow,{instanceId:'styled-axis'});
  assert.equal(svg.status,'ok');
  assert.match(svg.value,/fill="#334455"[^>]*font-size="16" font-weight="600"/);
  assert.equal(validateOptions({axes:{x:{labels:{style:{fontSize:40}}}}}).status,'invalid');
});

test('Pareto localizes derived series names for the frame and composed SVG export',()=>{
  const pareto={type:'pareto',data:[{id:'a',label:'A',value:4},{id:'b',label:'B',value:2}]};
  for(const [locale,names] of [['es',['Valores','Acumulado']],['en',['Values','Cumulative']]]){
    const options={locale,legend:{visible:true}};
    const result=planWebChart(pareto,options,{width:640,height:380});
    assert.equal(result.status,'ok');
    assert.deepEqual(result.value.legend.map(item=>[item.id,item.name]),[['values',names[0]],['cumulative',names[1]]]);
    assert.deepEqual([...new Set(result.value.observations.map(point=>point.seriesName))],names);
    const svg=renderChartSvg(pareto,options,{instanceId:'pareto',composition:'chart'});
    assert.equal(svg.status,'ok');
    for(const name of names)assert.ok(svg.value.includes(name));
  }
});
test('numeric locale is independent of interface language and formatter cache entries',()=>{
  const spec={style:'currency',currency:'EUR',currencyDisplay:'code',minimumFractionDigits:2,maximumFractionDigits:2};
  for(const locale of ['de-DE','en-US','fr-FR','es-ES']){
    const options={locale:'es',formatting:{locale,number:spec}};
    assert.equal(validateOptions(options).status,'ok');
    assert.equal(numberFormatter(options)(1234.125),new Intl.NumberFormat(locale,spec).format(1234.125));
  }
  assert.equal(numberFormatter({})(1234.125),'1234.125','Default precision remains unchanged');
});
test('graph legends, observations and SVG use the localized implicit group name', () => {
  const nodes = [{id:'a',label:'A'},{id:'b',label:'B'}];
  const links = [{id:'a-b',from:'a',to:'b'}];
  const size = {width:640,height:380};
  for (const type of ['treegraph','organization','networkgraph']) {
    for (const [locale,names,groups] of [
      ['es','Nodos',undefined],
      ['en','Nodes',undefined],
      ['es','Nodes',[{id:'nodes',label:'Nodes'}]],
    ]) {
      const graph = {type,nodes,links,...(groups ? {groups} : {})};
      const options = {locale,legend:{visible:true}};
      const result = planWebChart(graph,options,size);
      assert.equal(result.status,'ok');
      assert.deepEqual(result.value.legend.map(group=>group.name),[names]);
      assert.deepEqual([...new Set(result.value.observations.map(point=>point.seriesName))],[names]);
      const svg = renderChartSvg(graph,options,{instanceId:'graph',composition:'chart'});
      assert.equal(svg.status,'ok');
      assert.ok(svg.value.includes('>'+names+'</text>'));
    }
  }
});
test('measurement units and currency presentations follow explicit Intl options without converting data',()=>{
  for(const number of [
    {style:'unit',unit:'kilometer-per-hour',unitDisplay:'long',maximumFractionDigits:1},
    {style:'unit',unit:'liter',unitDisplay:'short'},
    {style:'unit',unit:'celsius',unitDisplay:'narrow'},
    {style:'currency',currency:'USD',currencyDisplay:'symbol',currencySign:'accounting'},
    {style:'currency',currency:'JPY',currencyDisplay:'name'},
    {style:'currency',currency:'GBP',currencyDisplay:'narrowSymbol'},
    {style:'percent',maximumFractionDigits:1},
  ])for(const locale of ['en-US','es-ES']){
    const options={formatting:{locale,number}};assert.equal(validateOptions(options).status,'ok');
    for(const value of [0,-0,.125,-1234.125])assert.equal(numberFormatter(options)(value),new Intl.NumberFormat(locale,number).format(value));
  }
});
test('incompatible, incomplete and unknown formatting options fail explicitly',()=>{
  for(const number of [
    {style:'unit'},{unit:'liter'},{style:'unit',unit:'made-up-unit'},{style:'unit',unit:'liter',unitDisplay:'huge'},
    {style:'unit',unit:'liter',currency:'EUR'},{style:'currency'},{style:'currency',currency:'EUR',unit:'liter'},
    {style:'currency',currency:'EUR',currencySign:'negative'},{currencyDisplay:'code'},
    {style:'currency',currency:'EUR',currencyDisplay:'unknown'},{style:'decimal',currencySign:'accounting'},
    {style:'decimal',unitDisplay:'short'},
    {style:['decimal']},{style:'currency',currency:'EUR',currencyDisplay:['code']},
    {style:'currency',currency:'EUR',currencySign:['accounting']},{style:'unit',unit:'liter',unitDisplay:['long']},
  ])assert.equal(validateOptions({formatting:{number}}).status,'invalid',JSON.stringify(number));
  for(const locale of ['', 'en_XX', 2, ['en-US'], 'x'.repeat(129)])assert.equal(validateOptions({formatting:{locale}}).status,'invalid');
});
test('axis format replaces global number format and data labels agree with value formatting',()=>{
  const options={locale:'es',formatting:{locale:'en-US',number:{style:'currency',currency:'USD'}},axes:{y:{numberFormat:{style:'unit',unit:'celsius',unitDisplay:'long',maximumFractionDigits:1}}},appearance:{dataLabels:true}};
  const format=valueFormatter(options),expected=new Intl.NumberFormat('en-US',options.axes.y.numberFormat);
  const result=renderChartSvg(data,options,{instanceId:'measurement',composition:'chart'});assert.equal(result.status,'ok');
  for(const value of [18.125,-3.125]){assert.equal(format(value),expected.format(value));assert(result.value.includes(escapeXml(expected.format(value))));}
  assert(!result.value.includes('$18.13'),'Global currency must not leak into temperature labels');
  const before=JSON.stringify(data),csv=exportChartCsv(data);assert.equal(csv.status,'ok');assert(csv.value.includes('18.125'));assert(csv.value.includes('-3.125'));assert(!csv.value.includes('Celsius'));assert.equal(JSON.stringify(data),before);
});
test('responsive same-style patches retain fields, while a different explicit style replaces the formatter',()=>{
  const base={axes:{y:{numberFormat:{style:'currency',currency:'EUR',currencySign:'accounting',minimumFractionDigits:2}}},responsive:[{maxWidth:430,options:{axes:{y:{numberFormat:{style:'unit',unit:'meter',maximumFractionDigits:0}}}}}]};
  const checked=validateOptions(base);assert.equal(checked.status,'ok');const small=resolveResponsive(checked.value,375);
  assert.deepEqual(small.axes.y.numberFormat,{style:'unit',unit:'meter',maximumFractionDigits:0});assert.equal(validateOptions(small).status,'ok');
  assert.equal(resolveResponsive(checked.value,768).axes.y.numberFormat.currency,'EUR');
  const partial=resolveResponsive({...base,responsive:[{maxWidth:430,options:{axes:{y:{numberFormat:{maximumFractionDigits:3}}}}}]},375);
  assert.equal(partial.axes.y.numberFormat.currency,'EUR');assert.equal(partial.axes.y.numberFormat.maximumFractionDigits,3);
});
test('date formatting uses the separate locale with deterministic UTC',()=>{
  const date={year:'numeric',month:'long',day:'numeric'},value=Date.UTC(2026,10,4),options={locale:'es',formatting:{locale:'de-DE',date}};
  assert.equal(validateOptions(options).status,'ok');assert.equal(dateFormatter(options)(value),new Intl.DateTimeFormat('de-DE',{...date,timeZone:'UTC'}).format(value));
});
test('unsupported locales use explicit UI fallback and do not poison another fallback cache entry',()=>{
  for(const locale of ['en','es','en']){
    const number={minimumFractionDigits:2},date={year:'numeric',month:'long',day:'numeric'},options={locale,formatting:{locale:'zz-ZZ',number,date}},value=Date.UTC(2026,10,4);
    assert.equal(validateOptions(options).status,'ok');
    assert.equal(numberFormatter(options)(1234.5),new Intl.NumberFormat([locale,'en'],number).format(1234.5));
    assert.equal(dateFormatter(options)(value),new Intl.DateTimeFormat([locale,'en'],{...date,timeZone:'UTC'}).format(value));
  }
});
test('responsive format-only patches inherit the owning style and explicit decimal preserves implicit decimal settings',()=>{
  for(const [base,patch]of [[{style:'currency',currency:'EUR'},{currencyDisplay:'code'}],[{style:'unit',unit:'meter'},{unitDisplay:'narrow'}],[{maximumFractionDigits:1},{style:'decimal',useGrouping:false}]]){
    const options={axes:{y:{numberFormat:base}},responsive:[{maxWidth:430,options:{axes:{y:{numberFormat:patch}}}}]};
    const checked=validateOptions(options);assert.equal(checked.status,'ok');
    const applied=resolveResponsive(checked.value,375);assert.equal(validateOptions(applied).status,'ok');assert.deepEqual(applied.axes.y.numberFormat,{...base,...patch});
  }
  const bad={axes:{y:{numberFormat:{style:'currency',currency:'EUR'}}},responsive:[{maxWidth:430,options:{axes:{y:{numberFormat:{currencyDisplay:['code']}}}}}]};assert.equal(validateOptions(bad).status,'invalid');
});
test('reference styles follow stable IDs, preserve geometry and reject unsafe presentation',()=>{
  const base={references:[{id:'mean',axis:'y',value:10}],referenceLabels:[{id:'mean',text:'Mean'}]};
  const before=renderChartSvg(data,base,{instanceId:'reference'});assert.equal(before.status,'ok');
  for(const dash of ['solid','dashed','dotted']){
    const options={...base,referenceStyles:[{id:'mean',color:'#9b3150',width:2,dash}]},result=renderChartSvg(data,options,{instanceId:'reference'});assert.equal(result.status,'ok');
    const mark=result.value.match(/<path data-reference="mean"[^>]+>/)?.[0],original=before.value.match(/<path data-reference="mean"[^>]+>/)?.[0];
    assert(mark);assert(mark.includes('stroke="#9b3150"'));assert(mark.includes('stroke-width="2"'));assert.equal(mark.match(/ d="([^"]+)/)[1],original.match(/ d="([^"]+)/)[1]);
    assert.equal(mark.includes('stroke-dasharray'),dash!=='solid');
  }
  for(const style of [{id:''},{id:'mean',color:'url(https://bad)'},{id:'mean',width:0},{id:'mean',width:9},{id:'mean',dash:['solid']},{id:'mean',unknown:true}])assert.equal(validateOptions({referenceStyles:[style]}).status,'invalid');
  assert.equal(validateOptions({referenceStyles:[{id:'mean'},{id:'mean'}]}).status,'invalid');
  for(const referenceStyles of [false,0,'']){
    assert.equal(validateOptions({referenceStyles}).status,'invalid');
    const result=renderChartSvg(data,{referenceStyles},{instanceId:'invalid-reference-style'});assert.equal(result.status,'invalid');assert.notEqual(result.diagnostic.reason,'SVG_SERIALIZATION_FAILED');
  }
});
test('custom business units and prefixes are literal presentation text, with unmodified raw CSV',()=>{
  const options={formatting:{locale:'en-US',number:{prefix:'≈ ',suffix:' visits',maximumFractionDigits:0}}};assert.equal(validateOptions(options).status,'ok');
  assert.equal(numberFormatter(options)(1234.5),'≈ 1,235 visits');
  const currency={formatting:{locale:'en-US',number:{style:'currency',currency:'USD',currencySign:'accounting',prefix:'~ ',suffix:' net'}}};assert.equal(numberFormatter(currency)(-1234.5),'~ ($1,234.50) net');
  const escaped=renderChartSvg(data,{...options,formatting:{...options.formatting,number:{...options.formatting.number,suffix:' <safe>'}},appearance:{dataLabels:true}},{instanceId:'affix'});assert.equal(escaped.status,'ok');assert(escaped.value.includes('&lt;safe&gt;'));assert(!escaped.value.includes('<safe>'));assert(exportChartCsv(data).value.includes('18.125'));
  for(const number of [{prefix:[]},{suffix:12},{prefix:'x'.repeat(129)},{suffix:null}])assert.equal(validateOptions({formatting:{number}}).status,'invalid');
});
