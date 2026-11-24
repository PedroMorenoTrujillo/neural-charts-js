import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot} from '../dist/planning.js';
test('root provenance preserves deep structural reuse while inspecting changed current data',()=>{
  const source={series:[{id:'s',data:Array.from({length:2000},(_,i)=>({id:'p'+i,x:i,y:i/7}))}]},first=snapshot(source),next={series:[{...source.series[0],data:source.series[0].data.map((p,i)=>i===1999?{...p,y:-12}:p)}]},second=snapshot(next,false,first);
  assert.notEqual(first,source);assert.notEqual(second,first);assert.equal(second.series[0].data[0],first.series[0].data[0]);assert.notEqual(second.series[0].data[1999],first.series[0].data[1999]);assert.equal(second.series[0].data[1999].y,-12);assert.equal(first.series[0].data[1999].y,1999/7);assert.equal(snapshot(next,false,second),second);assert(Object.isFrozen(second.series[0].data[1999]));assert.equal(Object.getOwnPropertySymbols(second).length,0);
  let reads=0;const invalid={series:[{id:'s',data:next.series[0].data.map((p,i)=>i===0?Object.defineProperty({...p},'y',{enumerable:true,get(){reads++;return 0}}):p)}]};assert.throws(()=>snapshot(invalid,false,second),/ACCESSOR_NOT_ALLOWED/);assert.equal(reads,0);
});
test('owned fragments cannot bypass aggregate node or depth budgets',()=>{
  const fragment=snapshot({value:1}),valid=snapshot({items:[fragment]});assert.throws(()=>snapshot({items:Array(130000).fill(fragment)},false,valid),/INPUT_LIMIT/);
  let deep=fragment;for(let i=0;i<65;i++)deep={nested:deep};assert.throws(()=>snapshot(deep),/INPUT_LIMIT/);
});
test('frame provenance does not bypass stricter data validation or finite number checks',()=>{
  const frame=snapshot({missing:undefined},true);assert.throws(()=>snapshot(frame),/EXPLICIT_UNDEFINED/);const owned=snapshot({values:[1,2,3]});assert.throws(()=>snapshot({values:[1,NaN,3]},false,owned),/INVALID_NUMBER/);assert.throws(()=>snapshot({values:[1,Infinity,3]},false,owned),/INVALID_NUMBER/);
});
