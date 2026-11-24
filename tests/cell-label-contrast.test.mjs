import test from 'node:test';
import assert from 'node:assert/strict';
import {planWebChart} from '../dist/index.js';
import {chartSvg} from '../dist/svg.js';
import {catalog} from '../tooling/catalog.mjs';

test('cell labels meet 4.5:1 against their actual value color, opacity and custom surface', () => {
  const rgb = value => { const h=value.slice(1),hex=h.length===3?[...h].map(c=>c+c).join(''):h;return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255); };
  const luminance = value => value.map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
  for(const family of ['heatmap','tilemap'])for(const background of ['#ffffff','#111c2d','#203040'])for(const opacity of [1,.35]){
    const example=catalog.find(item=>item.family===family&&item.id==='basic');
    const options={...example.options,appearance:{...example.options.appearance,dataLabels:true},themeTokens:{background,foreground:'#ffffff',muted:'#cccccc',grid:'#596777',focus:'#ffd166'}};
    const result=planWebChart(example.data,options,{width:700,height:320});assert.equal(result.status,'ok');
    const frame={...result.value,series:result.value.series.map(series=>({...series,cells:series.cells?.map(cell=>({...cell,opacity}))}))};
    const svg=chartSvg(frame,options,'contrast');
    const labels=[...svg.matchAll(/<g data-label=""><text[^>]*fill="(#[a-f0-9]+)"[^>]*>/gi)].map(match=>match[1]);
    assert.equal(labels.length,frame.observations.length,'One visible eligible value label per cell in this bounded fixture');
    for(const [index,point]of frame.observations.entries()){
      const cell=frame.series.find(series=>series.id===point.id.seriesId).cells.find(cell=>cell.pointId===point.id.pointId);
      const surface=rgb(background),paint=rgb(cell.color),composited=paint.map((c,i)=>c*opacity+surface[i]*(1-opacity));
      const a=luminance(rgb(labels[index])),b=luminance(composited),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      assert(ratio>=4.5,`${family} ${cell.color} on ${background}, opacity ${opacity}: ${ratio}`);
    }
  }
});

test('selected heatmap values retain their text and an unfilled outline in SVG export', () => {
  const example = catalog.find(item => item.family === 'heatmap' && item.id === 'basic');
  for (const theme of ['light', 'dark']) {
    const options = {...example.options, theme, appearance: {...example.options.appearance, dataLabels: true}};
    const planned = planWebChart(example.data, options, {width: 700, height: 320});
    assert.equal(planned.status, 'ok');
    const selected = planned.value.observations[0];
    const svg = chartSvg(planned.value, options, 'heatmap-selection', undefined, [selected.id]);
    const outline = svg.match(/<polygon[^>]+data-observation="0"[^>]*stroke-width="2.5"[^>]*\/>/)?.[0];
    assert.ok(outline);
    assert.match(outline, /fill="none"/);
    assert.match(outline, new RegExp(theme === 'dark' ? 'stroke="#e5edf7"' : 'stroke="#26364b"'));
    assert.equal([...svg.matchAll(/<g data-label="">/g)].length, planned.value.observations.length);
  }
});
