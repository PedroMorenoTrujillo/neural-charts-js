import test from 'node:test';
import assert from 'node:assert/strict';
import {renderChartSvg} from '../dist/index.js';
import {renderCartesianChartSvg} from '../dist/cartesian.js';
import {catalog} from '../tooling/catalog.mjs';

test('granular Cartesian SSR/export matches the full renderer byte for byte for every applicable recipe',()=>{
  const types=new Set(['line','spline','area','areaspline','column']),recipes=catalog.filter(item=>types.has(item.data.type)),covered=new Set();let checked=0;
  for(const item of recipes)for(const composition of ['plot','chart']){
    const settings={instanceId:'granular-export',composition},options={...item.options,width:768};
    const generic=renderChartSvg(item.data,options,settings),granular=renderCartesianChartSvg(item.data,options,settings);
    assert.equal(generic.status,'ok',item.family+'/'+item.id);assert.deepEqual(granular,generic,item.family+'/'+item.id+' '+composition);covered.add(item.data.type);checked++;
  }
  assert.equal(checked,recipes.length*2);assert.deepEqual(covered,types,'Every supported Cartesian data type must be covered');
});
test('granular SSR rejects another family instead of dispatching it through the full engine',()=>{
  const pie=catalog.find(item=>item.data.type==='pie');assert.equal(renderCartesianChartSvg(pie.data,pie.options,{instanceId:'wrong'}).status,'invalid');
});
