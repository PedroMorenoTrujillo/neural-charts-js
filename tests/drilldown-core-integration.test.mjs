import test from 'node:test';
import assert from 'node:assert/strict';
import {ownDrilldownGraph,createDrilldownState,currentDrilldownNode,drilldownGeneration,drilldownDestination,enterDrilldown,backDrilldown,rememberDrilldownView,restoredDrilldownView,reconcileDrilldown} from '@neural-charts/core/drilldown';
import {planWebChart} from '../dist/index.js';
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
const overview=freeze({type:'column',axes:{x:{type:'category',values:[{id:'north',label:'Region'},{id:'south',label:'Region'}]},y:{type:'linear'}},series:[{id:'sales',name:'Sales',data:[{id:'north',x:'north',y:0},{id:'south',x:'south',y:40}]}]});
const detail=freeze({type:'pie',data:[{id:'online',label:'Online',value:20},{id:'retail',label:'Retail',value:10}]});
function prepare(rootData=overview,semantics='categories:north,south;unit:EUR'){
 const result=ownDrilldownGraph(freeze({rootId:'overview',nodes:[{id:'overview',data:rootData},{id:'detail',data:detail}],links:[{fromNodeId:'overview',datumId:{seriesId:'sales',pointId:'north'},toNodeId:'detail'}]}),{semantics:{overview:semantics}});
 assert.equal(result.status,'ok');return result.value;
}
function plan(state){const node=state.graph.nodes.get(currentDrilldownNode(state));const result=planWebChart(node.data,{title:node.id,animation:{enabled:false}},{width:768,height:400});assert.equal(result.status,'ok');return result.value;}
test('Core drilldown uses original zero-valued Web identities and restores the source view',()=>{
 const graph=prepare();let state=createDrilldownState(graph);const rootFrame=plan(state),zero=rootFrame.observations.find(point=>point.id.pointId==='north');
 assert.equal(zero.value,0);assert.equal(rootFrame.observations.length,2);
 const selection={...drilldownGeneration(state),datumId:zero.id};
 assert.equal(drilldownDestination(state,selection),'detail');assert.equal(currentDrilldownNode(state),'overview','lookup must not navigate');
 const view=freeze({hiddenSeriesIds:[],viewport:{x:{firstId:'north',lastId:'south'}}});
 state=rememberDrilldownView(state,selection,view);state=enterDrilldown(state,selection);
 assert.equal(currentDrilldownNode(state),'detail');assert.equal(plan(state).observations.length,2);
 assert.equal(enterDrilldown(state,selection),state,'stale source output ignored');
 state=backDrilldown(state);assert.deepEqual(restoredDrilldownView(state),view);assert.equal(plan(state).observations.find(point=>point.id.pointId==='north').value,0);
 assert.equal(graph.nodes.get('overview').data,overview);assert(Object.isFrozen(overview.series[0].data));
});
test('Replaced Web data or viewport semantics invalidates saved drilldown views and old outputs',()=>{
 let state=createDrilldownState(prepare());const event={...drilldownGeneration(state),datumId:{seriesId:'sales',pointId:'north'}};
 state=rememberDrilldownView(state,event,{hiddenSeriesIds:[],viewport:{x:{firstId:'north',lastId:'south'}}});
 const replaced=freeze({...overview,series:overview.series.map(series=>({...series,data:series.data.map(point=>({...point,y:point.y+1}))}))});
 state=reconcileDrilldown(state,prepare(replaced,'categories:north,south;unit:USD'));
 assert.equal(restoredDrilldownView(state),undefined);assert.equal(drilldownDestination(state,event),undefined);assert.equal(plan(state).observations.find(point=>point.id.pointId==='north').value,1);assert.equal(overview.series[0].data[0].y,0);
});
