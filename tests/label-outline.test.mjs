import test from 'node:test';
import assert from 'node:assert/strict';
import {renderChartSvg} from '../dist/index.js';
import {catalog} from '../tooling/catalog.mjs';

test('labels over narrow Sankey ink keep a surface outline in server SVG for both themes', () => {
  const example=catalog.find(item=>item.family==='sankey'&&item.id==='basic');
  for(const [theme,surface]of [['light','#ffffff'],['dark','#111c2d']]){
    const result=renderChartSvg(example.data,{...example.options,theme,appearance:{...example.options.appearance,dataLabels:true}},{instanceId:'sankey-'+theme});
    assert.equal(result.status,'ok');
    const labels=[...result.value.matchAll(/<g data-label="">(<text[^>]*>)/g)].map(match=>match[1]);
    assert(labels.length>0);
    for(const label of labels){assert(label.includes('stroke="'+surface+'"'));assert(label.includes('paint-order="stroke"'));assert(label.includes('stroke-width="3"'));}
    assert(!/<g data-axis-label[^>]*>[\s\S]*?<text[^>]*paint-order=/.test(result.value.split('<g data-layer="geometry">')[0]),'Axes keep their ordinary glyph rendering');
  }
});
