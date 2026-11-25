import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {describeChartData, formatChartTitle, renderChartSvg} from '../dist/index.js';
import {serializeChartExport} from '../dist/export-layout.js';
import {displayNumber, formatTimeDuration, numberFormatter} from '../dist/format.js';
import {planWebChart, planWith, snapshot, validateOptions} from '../dist/planning.js';
import {chartSvg, plotInsets} from '../dist/svg.js';
import {intervalLabelBounds, observationShape} from '../dist/observation-shape.js';
import {markerPaint, patternDefinition, pointColors} from '../dist/series-style.js';
import {chartMotion} from '../dist/animation.js';
import {horizontalViewportScroll, viewportZoomLevel} from '../dist/viewport-scroll.js';
import {textColorOnSurface} from '../dist/text-contrast.js';

const size={width:480,height:280};
const line={type:'line',axes:{x:{type:'linear'},y:{type:'linear'}},
  series:[{id:'measured',name:'Measured',data:[{id:'first',x:0,y:2},{id:'second',x:2,y:4}]}]};
const catalog=JSON.parse(readFileSync(new URL('../examples/web-catalog.json',import.meta.url),'utf8'));
const recipe=(family,id='basic')=>{
  const item=catalog.find(item=>item.family===family&&item.id===id);
  assert.ok(item,family+'/'+id);
  return item;
};
function value(result){
  assert.equal(result.status,'ok',JSON.stringify(result.diagnostic));
  return result.value;
}
function render(data,options={},settings={}){
  return value(renderChartSvg(data,options,{instanceId:'remaining-contract',composition:'plot',...settings}));
}
function assertDiagnostic(result,reason,path){
  assert.equal(result.status,'invalid');
  assert.equal(result.diagnostic.reason,reason);
  if(path!==undefined)assert.equal(result.diagnostic.path,path);
}
const frame=(data,options={})=>value(planWebChart(data,options,size));

test('SSR plans option ownership before adapting a chart and rejects presentation fields in source data',()=>{
  const wrapped=(data,options={})=>planWith(()=>assert.fail('Invalid inputs must not invoke planning'),data,options,size);
  assertDiagnostic(wrapped({...line,type:'unknown'}),'UNSUPPORTED_CHART_TYPE','data.type');
  assertDiagnostic(wrapped({...line,title:'Owned by options'}),'PRESENTATION_IN_DATA','data.title');
  assertDiagnostic(wrapped(line,{legend:[]}),'OBJECT_REQUIRED');
  assertDiagnostic(wrapped(line,{colorAxis:{type:'continuous',stops:[{at:0,color:'#ffffff'},{at:1,color:'#000000'}]}}),
    'COLOR_AXIS_UNSUPPORTED','options.colorAxis');
  assertDiagnostic(wrapped(line,{appearance:{waterfall:{positiveColor:'#116644'}}}),
    'WATERFALL_STYLE_UNSUPPORTED','options.appearance.waterfall');
  const customFailure=planWith(()=>{throw 'Adapter interrupted';},line,{},size);
  assertDiagnostic(customFailure,'INVALID_DATA','data');
  const unavailable=new Proxy({}, {ownKeys(){throw 'Options interrupted';}});
  assertDiagnostic(validateOptions(unavailable),'INVALID_OPTIONS');
});

test('detached source snapshots accept plain records and enforce structural limits before planning',()=>{
  const prototypeFree=Object.assign(Object.create(null),line);
  const owned=snapshot(prototypeFree);
  assert.notEqual(owned,prototypeFree);
  assert.deepEqual(owned.series,line.series);
  assert.throws(()=>snapshot(new Date(0)),/PLAIN_DATA_REQUIRED/);
  let tooDeep={};
  for(let i=0;i<66;i++)tooDeep={child:tooDeep};
  assert.throws(()=>snapshot(tooDeep),/INPUT_LIMIT/);
});

test('table pagination preserves source labels, raw values and visibility through hidden-model changes',()=>{
  const categories=[{id:'early'},'late'];
  const sample={
    type:'line',axes:{x:{type:'category',values:categories},y:{type:'linear'}},
    series:[{id:'empty',data:[]},{id:'observed',name:'Observed',data:[
      {id:'zero',x:'early',y:0},{id:'null',x:'late',y:null},
    ]}],
  };
  const owned=snapshot(sample);
  const baseline=value(describeChartData(owned));
  assert.equal(baseline.rows.length,2);
  assert.deepEqual(baseline.rows.map(row=>row[1]),['early','late']);
  assert(baseline.rows[0].includes('0'));
  assert(baseline.rows[1].includes('Missing measurement'));
  const hidden=value(describeChartData(owned,['observed']));
  assert(hidden.rows.every((row,i)=>row.at(-1)!==baseline.rows[i].at(-1)));
  for(const ids of [['empty'],['observed','empty'],[]]){
    const page=value(describeChartData(owned,ids,'es',{limit:1,offset:1}));
    assert.equal(page.totalRows,2);
    assert.equal(page.rows.length,1);
    assert.equal(page.rows[0][1],'late');
  }
  assert.deepEqual(value(describeChartData(owned)).rows,baseline.rows);
  for(const ids of [null,'observed',['observed',9]])assertDiagnostic(describeChartData(owned,ids),'INVALID_HIDDEN_IDS');
});

test('source table retains fallback names and grouping for partially labeled data rows',()=>{
  const unlabeled=value(describeChartData({...line,series:[{id:'unlabeled',data:line.series[0].data}]}));
  assert(unlabeled.rows.every(row=>row[0]==='unlabeled'));
  const grouped=value(describeChartData({type:'violin',groups:[
    {id:'id-fallback',samples:[{id:'negative',value:-3}]},
    {samples:[{id:'measured',value:0}]},
  ]}));
  assert.deepEqual(grouped.rows.map(row=>row[0]),['id-fallback','groups']);
  assert(grouped.rows[0].includes('-3'));
  assert(grouped.rows[1].includes('0'));
});

test('portable titles identify transformed horizontal columns and survive a failed consumer callback',()=>{
  const observed=[];
  const data={type:'column'}, options={layout:{orientation:'horizontal'}};
  const title=formatChartTitle(data,options,{title:{text(context){observed.push(context);return 'Orders';}}});
  assert.equal(title,'Orders');
  assert.deepEqual(observed,[{family:'bar',locale:'en',defaultText:'Chart',description:''}]);
  assert(Object.isFrozen(observed[0]));
  let diagnostic;
  const content={title:{text(){throw Error('Title unavailable');}},onError(error){diagnostic=error;throw Error('Consumer handler');}};
  assert.equal(formatChartTitle(data,options,content),'Chart');
  assert.equal(diagnostic.path,'content.title');
  assert.equal(diagnostic.reason,'CONTENT_TEXT_FAILED');
  assert.equal(formatChartTitle(data,options,{legend:{text:()=>assert.fail('Title does not call the legend')}}),'Chart');
});

test('SVG export respects heading alignment, blank paragraphs and dotted line legends',()=>{
  const options={title:'Portable title',description:'First paragraph\n\nThird paragraph',direction:'rtl',
    appearance:{titleStyle:{align:'left'},descriptionStyle:{align:'right'},series:[{id:'measured',dash:'dotted'}]}};
  const svg=render(line,options,{composition:'chart'});
  assert.match(svg,/<text x="20"[^>]+text-anchor="end" direction="rtl">Portable title<\/text>/);
  assert.match(svg,/<text[^>]+text-anchor="start" direction="rtl">First paragraph<\/text>/);
  assert.match(svg,/<text[^>]+text-anchor="start" direction="rtl"><\/text>/);
  assert.match(svg,/<g data-export-legend="measured"[^>]*>.*?<path[^>]+stroke-dasharray="1 3"/s);
  const planned=frame(line);
  const portable=serializeChartExport(planned,{legend:{position:'right'}},'right-side');
  assert.match(portable,/<g data-export-legend="measured"/);
  assert.match(portable,/<title id="right-side-export-title">Chart<\/title>/);
});

test('SVG reserves default space for rotated labels and draws reference bands without optional styling',()=>{
  const insets=plotInsets('line','vertical',{axes:{x:{labels:{rotation:75}}}});
  assert(insets.bottom>plotInsets('line').bottom);
  const svg=render(line,{referenceBands:[{id:'window',axis:'x',from:0.25,to:1.5}],
    axes:{x:{title:'Time',titleStyle:{color:'#224466'}}}});
  assert.match(svg,/<rect data-reference-band="window"[^>]*fill-opacity="\.12"><\/rect>/);
  assert.match(svg,/<text[^>]+fill="#224466" font-size="12"[^>]*>Time<\/text>/);
});

test('SVG paints scatter marker shapes with their configured radius and preserves unstyled strokes',()=>{
  const data={...line,type:'scatter'};
  const portrait=render(data,{appearance:{series:[{id:'measured',marker:'square',markerRadius:7,markerFill:'#445566'}]}});
  assert.match(portrait,/<rect[^>]+width="14" height="14" fill="#445566" data-observation="0"\/>/);
  const source=recipe('sankey');
  const styled=render(source.data,{...source.options,appearance:{...source.options.appearance,
    series:[{id:'flow',fillOpacity:.42}]}});
  assert.match(styled,/<g data-series="flow"[^>]*>.*?<path[^>]*fill-opacity="0\.42"/s);
});

test('full donut selection paints both boundaries and interval labels ignore zero-duration marks',()=>{
  const donut=frame({type:'donut',data:[{id:'whole',label:'Whole',value:10}]});
  const [point]=donut.observations;
  const shape=observationShape(point);
  assert.equal(shape.tag,'path');
  assert.match(shape.attributes.d,/ZM/);
  assert.equal((shape.attributes.d.match(/A/g)??[]).length,4);
  assert.equal(shape.attributes['fill-rule'],'evenodd');
  assert.equal(observationShape({...point,hit:{...point.hit,end:point.hit.start}}),undefined);
  const intervals=frame({type:'xrange',axes:{x:{type:'linear'},y:{type:'category',values:[{id:'row',label:'Row'}]}},
    series:[{id:'s',name:'Intervals',data:[{id:'instant',rowId:'row',start:1,end:1},{id:'interval',rowId:'row',start:2,end:4}]}]});
  const bounds=intervalLabelBounds(intervals).get('s');
  assert.equal(bounds.has('instant'),false);
  assert(bounds.get('interval').width>0);
  const original=intervals.series[0];
  const noOutline={...intervals,series:[{...original,commands:undefined}]};
  assert.equal(intervalLabelBounds(noOutline).size,0);
});

test('localized duration formatting stays on the same raw units after formatter-cache rotation',()=>{
  for(const [duration,unit,amount] of [[1.5,'millisecond',1.5],[1000,'second',1],[60000,'minute',1],[3600000,'hour',1],[86400000,'day',1]]){
    const oracle=new Intl.NumberFormat('es',{style:'unit',unit,unitDisplay:'short',maximumFractionDigits:2});
    assert.equal(formatTimeDuration({locale:'es'},duration),oracle.format(amount));
  }
  const number={maximumFractionDigits:2}, before=numberFormatter({locale:'es',formatting:{number}})(1.25);
  for(let i=0;i<66;i++){
    const locale='de-DE-x-'+i;
    assert.equal(numberFormatter({formatting:{locale,number}})(1.25),new Intl.NumberFormat(locale,number).format(1.25));
  }
  assert.equal(numberFormatter({locale:'es',formatting:{number}})(1.25),before);
  assert.equal(displayNumber(Infinity),'Infinity');
});

test('optional renderer settings preserve the default geometry of pictorials, bands and uncertainty',()=>{
  const pictorial=recipe('pictorial');
  const pictured=frame(pictorial.data);
  assert.equal(pictured.family,'pictorial');
  const measured=new Map(pictured.observations.map(point=>[JSON.stringify(point.id),point.value]));
  for(const series of pictorial.data.series)for(const point of series.data){
    const identity=JSON.stringify({seriesId:series.id,pointId:point.id});
    assert.equal(measured.get(identity),point.y===null?undefined:point.y);
  }
  assert(pictured.pictorialGlyphs.every(glyph=>glyph.backgroundCommands.length>0));

  const fan=recipe('fan');
  const uncertainty=frame(fan.data,{appearance:{centerName:'Forecast center'}});
  assert.match(render(fan.data,{appearance:{centerName:'Forecast center'}},{composition:'chart'}),
    /<title>Forecast center<\/title>/);
  assert.equal(uncertainty.legend.find(item=>item.id==='center').name,'Forecast center');
  assert.equal(uncertainty.observations.find(point=>point.id.seriesId==='center').value,fan.data.data[0].value);

  const contour=recipe('contour');
  const level={id:'isolated-level',value:14};
  assert.deepEqual(frame(contour.data,{layout:{levels:[level]}}).contour.levels,[level]);
  assertDiagnostic(planWebChart(contour.data,{},size),'CONTOUR_LEVELS_MUST_INCREASE','spec.contour.levels');

  const gauge=frame({type:'gauge',value:0,domain:[0,100],bands:[{id:'range',label:'In range',from:0,to:80}]});
  assert.equal(gauge.observations[0].value,0);
  assert.equal(gauge.series.find(series=>series.id==='band:range').color,'#3679b5');
});

test('dense heatmaps retain requested full row labels and limit only numeric data annotations',()=>{
  const {data,options}=recipe('heatmap','dense');
  const all={...options,axes:{y:{labels:{layout:'all'}}},appearance:{dataLabels:true,dataLabelLayout:'all',labelLimit:2}};
  const sample=render(data,all);
  const seen=new Set([...sample.matchAll(/data-axis-coordinate="[^"]*" aria-label="([^"]*)"/g)].map(x=>x[1]));
  for(const row of data.axes.y.values)assert(seen.has(row.label??row.id),row.id);
  assert.equal((sample.match(/data-label=""/g)??[]).length,2);
  const unlimited=render(data,{...all,appearance:{dataLabels:true,dataLabelLayout:'all'}});
  assert((unlimited.match(/data-label=""/g)??[]).length>2);
});

test('SVG custom axis text receives raw density values and original horizontal price bands',()=>{
  const bell=recipe('bellcurve'),volume=recipe('vbp');
  const opts={formatting:{number:{minimumFractionDigits:8,maximumFractionDigits:8}}};
  for(const {family,data,options} of [bell,volume]){
    const seen=[];
    const svg=render(data,{...options,...opts},{content:{axisLabel:{text:context=>{
      seen.push(context);
      return (context.axis==='y'?'Value ':'Category ')+context.index;
    }}}});
    assert.match(svg,/>Value /);
    const measured=seen.filter(context=>context.axis==='y'&&context.tick.type==='number'&&context.tick.value>0);
    assert(measured.length>0);
    for(const context of measured)assert.match(context.defaultText,/\.\d{8}$/);
    if(family==='vbp')assert(seen.some(context=>context.axis==='x'&&context.tick.label.includes('–')));
  }
});

test('secondary SVG ticks receive independent formatting and annotations follow visible observation IDs',()=>{
  const data={type:'mixed',axes:{
    x:{type:'category',values:[{id:'a'},{id:'b'}]},
    y:{type:'linear',domain:[0,8]},secondaryY:{type:'linear',domain:[0,20]},
  },series:[
    {id:'first',name:'First',type:'column',data:[{id:'point',x:'a',y:3}]},
    {id:'second',name:'Second',type:'line',yAxis:'secondary',data:[{id:'point',x:'a',y:12},{id:'end',x:'b',y:15}]},
  ]};
  const options={formatting:{number:{minimumFractionDigits:3,maximumFractionDigits:3}},
    annotations:[{id:'retained',point:{seriesId:'first',pointId:'point'},text:'Retained'},
      {id:'hidden',point:{seriesId:'second',pointId:'point'},text:'Unavailable after hiding'}]};
  const seen=[];
  render(data,options,{content:{axisLabel:{text:context=>{seen.push(context);return context.defaultText;}}}});
  assert(seen.some(context=>context.axis==='secondaryY'&&/\.\d{3}$/.test(context.defaultText)));
  const reduced=value(planWebChart(data,options,size,['second']));
  const svg=chartSvg(reduced,options,'visible-only');
  assert.match(svg,/data-annotation="retained"/);
  assert.doesNotMatch(svg,/data-annotation="hidden"|Unavailable after hiding/);
});

test('rendering preserves radial fill opacity, contrast on bright patterns and signed waterfall paints',()=>{
  const data={type:'donut',data:[{id:'share',label:'Share',value:50}]};
  const svg=render(data,{appearance:{series:[{id:'share',fillOpacity:.42,pattern:'dots',color:'#eeeeee'}]}});
  assert.match(svg,/<pattern[^>]*>.*?<circle[^>]+fill="#172438"/s);
  assert.match(svg,/<g data-series="share">.*?<path[^>]*fill-opacity="0\.42"/s);
  assert.equal(patternDefinition('disabled','#eeeeee','none'),'');
  assert.equal(markerPaint({markerFill:'#334455'},'#667788'),'fill="#334455"');
  const waterfall={type:'waterfall',series:[{id:'period',name:'Period',data:[
    {id:'missing',type:'delta',value:null},{id:'one',type:'delta',value:1},
    {id:'two',type:'delta',value:-2},{id:'total',type:'total'},
  ]}]};
  const paints=pointColors({appearance:{waterfall:{positiveColor:'#aabbcc',negativeColor:'#112233',totalColor:'#dd5566'}}},waterfall);
  assert.deepEqual([...paints.values()],['#aabbcc','#112233','#dd5566']);
  assert.doesNotMatch(JSON.stringify([...paints.keys()]),/missing/);
  const options={appearance:{points:[{seriesId:'share',pointId:'share',color:'#eeeeee'}]}};
  assertDiagnostic(renderChartSvg(data,options,{instanceId:'unsupported-point-colors'}),'POINT_STYLE_UNSUPPORTED_FOR_TYPE','options.appearance.points');
  assert.equal(frame(line,{appearance:{points:[]}}).observations.length,2);
});

test('horizontal mark animation starts at its measured baseline and cancels the prior animation',()=>{
  const columns={type:'column',axes:{x:{type:'category',values:[{id:'a'},{id:'b'}]},y:{type:'linear',domain:[-2,4]}},
    series:[{id:'measured',name:'Measured',data:[{id:'first',x:'a',y:-1},{id:'second',x:'b',y:3}]}]};
  let current=frame(columns,{layout:{orientation:'horizontal'}});
  const baseline=current.labels.find(tick=>tick.value===0).x;
  const calls=[],animations=[];
  const animate=(keyframes,options)=>{
    calls.push({keyframes,options});
    const animation={cancels:0,cancel(){this.cancels++;}};
    animations.push(animation);
    return animation;
  };
  let marks={querySelector:()=>null,getBBox:()=>({x:10,y:20}),animate};
  const window={matchMedia:()=>({matches:false})},target={animate,querySelector:()=>marks};
  const motion=chartMotion(window,target,()=>current);
  const options={animation:{enabled:true}};
  motion.apply(options,true);
  assert.equal(calls[0].options.duration,240);
  assert.equal(calls[0].keyframes[0].transform,'scaleX(0)');
  assert.equal(calls[0].keyframes[0].transformOrigin,(baseline-10)+'px 0px');
  current=frame(recipe('scatter').data);
  motion.apply(options,true);
  assert.equal(animations[0].cancels,1);
  assert.equal(calls[1].options.duration,160);
  assert.deepEqual(calls[1].keyframes,[{opacity:.55},{opacity:1}]);
  animations[1].onfinish();
  assert.equal(animations[1].cancels,1);
  motion.apply({animation:{enabled:true,duration:0}},true);
  marks=null;
  motion.apply(options,true);
  assert.equal(calls.length,2);
  motion.destroy();
});

test('viewport scroll treats a single category as one original slot and ignores expired IDs',()=>{
  const data={...line,
    axes:{...line.axes,x:{type:'category',values:[{id:'a'},{id:'b'},{id:'c'}]}},
    series:[{...line.series[0],data:[{id:'first',x:'a',y:2},{id:'second',x:'b',y:4},{id:'third',x:'c',y:6}]}],
  };
  const state=frame(data,{viewport:{axes:'x',value:{x:{firstId:'b',lastId:'b'}}}}).viewport;
  assert.equal(viewportZoomLevel(state),3);
  const scroll=horizontalViewportScroll(state,false);
  assert.equal(scroll.visible,1/3);
  assert.equal(scroll.position,1);
  assert.equal(scroll.delta(0),-1);
  assert.equal(scroll.delta(2),1);
  const expired={...state,value:{x:{firstId:'past',lastId:'past'}}};
  assert.equal(viewportZoomLevel(expired),1);
  assert.equal(horizontalViewportScroll(expired,false),undefined);
});

test('text contrast reaches a neutral when no intermediate tone passes against a mid-gray surface',()=>{
  assert.equal(textColorOnSurface('#ffffff','#777777',false),'#000000');
  assert.equal(textColorOnSurface('#000000','#747474',true),'#ffffff');
});
