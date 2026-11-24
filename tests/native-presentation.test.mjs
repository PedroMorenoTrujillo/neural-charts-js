import test from 'node:test';
import assert from 'node:assert/strict';
import {renderChartSvg} from '../dist/index.js';

const data = {
  type:'line', axes:{x:{type:'linear'},y:{type:'linear'}},
  series:[{id:'source',name:'Source',data:[{id:'a',x:1,y:0},{id:'b',x:2,y:5},{id:'c',x:3,y:10}]}],
};
function render(options) {
  return renderChartSvg(data, options, {instanceId:'styled', composition:'plot'});
}

test('point color preserves the connected line and identifies zero-valued source points', () => {
  const styles = {points:[{seriesId:'source',pointId:'a',color:'#A95C10'}]};
  const plain = render({}), highlighted = render({appearance:styles});
  assert.equal(plain.status,'ok');
  assert.equal(highlighted.status,'ok');
  const path = svg => svg.match(/<g data-series="source"[^>]*><path[^>]+>/)?.[0];
  assert(path(plain.value));
  assert.equal(path(highlighted.value), path(plain.value));
  assert.match(highlighted.value, /<circle[^>]+data-observation="0"[^>]+fill="#A95C10"/);
  assert.equal(render({appearance:{points:[...styles.points,...styles.points]}}).diagnostic.reason,'DUPLICATE_POINT_STYLE_ID');
  assert.equal(render({appearance:{points:[{...styles.points[0],pointId:'missing'}]}}).diagnostic.reason,'UNKNOWN_POINT_STYLE_ID');
  assert.equal(render({appearance:{points:[{...styles.points[0],color:'url(test)'}]}}).diagnostic.reason,'HEX_PALETTE_REQUIRED');
});

test('band styles decorate the projected rectangle and safely export their labels', () => {
  const band = {id:'target',axis:'y',from:2,to:8};
  const styled = render({referenceBands:[band],referenceBandStyles:[{id:'target',label:'<goal>',color:'#14776B',opacity:.2}]});
  assert.equal(styled.status,'ok');
  assert.match(styled.value, /data-reference-band="target"[^>]+fill="#14776B" fill-opacity="0\.2"/);
  assert.match(styled.value, /<title>&lt;goal&gt;<\/title>/);
  assert.equal(render({referenceBands:[band],referenceBandStyles:[{id:'missing'}]}).diagnostic.reason,'INVALID_REFERENCE_BAND_STYLE_ID');
  assert.equal(render({animation:{enabled:true,revision:1.2}}).diagnostic.reason,'INVALID_ANIMATION_REVISION');
});
