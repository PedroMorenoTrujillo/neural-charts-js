import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderChartSvg} from '../dist/index.js';
const data={type:'column',axes:{x:{type:'category',values:[{id:'a',label:'First'},{id:'b',label:'Second'}]},y:{type:'linear'}},series:[{id:'a',name:'A very long channel name that remains visible in the exported legend',data:[{id:'a0',x:'a',y:10},{id:'a1',x:'b',y:-5}]},{id:'b',name:'Channel B',data:[{id:'b0',x:'a',y:20},{id:'b1',x:'b',y:15}]}]};
test('full export includes visible title, description, legend and self-contained patterns',()=>{
  for(const theme of ['light','dark'])for(const direction of ['ltr','rtl'])for(const position of ['top','bottom','left','right']){
    const options={title:'Visible <title>',description:'Original description',width:768,height:400,theme,direction,legend:{position,reverse:true},appearance:{series:[{id:'a',color:'#2c6ed5',pattern:'diagonal'},{id:'b',color:'#698e37',pattern:'dots'}]}};
    const result=renderChartSvg(data,options,{instanceId:'export',composition:'chart'});assert.equal(result.status,'ok');const svg=result.value;
    assert(svg.includes('data-export-header'));assert(svg.includes('>Visible &lt;title&gt;</text>'));assert(svg.includes('>Original description</text>'));assert(svg.includes('data-export-legend="a"'));assert(svg.includes('data-export-legend="b"'));assert(svg.indexOf('data-export-legend="b"')<svg.indexOf('data-export-legend="a"'));assert(svg.includes('<pattern'));assert(!/(?:https?:|data:|undefined|NaN|Infinity)/.test(svg.replace('http://www.w3.org/2000/svg','').replace('http://www.w3.org/2000/svg','')));
    const plot=renderChartSvg(data,options,{instanceId:'export'});assert.equal(plot.status,'ok');assert(!plot.value.includes('data-export-header'));assert(!plot.value.includes('data-export-legend='));
  }
});
test('export options preserve plot mode and reject invalid composition policies',()=>{
  const result=renderChartSvg(data,{title:'Title'},{instanceId:'export',composition:'chart',legend:false,description:false});assert.equal(result.status,'ok');assert(!result.value.includes('data-export-legend="'));
  for(const settings of [{composition:'bad'},{composition:'chart',legend:'no'},{composition:'plot',description:5}])assert.equal(renderChartSvg(data,{}, {instanceId:'export',...settings}).status,'invalid');
});
