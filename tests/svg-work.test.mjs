import test from 'node:test';
import assert from 'node:assert/strict';
import {pathData, chartSvg} from '../dist/svg.js';
import {planWebChart} from '../dist/index.js';
import {formatTimeDuration} from '../dist/format.js';

test('path serialization never caches mutable commands or a shallowly frozen command array', () => {
  const command = {type: 'L', x: 1, y: 2};
  const commands = Object.freeze(Array.from({length: 300}, () => command));
  assert(pathData(commands).includes('L1,2')); command.x = 3;
  assert(pathData(commands).includes('L3,2'));
  const frozen = Object.freeze(commands.map(c => Object.freeze({...c})));
  assert.equal(pathData(frozen), pathData(commands));
  assert.equal(pathData(frozen), pathData(frozen));
});

test('mixed charts draw persistent markers only for line-like series', () => {
  const data = {type: 'mixed', axes: {x: {type: 'category', values: [{id:'a', label:'A'}, {id:'b', label:'B'}]}, y: {type: 'linear'}},
    series: [
      {id:'bars', name:'Columns', type:'column', data:[{id:'a', x:'a', y:4}, {id:'b', x:'b', y:8}]},
      {id:'line', name:'Line', type:'line', data:[{id:'a', x:'a', y:5}, {id:'b', x:'b', y:7}]},
    ]};
  const options = {appearance: {markers: true}};
  const planned = planWebChart(data, options, {width: 640, height: 320});
  assert.equal(planned.status, 'ok');
  const frame = planned.value, svg = chartSvg(frame, options, 'mixed');
  for (const [index, point] of frame.observations.entries()) {
    const kind = point.id.seriesId === 'bars' ? 'rect' : 'circle';
    assert.match(svg, new RegExp('<' + kind + '[^>]*data-observation="' + index + '"'));
    if (kind === 'rect') assert.doesNotMatch(svg, new RegExp('<circle[^>]*data-observation="' + index + '"'));
  }
});

test('dense unmarked lines retain exact geometry and exports still render selected original IDs', () => {
  const data = {type: 'line', axes: {x: {type: 'linear'}, y: {type: 'linear'}}, series: [{id: 's', name: 'Source', data: Array.from({length: 2000}, (_, i) => ({id: 'p' + i, x: i, y: i % 37}))}]};
  const planned = planWebChart(data, {appearance: {markers: false}}, {width: 640, height: 320}); assert.equal(planned.status, 'ok');
  const frame = planned.value, before = JSON.stringify(frame), plain = chartSvg(frame, {appearance: {markers: false}}, 'exact');
  assert(plain.includes(pathData(frame.series[0].commands))); assert(!plain.includes('<circle'));
  const selected = chartSvg(frame, {appearance: {markers: false}}, 'exact', {seriesId: 's', pointId: 'p1700'}, [{seriesId: 's', pointId: 'p1700'}]);
  assert(selected.includes('data-observation="1700"')); assert.equal(JSON.stringify(frame), before);
});

test('stack totals sit past the endpoint on horizontal and vertical value axes', () => {
  const category = {id:'a', label:'A'};
  for (const orientation of ['horizontal', 'vertical']) for (const reversed of [false, true]) {
    const data = {type:'column', axes:{x:{type:'category', values:[category]}, y:{type:'linear', reversed}}, series:[
      {id:'s1', name:'One', data:[{id:'p', x:'a', y:30}]},
      {id:'s2', name:'Two', data:[{id:'p', x:'a', y:70}]},
      {id:'s3', name:'Three', data:[{id:'p', x:'a', y:-20}]},
    ]};
    const options = {appearance:{stackLabels:true}, layout:{orientation, stacking:'sum'}};
    const result = planWebChart(data, options, {width:220, height:160});
    assert.equal(result.status, 'ok');
    const frame = result.value, svg = chartSvg(frame, options, 'totals');
    const marks = svg.match(/<g data-layer="marks"[\s\S]*?<g data-label=/);
    assert.ok(marks?.[0].endsWith('</g></g><g data-label='));
    for (const annotation of frame.annotations.filter(a => a.stackTotal)) {
      const {value, sign} = annotation.stackTotal;
      const label = svg.match(new RegExp('data-stack-total="' + value + '"[^>]*><text x="([^"]+)" y="([^"]+)"[^>]*text-anchor="([^"]+)"'));
      assert.ok(label, String(value));
      const [, x, y, anchor] = label, forward = (sign === 'positive') !== reversed;
      if (orientation === 'horizontal') {
        assert.equal(Number(y), annotation.y + 4);
        const outside = forward || annotation.x >= String(value).length * 7.5 + 3;
        const right = outside === forward;
        assert.equal(Number(x), annotation.x + (right ? 7 : -7));
        assert.equal(anchor, right ? 'start' : 'end');
      } else {
        assert.equal(Number(y), annotation.y + (forward ? -7 : 16));
      }
    }
  }
});

test('range emphasis uses both projected bounds and collapses coincident bounds', () => {
  for (const type of ['arearange', 'areasplinerange']) {
    const data = {type, axes:{x:{type:'linear'}, y:{type:'linear'}}, series:[{id:'s', name:'Range',
      data:[{id:'a', x:0, low:2, high:9}, {id:'b', x:1.5, low:7, high:7}, {id:'c', x:3, low:5, high:15}]}]};
    const result = planWebChart(data, {}, {width:480,height:260});
    assert.equal(result.status,'ok');
    const frame = result.value;
    for (const [i, point] of frame.observations.entries()) {
      const svg = chartSvg(frame, {}, 'bounds', point.id);
      const marker = new RegExp('<circle data-observation="' + i + '" cx="' + point.x + '" cy="([^"]+)"', 'g');
      const rendered = [...svg.matchAll(marker)].map(match => Number(match[1])).sort((a,b) => a-b);
      const expected = [...new Set(frame.series[0].commands.filter(command => command.x === point.x).map(command => command.y))].sort((a,b) => a-b);
      assert.equal(rendered.length, point.lowValue === point.highValue ? 1 : 2);
      assert.deepEqual(rendered, expected);
    }
  }
});

test('OHLC and HLC emphasize only the active price stroke after missing data', () => {
  for (const [type, size] of [['ohlc', 6], ['hlc', 4]]) {
    const data = {type, axes:{x:{type:'time'}, y:{type:'linear', reversed:true}}, series:[{id:'asset', name:'Asset',
      data:[
        {id:'first', x:1735776000000, open:100, high:102, low:99, close:101},
        {id:'gap', x:1735862400000, open:null, high:null, low:null, close:null},
        {id:'last', x:1735948800000, open:101, high:105, low:100, close:103},
      ]}]};
    const result = planWebChart(data, {}, {width:480,height:260});
    assert.equal(result.status, 'ok');
    const frame = result.value;
    const index = frame.observations.findIndex(point => point.id.pointId === 'last');
    assert.ok(index >= 0);
    const expected = pathData(frame.series[0].commands.slice(-size));
    const svg = chartSvg(frame, {}, 'active-price', frame.observations[index].id);
    assert.ok(svg.includes('<path data-observation="' + index + '" d="' + expected + '" fill="none"'));
    assert.ok(!svg.includes('<circle data-observation="' + index + '"'));
  }
});

test('timeline uses the event annotation instead of numeric timestamps', () => {
  const date = Date.UTC(2026, 2, 12);
  const data = {type:'timeline', axes:{x:{type:'time'}}, series:[{id:'releases', name:'Releases',
    data:[{id:'release', x:date, title:'Release'}, {id:'pilot', x:date + 86400000, title:'Pilot'}]}]};
  const options = {appearance:{dataLabels:true}};
  const result = planWebChart(data, options, {width:480,height:260});
  assert.equal(result.status, 'ok');
  const svg = chartSvg(result.value, options, 'timeline-labels');
  assert.match(svg, /data-label=""[^>]*><text[^>]*>.*Release/);
  assert.doesNotMatch(svg, new RegExp('>' + date + '<'));
  assert.doesNotMatch(chartSvg(result.value, {appearance:{dataLabels:false}}, 'timeline-no-labels'), /data-label=""/);
});

test('flame durations are centered in wide bars and omitted from narrow bars', () => {
  const data = {type:'flame', axes:{x:{type:'linear'}}, data:[
    {id:'root', label:'Root', start:0, end:1000},
    {id:'short', label:'Short', parentId:'root', start:4, end:5},
  ]};
  const options = {appearance:{dataLabels:true}};
  const result = planWebChart(data, options, {width:480,height:260});
  assert.equal(result.status, 'ok');
  const svg = chartSvg(result.value, options, 'flame-labels');
  assert.equal((svg.match(/data-label=""/g) ?? []).length, 1);
  const y = result.value.observations[0].y + 4;
  assert.match(svg, new RegExp('data-label=""[^>]*><text[^>]* y="' + y + '"'));
});

test('mixed charts render the secondary title on its own axis', () => {
  const data = {type:'mixed', axes:{x:{type:'category', values:[{id:'a', label:'A'},{id:'b',label:'B'}]},y:{type:'linear'},secondaryY:{type:'linear'}},
    series:[{id:'left',name:'Visits',type:'column',data:[{id:'a',x:'a',y:20}]},
      {id:'right',name:'Temperature',type:'line',yAxis:'secondary',data:[{id:'a',x:'a',y:7}]}]};
  const options = {axes:{secondaryY:{title:'Temperature'}}};
  const result = planWebChart(data,options,{width:260,height:240});
  assert.equal(result.status,'ok');
  assert.match(chartSvg(result.value,options,'axes'),/rotate\(90\)"[^>]+>Temperature<\/text>/);
  assert.doesNotMatch(chartSvg(result.value,{axes:{secondaryY:{title:'Temperature',visible:false}}},'hidden'),/>Temperature<\/text>/);
});

test('temporal durations display a readable unit in both locales', () => {
  assert.match(formatTimeDuration({locale:'es'}, 10800000), /^3\s+h/);
  assert.match(formatTimeDuration({locale:'en'}, 90000), /^1\.5\s+min/);
});
