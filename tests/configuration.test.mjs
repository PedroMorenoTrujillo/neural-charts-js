import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateOptions} from '../dist/planning.js';
import {resolveResponsive} from '../dist/responsive.js';
import {numberFormatter,dateFormatter,tickFormatter} from '../dist/format.js';
import {renderChartSvg, exportChartCsv} from '../dist/index.js';

test('responsive rules restore base options and merge nested axes without mutating inputs', () => {
  const base={height:380,legend:{position:'right'},axes:{x:{title:'Month',visible:true},y:{title:'Value'}},responsive:[{maxWidth:430,options:{height:280,legend:{position:'bottom'},axes:{x:{visible:false}}}},{minWidth:320,maxWidth:375,options:{tooltip:{placement:'docked'}}}]};
  const before=JSON.stringify(base),checked=validateOptions(base);assert.equal(checked.status,'ok');
  const small=resolveResponsive(checked.value,350);assert.equal(small.height,280);assert.deepEqual(small.axes.x,{title:'Month',visible:false});assert.equal(small.axes.y.title,'Value');assert.equal(small.tooltip.placement,'docked');
  assert.equal(resolveResponsive(checked.value,430).height,280);assert.equal(resolveResponsive(checked.value,431).height,380);assert.equal(resolveResponsive(checked.value,900).legend.position,'right');assert.equal(JSON.stringify(base),before);
  for(const responsive of [null,{},[{minWidth:500,maxWidth:300,options:{}}],[{options:{width:400}}],[{options:{responsive:[]}}],[{options:{legend:{position:'bad'}}}],Array.from({length:33},()=>({options:{}}))])assert.equal(validateOptions({responsive}).status,'invalid');
});
test('number formatting is explicit, localized and does not round original exports', () => {
  assert.equal(numberFormatter({})(1234.5678901234),'1234.56789012');
  const options={locale:'es',formatting:{number:{style:'currency',currency:'EUR',maximumFractionDigits:2}}};
  assert.equal(validateOptions(options).status,'ok');assert.equal(numberFormatter(options)(1234.56789),new Intl.NumberFormat('es',options.formatting.number).format(1234.56789));
  assert.equal(numberFormatter({formatting:{number:{style:'percent',maximumFractionDigits:1}}})(.125),'12.5%');
  for(const number of [{style:'currency'},{style:'decimal',currency:'EUR'},{style:'currency',currency:'bad'},{minimumFractionDigits:4,maximumFractionDigits:1},{maximumFractionDigits:1.5},{notation:'bad'},{useGrouping:'yes'},{signDisplay:'bad'},{foo:true}])assert.equal(validateOptions({formatting:{number}}).status,'invalid');
  const data={type:'line',axes:{x:{type:'linear'},y:{type:'linear'}},series:[{id:'s',name:'Series',data:[{id:'p',x:1,y:1234.5678901234}]}]};
  const svg=renderChartSvg(data,{...options,appearance:{dataLabels:true},accessibility:{description:'A <safe> description'}},{instanceId:'format'});assert.equal(svg.status,'ok');assert(svg.value.includes('A &lt;safe&gt; description'));assert(svg.value.includes(numberFormatter(options)(1234.5678901234)));
  assert(exportChartCsv(data).value.includes('1234.5678901234'));
});
test('accessibility options reject ambiguous IDs and invalid policies', () => {
  assert.equal(validateOptions({accessibility:{keyboard:false,announceDataChanges:true,description:'Overview',seriesDescriptions:[{id:'s',description:'Forecast'}],pointDescriptions:[{id:{seriesId:'s',pointId:'p'},description:'Holiday'}]}}).status,'ok');
  for(const accessibility of [{keyboard:'no'},{announceDataChanges:1},{seriesDescriptions:[{id:'s',description:'A'},{id:'s',description:'B'}]},{pointDescriptions:[{id:{seriesId:'s'},description:'Incomplete'}]},{description:null},{extra:true}])assert.equal(validateOptions({accessibility}).status,'invalid');
});
test('date formatting has deterministic UTC default and validates timezone/fields', () => {
  const value=Date.UTC(2026,2,29,1,30),options={locale:'es',formatting:{date:{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}}};
  assert.equal(dateFormatter(options)(value),new Intl.DateTimeFormat('es',{...options.formatting.date,timeZone:'UTC'}).format(value));
  const madrid={...options,formatting:{date:{...options.formatting.date,timeZone:'Europe/Madrid'}}};assert.notEqual(dateFormatter(madrid)(value),dateFormatter(options)(value));
  const label=tickFormatter({...options,formatting:{...options.formatting,number:{style:'currency',currency:'EUR'}}});assert.equal(label({label:'old',value,type:'time'}),dateFormatter(options)(value));assert.equal(label({label:'1234.56789'}),'1234.56789');
  for(const date of [{timeZone:'Not/A_Timezone'},{hourCycle:'invalid'},{weekday:'numeric'},{minute:3},{unknown:true}])assert.equal(validateOptions({formatting:{date}}).status,'invalid');
});
test('stable series styles render real dash and marker shapes and reject unsafe styles', () => {
  const data={type:'line',axes:{x:{type:'linear'},y:{type:'linear'}},series:[{id:'s',name:'Series',data:[{id:'a',x:1,y:2},{id:'b',x:2,y:3}]}]};
  for(const marker of ['circle','square','diamond','triangle']) {
    const options={appearance:{series:[{id:'s',color:'#b32f42',dash:'dashed',marker,markerRadius:5}]}};
    const svg=renderChartSvg(data,options,{instanceId:'style'});assert.equal(svg.status,'ok');assert(svg.value.includes('stroke-dasharray="6 4"'));assert(svg.value.includes('#b32f42'));assert(svg.value.includes(marker==='circle'?'<circle':marker==='square'?'<rect':'<polygon'));
  }
  for(const series of [[{id:'s',color:'url(https://bad)'}],[{id:'s',dash:'bad'}],[{id:'s',marker:'bad'}],[{id:'s',markerRadius:0}],[{id:'s',fillOpacity:2}],[{id:'s'},{id:'s'}]])assert.equal(validateOptions({appearance:{series}}).status,'invalid');
});
test('axis policies and legend policies validate and render without putting presentation into data',()=>{
  const data={type:'line',axes:{x:{type:'linear'},y:{type:'linear'}},series:[{id:'s',name:'Series',data:[{id:'a',x:1,y:2000},{id:'b',x:2,y:3000}]}]};
  const options={axes:{x:{labels:{rotation:-45,maxLines:1,maxCharacters:8},numberFormat:{minimumFractionDigits:2}},y:{numberFormat:{notation:'compact'}}},legend:{interactive:false,reverse:true,maxLabelCharacters:8,itemSpacing:12}};
  const svg=renderChartSvg(data,options,{instanceId:'axis'});assert.equal(svg.status,'ok');assert(svg.value.includes('rotate(-45'));assert(svg.value.includes('1.00'));assert(svg.value.includes('2K'));
  for(const axes of [{x:{labels:{rotation:100}}},{y:{labels:{maxLines:0}}},{x:{labels:{maxCharacters:2}}},{y:{numberFormat:{currency:'EUR'}}},{secondaryY:{labels:{extra:true}}}])assert.equal(validateOptions({axes}).status,'invalid');
  for(const legend of [{interactive:'false'},{reverse:1},{maxLabelCharacters:1},{itemSpacing:-1}])assert.equal(validateOptions({legend}).status,'invalid');
  for(const pattern of ['diagonal','dots','crosshatch'])assert.equal(validateOptions({appearance:{series:[{id:'s',pattern}]}}).status,'ok');assert.equal(validateOptions({appearance:{series:[{id:'s',pattern:'external'}]}}).status,'invalid');
});

test('configuration rejects malformed palettes, accessibility content and selection with actionable diagnostics', () => {
  const point = { seriesId: 's', pointId: 'a' };
  for (const [options, reason] of [
    [{ legend: [] }, 'OBJECT_REQUIRED'],
    [{ layout: 1 }, 'OBJECT_REQUIRED'],
    [{ appearance: { colors: [] } }, 'HEX_PALETTE_REQUIRED'],
    [{ appearance: { colors: Array(65).fill('#445577') } }, 'HEX_PALETTE_REQUIRED'],
    [{ appearance: { bandColors: '#445577' } }, 'HEX_PALETTE_REQUIRED'],
    [{ appearance: { points: [{ ...point, seriesId: '', color: '#445577' }] } }, 'INVALID_POINT_STYLE_ID'],
    [{ appearance: { points: [{ ...point, pointId: 'p'.repeat(257), color: '#445577' }] } }, 'INVALID_POINT_STYLE_ID'],
    [{ accessibility: { seriesDescriptions: [{ id: 's' }] } }, 'TEXT_REQUIRED'],
    [{ accessibility: { seriesDescriptions: [{ id: '', description: 'Missing identity' }] } }, 'INVALID_SERIES_ID'],
    [{ annotations: [{ id: 'missing-point', text: 'Missing point' }] }, 'ANNOTATION_IDENTITY_REQUIRED'],
    [{ animation: { revision: -1 } }, 'INVALID_ANIMATION_REVISION'],
    [{ animation: { revision: Number.MAX_SAFE_INTEGER + 1 } }, 'INVALID_ANIMATION_REVISION'],
    [{ hiddenSeriesIds: 's' }, 'INVALID_HIDDEN_IDS'],
    [{ hiddenSeriesIds: ['s', 3] }, 'INVALID_HIDDEN_IDS'],
    [{ selectedPoints: point }, 'INVALID_SELECTION'],
    [{ selectedPoints: [{ seriesId: 's' }] }, 'INVALID_SELECTION'],
    [{ selectedPoints: [{ ...point, pointId: 3 }] }, 'INVALID_SELECTION'],
    [{ referenceBandStyles: [{ id: 'missing', opacity: 0.4 }] }, 'INVALID_REFERENCE_BAND_STYLE_ID'],
  ]) {
    const result = validateOptions(options);
    assert.equal(result.status, 'invalid', JSON.stringify(options));
    assert.equal(result.diagnostic.reason, reason);
  }
  const options = {
    appearance: { colors: Array(64).fill('#445577'), points: [{ ...point, color: '#445577' }] },
    accessibility: { seriesDescriptions: [{ id: 's', description: 'Measurements' }] },
    annotations: [{ id: 'first', point, text: 'First reading', dx: -5, dy: 0 }],
    animation: { revision: Number.MAX_SAFE_INTEGER },
    hiddenSeriesIds: [],
    selectedPoints: [point],
  };
  const result = validateOptions(options);
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.value.selectedPoints, [point]);
  assert(Object.isFrozen(result.value.selectedPoints[0]));
});
