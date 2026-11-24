import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderChartSvg,exportChartCsv,formatChartTitle,validateChartContent} from '../dist/index.js';
import {ownContent,contentText} from '../dist/content.js';
const data={type:'line',axes:{x:{type:'category',values:[{id:'a',label:'Repeated'},{id:'b',label:'Repeated'}]},y:{type:'linear'}},series:[{id:'s',name:'Original series',data:[{id:'zero',x:'a',y:0},{id:'negative',x:'b',y:-3.125}]}]};
const options={title:'Original title',locale:'es',appearance:{dataLabels:true},axes:{y:{title:'Value'}}};
test('portable content shares escaped title, legend, ticks and original-value labels with real SVG export',()=>{
  const seen=[],content={title:{text:c=>{assert(Object.isFrozen(c));return '<Custom> '+c.defaultText}},legend:{text:c=>{assert.equal(c.id,'s');return c.name+' · audited'}},axisLabel:{text:c=>{seen.push(c);return c.defaultText+' unit'}},dataLabel:{text:c=>{assert(Object.isFrozen(c));assert.equal(c.observation.id.seriesId,'s');return c.observation.id.pointId+': '+c.defaultText}},tooltip:{text:()=>{throw Error('SSR must not generate tooltips')},render:()=>{throw Error('SSR must not invoke DOM capabilities')}}};
  const before=JSON.stringify(data),result=renderChartSvg(data,options,{instanceId:'custom',composition:'chart',content});assert.equal(result.status,'ok');assert(result.value.includes('&lt;Custom&gt; Original title'));assert(!result.value.includes('<Custom>'));assert(result.value.includes('Original series · audited'));assert(result.value.includes('data-export-background=""'));assert(result.value.includes('zero: 0'));assert(result.value.includes('negative: -3.125'));assert(seen.some(c=>c.axis==='x'&&c.index===1));assert(seen.every(c=>Object.isFrozen(c.tick)));assert.equal(JSON.stringify(data),before);assert(exportChartCsv(data).value.includes('-3.125'));assert(!exportChartCsv(data).value.includes('audited'));
});
test('parallel SVG hides dimension names and value ticks independently and declares its locale', () => {
  const fixtures = JSON.parse(readFileSync(new URL('../examples/web-catalog.json', import.meta.url), 'utf8'));
  const recipe = fixtures.find(item => item.family === 'parallel' && item.id === 'basic');
  const counts = [{}, { x: { visible: false } }, { y: { visible: false } },
    { x: { visible: false }, y: { visible: false } }].map(axes => {
    const result = renderChartSvg(recipe.data, { ...recipe.options, axes, locale: 'es' }, { instanceId: 'parallel-locale', composition: 'plot' });
    assert.equal(result.status, 'ok');
    assert.match(result.value, /<svg[^>]+ lang="es"/);
    return (result.value.match(/<text\b/g) ?? []).length;
  });
  assert(counts[1] > 0 && counts[2] > 0);
  assert.equal(counts[0], counts[1] + counts[2]);
  assert.equal(counts[3], 0);
});

test('axis formatters receive UTC timestamps and parallel values, with text fallback for radial rings', () => {
  const start = Date.UTC(2026, 0, 5);
  const dated = {
    type: 'line',
    axes: {x: {type: 'time'}, y: {type: 'linear'}},
    series: [{id: 's', name: 'S', data: [0, 1, 2].map(index => ({
      id: String(index), x: start + index * 86400000, y: index - 1,
    }))}],
  };
  const fixtures = JSON.parse(readFileSync(new URL('../examples/web-catalog.json', import.meta.url), 'utf8'));
  const radar = fixtures.find(recipe => recipe.family === 'radar' && recipe.id === 'basic');
  const parallel = fixtures.find(recipe => recipe.family === 'parallel' && recipe.id === 'basic');
  const cases = [{data: dated, options}, radar, { ...parallel, options: { ...parallel.options, axes: {} } }];

  for (const {data, options} of cases) {
    const ticks = [];
    const content = {axisLabel: {text: context => {
      ticks.push(context);
      return context.tick.value === undefined ? 'Label ' + context.defaultText : 'Raw ' + context.tick.value;
    }}};
    const result = renderChartSvg(data, options, {instanceId: data.type, content});
    assert.equal(result.status, 'ok');
    assert(ticks.length > 0);
    assert(result.value.includes(data.type === 'radar' ? 'Label ' : 'Raw '));
    assert(ticks.every(context => Object.isFrozen(context.tick)));
    if (data.type === 'line') {
      assert(ticks.some(context => context.axis === 'x' && context.tick.type === 'time' && context.tick.value === start));
      assert(ticks.some(context => context.axis === 'y' && context.tick.type === 'number' && context.tick.value === 0));
    }
    if (data.type === 'radar') assert(ticks.some(context => context.axis === 'y' && context.tick.value === undefined));
    if (data.type === 'parallel') assert(ticks.some(context => context.axis === 'y' && context.tick.type === 'number' && Number.isFinite(context.tick.value)));
  }
});
test('forced labels are bounded, truncation preserves text, and hidden axes omit titles', () => {
  const labels = Array.from({length: 64}, (_, index) => ({id: String(index), label: 'Long category ' + index}));
  const sample = {
    type: 'line',
    axes: {x: {type: 'category', values: labels}, y: {type: 'linear'}},
    series: [{id: 's', name: 'S', data: labels.map(({id}) => ({id, x: id, y: Number(id)}))}],
  };
  const settings = {width: 320, height: 240, appearance: {dataLabels: true, labelLimit: 12}};
  const content = {dataLabel: {text: context => 'Measurement ' + context.defaultText + ' units'}};
  const render = options => {
    const result = renderChartSvg(sample, options, {instanceId: 'labels', content});
    assert.equal(result.status, 'ok');
    return result.value;
  };
  const auto = render(settings);
  const all = render({...settings, axes: {x: {labels: {layout: 'all'}}}});
  const trimmed = render({...settings, appearance: {...settings.appearance, dataLabelLayout: 'truncate'}});
  assert((all.match(/data-axis-label=/g) ?? []).length > (auto.match(/data-axis-label=/g) ?? []).length);
  assert((trimmed.match(/data-label=/g) ?? []).length <= 12);
  assert.match(trimmed, /<title>Measurement 0 units<\/title>[^<]*…/);
  assert(!render({...settings, axes: {x: {visible: false, title: 'Hidden title'}}}).includes('Hidden title'));
  assert.equal(renderChartSvg(sample, {appearance: {dataLabelLayout: 'invalid'}}, {instanceId: 'invalid'}).status, 'invalid');
});
test('all browser render callbacks remain dormant during SSR import/render',()=>{
  let renders=0;const render=()=>{renders++;throw Error('DOM unavailable')},text=c=>c.defaultText,content=Object.fromEntries(['title','axisLabel','dataLabel','legend','tooltip'].map(k=>[k,{text,render}]));assert.equal(renderChartSvg(data,options,{instanceId:'pure',content}).status,'ok');assert.equal(renders,0);
});
test('content capabilities reject invalid shapes and getters without executing them',()=>{
  let reads=0;const accessor={};Object.defineProperty(accessor,'title',{enumerable:true,get(){reads++;return{text:c=>c.defaultText}}});
  for(const content of [null,false,0,'',[],accessor,{unknown:{}},{title:()=>''},{title:{render(){}}},{title:{text:'bad'}},{title:{text(){return''},unknown:true}},{onError:false},{[Symbol('hidden')]:()=>''}]){
    assert.throws(()=>ownContent(content));const result=renderChartSvg(data,options,{instanceId:'invalid',content});assert.equal(result.status,'invalid');assert.equal(result.diagnostic.reason,'INVALID_CONTENT_PORTS');
  }assert.equal(reads,0);
});
test('throwing, asynchronous and oversized text is contained with a diagnostic and portable default',async()=>{
  for(const text of [()=>{throw Error('consumer failure')},()=>Promise.reject(Error('async is unsupported')),()=>({html:'<img>'}),()=> 'x'.repeat(4097)]){
    const errors=[],ports=ownContent({title:{text},onError:e=>errors.push(e)}),context=Object.freeze({family:'line',locale:'en',defaultText:'Safe default',description:''});assert.equal(contentText(ports,'title',context),'Safe default');assert.equal(errors[0].path,'content.title');assert.equal(errors[0].reason,'CONTENT_TEXT_FAILED');
  }await new Promise(resolve=>setImmediate(resolve));
});
test('plain data/options still reject capabilities; aggregate annotation context does not invent point identity',()=>{
  assert.equal(renderChartSvg(data,{...options,content:{title:()=>''}},{instanceId:'plain'}).status,'invalid');
  const gauge={type:'gauge',value:72,domain:[0,100]},seen=[];
  const result=renderChartSvg(gauge,{appearance:{dataLabels:true}},{instanceId:'gauge',content:{dataLabel:{text:c=>{seen.push(c);return c.defaultText+' units'}}}});assert.equal(result.status,'ok');assert(seen.length>0);assert(seen.some(c=>c.annotation));assert(seen.filter(c=>c.annotation).every(c=>c.observation===undefined));
});
test('recursive pure callbacks and diagnostics cannot create an unbounded render loop',()=>{
  let calls=0,notifications=0;const content={title:{text:()=>{calls++;assert.equal(renderChartSvg(data,options,{instanceId:'nested',content}).status,'ok');return 'Resolved title'}},onError:()=>{notifications++;assert.equal(renderChartSvg(data,options,{instanceId:'diagnostic',content}).status,'ok')}};
  const result=renderChartSvg(data,options,{instanceId:'outer',content});assert.equal(result.status,'ok');assert(result.value.includes('Resolved title'));assert.equal(calls,1);assert.equal(notifications,1);
});

test('framework content validation copies safe descriptors and malformed SSR titles use the default',()=>{
  let reads=0;const getter={};Object.defineProperty(getter,'title',{enumerable:true,get(){reads++;throw Error('getter must not run')}});
  const nested={title:Object.defineProperty({text:()=>''},'render',{enumerable:true,get(){reads++;throw Error('nested getter')}})};
  for(const input of [getter,nested,null,false,{title:{text:3}}]){const result=validateChartContent(input);assert.equal(result.status,'invalid');assert.equal(result.diagnostic.reason,'INVALID_CONTENT_PORTS');assert.equal(formatChartTitle(data,options,input),'Original title');}
  const source={title:{text:c=>c.defaultText}},result=validateChartContent(source);assert.equal(result.status,'ok');assert(Object.isFrozen(result.value));assert(Object.isFrozen(result.value.title));assert.notEqual(result.value,source);assert.equal(reads,0);
});
