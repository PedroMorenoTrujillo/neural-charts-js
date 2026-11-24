import test from 'node:test';
import assert from 'node:assert/strict';
import {planWebChart} from '../dist/index.js';
import {migrateFixtureDiscriminators} from '../tooling/core-fixture-migration.mjs';
const options={title:'Migration',height:300};
const source=()=>({type:'line',axes:{x:{type:'linear'},y:{type:'linear'}},series:[{id:'s',name:'Series',data:[{id:'zero',x:0,y:0},{id:'gap',x:1,y:null},{id:'last',x:2,y:8}]}]});
test('Core 0.1 type discriminants preserve original identities, zeros and missing values',()=>{const data=source(),before=structuredClone(data),result=planWebChart(data,options,{width:640,height:300});assert.equal(result.status,'ok');assert.deepEqual(result.value.observations.map(p=>p.pointId??p.id?.pointId),['zero','last']);assert.deepEqual(data,before);});
test('obsolete and mixed kind/type source keys are rejected rather than accepted as aliases',()=>{for(const axis of [{kind:'linear'},{type:'linear',kind:'linear'}]){const data=source();data.axes.x=axis;const before=structuredClone(data),result=planWebChart(data,options,{width:640,height:300});assert.equal(result.status,'invalid');assert.deepEqual(data,before);}});
test('offline fixture conversion is immutable and rejects conflicting discriminants',()=>{const old=Object.freeze({axes:Object.freeze({x:Object.freeze({kind:'category',values:Object.freeze([Object.freeze({id:'repeat',label:'Same'}),Object.freeze({id:'other',label:'Same'})])})})});const converted=migrateFixtureDiscriminators(old);assert.equal(converted.axes.x.type,'category');assert.equal(old.axes.x.kind,'category');assert.deepEqual(converted.axes.x.values.map(v=>v.id),['repeat','other']);assert.throws(()=>migrateFixtureDiscriminators({kind:'linear',type:'time'}),/Ambiguous/);});
