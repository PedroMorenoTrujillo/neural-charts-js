import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot} from '../dist/planning.js';
import {planWebChart} from '../dist/index.js';

const input=()=>({type:'line',axes:{x:{type:'linear'},y:{type:'linear'}},series:[{id:'s',name:'Source',data:[{id:'a',x:0,y:1},{id:'b',x:1,y:2}]}]});
const size={width:600,height:300};
test('reusing immutable presentation validation never bypasses new options or Core capacities',()=>{
  const data=snapshot(input());
  assert.equal(planWebChart(data,{},size).status,'ok');
  assert.equal(planWebChart(data,{title:'Changed',viewport:{axes:'x',value:{x:[.2,.8]}}},size).status,'ok');
  assert.equal(planWebChart(data,{capacity:{points:1}},size).status,'invalid');
  assert.equal(planWebChart(data,{unknown:true},size).status,'invalid');
  const invalid={...data,axes:{...data.axes,y:{type:'linear',domain:[2,1]}}};
  assert.equal(planWebChart(invalid,{},size).status,'invalid');
});
test('changed mutable descendants must still reject forbidden presentation fields after a valid plan',()=>{
  const data=input(),owned=snapshot(data);
  assert.equal(planWebChart(data,{},size).status,'ok');assert.equal(planWebChart(owned,{},size).status,'ok');
  data.series[0].data[0].color='#ffffff';
  const next=planWebChart(data,{},size);assert.equal(next.status,'invalid');assert.match(next.diagnostic.reason,/PRESENTATION_IN_DATA/);
  assert.equal(planWebChart(owned,{},size).status,'ok');
  const replacement={...owned,axes:{...owned.axes,x:{...owned.axes.x,title:'Not data'}}};
  assert.equal(planWebChart(replacement,{},size).status,'invalid');
});

for(const count of [2,100])test(`borrowed frozen revocable descendants remain invalid after revocation (${count} points)`,()=>{
  const revoked=Proxy.revocable(Object.freeze({id:'p0',x:0,y:1}),{}),points=Object.freeze(Array.from({length:count},(_,i)=>i===0?revoked.proxy:Object.freeze({id:'p'+i,x:i,y:i+1})));
  const data=Object.freeze({type:'line',axes:Object.freeze({x:Object.freeze({type:'linear'}),y:Object.freeze({type:'linear'})}),series:Object.freeze([Object.freeze({id:'s',name:'Source',data:points})])});
  assert.equal(planWebChart(data,{},size).status,'ok');revoked.revoke();
  assert.equal(planWebChart(data,{},size).status,'invalid');
});

test('warming a shallow-frozen root never skips new mutable accessors or invokes them',()=>{
  const data=Object.freeze(input());assert.equal(planWebChart(data,{},size).status,'ok');let reads=0;
  Object.defineProperty(data.series[0].data[0],'color',{enumerable:true,get(){reads++;return '#ffffff';}});
  assert.equal(planWebChart(data,{},size).status,'invalid');assert.equal(reads,0);
});

test('a copied root with one borrowed frozen descendant is never treated as fully detached',()=>{
  const revoked=Proxy.revocable(Object.freeze({id:'p0',x:0,y:1}),{}),data=input();
  data.series[0].data=Array.from({length:100},(_,i)=>i===0?revoked.proxy:{id:'p'+i,x:i,y:i+1});
  const owned=snapshot(data);assert.notEqual(owned,data);assert.equal(planWebChart(owned,{},size).status,'ok');
  revoked.revoke();assert.equal(planWebChart(owned,{},size).status,'invalid');
});

test('a replacement with a different array length cannot inherit detached provenance for a new frozen Proxy',()=>{
  const data=input();data.series[0].data=Array.from({length:100},(_,i)=>({id:'p'+i,x:i,y:i+1}));
  const previous=snapshot(data),revoked=Proxy.revocable(Object.freeze({id:'p100',x:100,y:101}),{});
  const replacement={...data,series:[{...data.series[0],data:[...data.series[0].data,revoked.proxy]}]},owned=snapshot(replacement,false,previous);
  assert.notEqual(owned,previous);assert.equal(planWebChart(owned,{},size).status,'ok');revoked.revoke();
  assert.equal(planWebChart(owned,{},size).status,'invalid');
});
