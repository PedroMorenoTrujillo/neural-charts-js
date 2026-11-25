import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium,firefox,webkit} from '@playwright/test';
import {catalog} from './catalog.mjs';
import {createHash} from 'node:crypto';
import {migrateRecipeDiscriminators} from './core-fixture-migration.mjs';
import {openInstrumentedPage} from './browser-modules.mjs';
const instrumented=Boolean(process.env.NODE_V8_COVERAGE);
const root=path.resolve(import.meta.dirname,'..'),results=[],out=path.resolve(root,process.env.NEURAL_REVIEW_ARTIFACTS??(instrumented?'coverage':'artifacts'));fs.mkdirSync(out,{recursive:true});
const bundled=instrumented?undefined:await build({stdin:{contents:"import * as api from '@neural-charts/web';globalThis.NC=api;",resolveDir:root},bundle:true,write:false,platform:'browser',format:'iife'});
const financial=JSON.parse(fs.readFileSync(path.join(root,'examples/financial-recipes.json'))).map(migrateRecipeDiscriminators);
const evidence={recordedAt:new Date().toISOString(),core:JSON.parse(fs.readFileSync(path.join(root,'docs/core-candidate.json')))};
if(bundled){
 const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
 const archive=path.resolve(root,process.env.NEURAL_WEB_ARCHIVE??('artifacts/neural-charts-web-'+version+'.tgz'));
 evidence.archiveSha256=createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
 evidence.bundleSha256=createHash('sha256').update(bundled.outputFiles[0].contents).digest('hex');
}else evidence.entrypointSha256=createHash('sha256').update(fs.readFileSync(path.join(root,'dist/index.js'))).digest('hex');
fs.writeFileSync(path.join(out,'advanced-browser.json'),JSON.stringify({...evidence,status:'IN_PROGRESS',results},null,2));
for(const[name,engine]of Object.entries(instrumented?{chromium}:{chromium,firefox,webkit})){
 const browser=await engine.launch();try{
  const page=await browser.newPage({viewport:{width:1100,height:1000},reducedMotion:'no-preference'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const markup='<main><h1>Advanced contracts</h1><div id="a" style="width:768px"></div><div id="b" style="width:768px"></div></main>';
  let writeCoverage;
  if(bundled){
   await page.setContent('<!doctype html><html lang="es"><title>Advanced chart contracts</title><body>'+markup+'</body></html>');
   await page.addScriptTag({content:bundled.outputFiles[0].text});
  }else{
   writeCoverage=await openInstrumentedPage(page,markup);
   await page.evaluate(async()=>{globalThis.NC=await import('/web/index.js');});
  }
  const checks=await page.evaluate(async()=>{
   const assert=(v,m)=>{if(!v)throw Error(m)},a=document.getElementById('a'),b=document.getElementById('b'),data={type:'line',axes:{x:{type:'linear'},y:{type:'linear'}},series:[{id:'s',name:'Signal',data:Array.from({length:100},(_,i)=>({id:'p'+i,x:i,y:Math.sin(i/8)*40+50}))}]};
   const urls=new Set(),create=URL.createObjectURL,revoke=URL.revokeObjectURL;URL.createObjectURL=blob=>{const u=create.call(URL,blob);urls.add(u);return u};URL.revokeObjectURL=u=>{urls.delete(u);revoke.call(URL,u)};
   const group=NC.createChartSyncGroup(),first=NC.createChart(a,data,{title:'A',animation:{enabled:true,duration:1000},viewport:{axes:'xy'}},{instanceId:'a',synchronization:group}),second=NC.createChart(b,data,{title:'B'},{instanceId:'b',synchronization:group});assert(first.status==='ok'&&second.status==='ok','Create real owners');globalThis.current=first.value;globalThis.dataset=data;globalThis.viewports=[];
   const node=a.querySelector('[data-nc-web]');assert(node.getAnimations({subtree:true}).length===1,'Initial owned animation');node.focus();node.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert(!b.querySelector('[role=tooltip]').hidden,'Real synchronized tooltip');assert(group.size===2,'Explicit group membership');
   const png=await first.value.exportPng({width:512,pixelRatio:2,background:'#ffffff'}),bytes=new DataView(await png.arrayBuffer());assert(png.type==='image/png'&&png.size>1000&&bytes.getUint32(16)===1024,'Real PNG pixels and dimensions');assert(urls.size===0,'PNG object URLs released');assert(first.value.exportCsv().status==='ok','Original CSV export');
   for(const composition of ['chart','plot'])for(const [background,expected]of [['#123456',[18,52,86,255]],['#00000000',[0,0,0,0]]]){const blob=await first.value.exportPng({width:64,background,composition}),bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const context=canvas.getContext('2d');context.drawImage(bitmap,0,0);const pixel=[...context.getImageData(0,0,1,1).data];bitmap.close();canvas.width=canvas.height=0;assert(JSON.stringify(pixel)===JSON.stringify(expected),'Actual custom/transparent PNG background: '+JSON.stringify(pixel));}assert(urls.size===0,'Color export URL cleanup');
   {const blob=await NC.rasterizeChartSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#abcdef"/></svg>',document,{background:'#123456'}),bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const context=canvas.getContext('2d');context.drawImage(bitmap,0,0);const pixel=[...context.getImageData(0,0,1,1).data];bitmap.close();canvas.width=canvas.height=0;assert(JSON.stringify(pixel)==='[171,205,239,255]','Unowned SVG rectangles remain data paint');assert(urls.size===0,'Arbitrary SVG URL cleanup');}

   const controller=new AbortController();controller.abort();let aborted=false;try{await first.value.exportPng({signal:controller.signal})}catch{aborted=true}assert(aborted&&urls.size===0,'Abort cleanup');
   const pending=first.value.exportPng();first.value.destroy();let destroyedExport=false;try{await pending}catch{destroyedExport=true}assert(destroyedExport&&urls.size===0,'Destroy cancels pending export');assert(node.getAnimations({subtree:true}).length===0,'Animation destroy cleanup');assert(group.size===1,'Departed owner released');second.value.destroy();assert(group.size===0,'No global registry retention');group.destroy();
   let rejected=false;try{await NC.rasterizeChartSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"/>',document)}catch{rejected=true}assert(rejected,'Rasterizer rejects executable SVG');
   for(const bad of ['<svg xmlns="http://www.w3.org/2000/svg"><animate attributeName="href" values="https://example.invalid"/></svg>','<!DOCTYPE svg [<!ENTITY x "payload">]><svg xmlns="http://www.w3.org/2000/svg">&x;</svg>']){let rejected=false;try{await NC.rasterizeChartSvg(bad,document)}catch{rejected=true}assert(rejected,'Rasterizer accepts only bounded serializer geometry');}
   let selection,viewport;const controlled=NC.createChart(a,data,{selectedPoints:[],viewport:{axes:'x',value:{}}},{instanceId:'controlled',onSelectionChange:x=>selection=x,onViewportChange:x=>viewport=x});assert(controlled.status==='ok','Controlled create');const root=a.querySelector('[data-nc-web]');root.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));root.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert(selection.length===1&&controlled.value.getSelection().length===0,'Rejected controlled proposal does not self-apply');
   controlled.value.update(structuredClone(data),{selectedPoints:selection,viewport:{axes:'x',value:{}}});assert(controlled.value.getSelection()[0].pointId===selection[0].pointId,'Reconstructed data identity');root.dispatchEvent(new KeyboardEvent('keydown',{key:'+',bubbles:true}));assert(viewport&&Object.keys(controlled.value.getFrame().viewport.value).length===0,'Viewport proposal has one owner');controlled.value.destroy();
   const duo={...data,series:[data.series[0],{...data.series[0],id:'other',name:'Other'}]},replacing=NC.createChart(a,duo,{},{instanceId:'dynamic-hidden'});assert(replacing.status==='ok','Dynamic source fixture');const unchanged=replacing.value.getFrame();assert(replacing.value.update(null,{}).status==='invalid'&&replacing.value.getFrame()===unchanged,'Malformed JS updates retain the last valid frame');a.querySelector('button[data-series="s"]').click();assert(replacing.value.getHiddenSeriesIds().includes('s'),'User hides first series');const remaining={...duo,series:duo.series.slice(1)};assert(replacing.value.update(remaining,{}).status==='ok'&&replacing.value.getHiddenSeriesIds().length===0,'Removing a hidden series does not trap uncontrolled updates');replacing.value.destroy();const strict=NC.createChart(a,duo,{hiddenSeriesIds:['s']},{instanceId:'controlled-hidden'});assert(strict.status==='ok'&&strict.value.update(remaining,{hiddenSeriesIds:['s']}).status==='invalid','Stale controlled state remains a consumer diagnostic');strict.value.destroy();
   globalThis.proposals=[];const drag=NC.createChart(a,data,{title:'Gestures',viewport:{axes:'xy'},animation:{enabled:false}},{instanceId:'gesture',onViewportChange:v=>proposals.push(v)});assert(drag.status==='ok','Gesture fixture');globalThis.current=drag.value;
   URL.createObjectURL=create;URL.revokeObjectURL=revoke;return {png:png.size,synchronization:true,controlled:true,exports:true};
  });
  const svg=page.locator('#a svg'),box=await svg.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.keyboard.down('Control');await page.mouse.wheel(0,-150);await page.mouse.wheel(0,-150);await page.keyboard.up('Control');await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>proposals.length),1,'One coalesced wheel proposal');
  const revision=await page.locator('#a [data-nc-web]').getAttribute('data-revision');await page.mouse.down();await page.mouse.move(box.x+box.width/2+50,box.y+box.height/2+15,{steps:8});await page.waitForTimeout(40);assert.equal(await page.locator('#a [data-nc-web]').getAttribute('data-revision'),revision,'No geometry replan during move');assert(await page.locator('#a [data-layer=geometry]').getAttribute('transform'),'Affine preview');await page.mouse.up();await page.waitForTimeout(40);assert.equal(await page.evaluate(()=>proposals.length),2,'One drag commit');
  if(name==='chromium'){
    const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:3});
    const b=await svg.boundingBox(),cx=b.x+b.width/2,cy=b.y+b.height/2;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-35,y:cy,id:1},{x:cx+35,y:cy,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-80,y:cy,id:1},{x:cx+80,y:cy,id:2}]});await page.waitForTimeout(40);
    assert(await page.locator('#a [data-layer=geometry]').getAttribute('transform'),'Real two-finger preview');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(40);assert.equal(await page.evaluate(()=>proposals.length),3,'One real pinch proposal');
    const firstTwo=[{x:cx-35,y:cy,id:11},{x:cx+35,y:cy,id:12}];
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:firstTwo});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...firstTwo[0],x:cx-70},{...firstTwo[1],x:cx+70}]});
    await page.waitForFunction(()=>document.querySelector('#a [data-layer=geometry]').hasAttribute('transform'));
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...firstTwo[0],x:cx-70},{...firstTwo[1],x:cx+70},{x:cx,y:cy+25,id:13}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(()=>!document.querySelector('#a [data-layer=geometry]').hasAttribute('transform'));
    assert.equal(await page.evaluate(()=>proposals.length),3,'A third touch cancels the preview and never commits a viewport');
    await page.evaluate(()=>document.body.style.minHeight='3000px');const before=await page.evaluate(()=>proposals.length);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:3}]});
    for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx,y:cy-i*25,id:3}]});await page.waitForTimeout(20);}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(160);
    assert(await page.evaluate(()=>scrollY>0),'One finger preserves document scroll');assert.equal(await page.evaluate(()=>proposals.length),before,'Document scrolling is not a chart gesture');await page.evaluate(()=>scrollTo(0,0));await cdp.detach();
  }
  const pending=await page.evaluate(()=>{const before=proposals.length,svg=document.querySelector('#a svg'),box=svg.getBoundingClientRect();svg.dispatchEvent(new WheelEvent('wheel',{ctrlKey:true,deltaY:-100,bubbles:true,cancelable:true,clientX:box.x+box.width/2,clientY:box.y+box.height/2}));current.destroy();return before;});await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>proposals.length),pending,'Destroy cancels pending wheel timer and preview without late proposals');
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{current.destroy();const r=NC.createChart(document.getElementById('a'),dataset,{animation:{enabled:true}},{instanceId:'reduced'});if(r.status!=='ok')throw Error('Reduced fixture');current=r.value;if(document.querySelector('#a [data-nc-web]').getAnimations({subtree:true}).length)throw Error('Reduced motion ignored');current.destroy();});
  const families=[];for(const item of financial.filter(x=>x.id==='basic')){await page.evaluate(item=>{const r=NC.createChart(document.getElementById('a'),item.data,item.options,{instanceId:'financial'});if(r.status!=='ok')throw Error(JSON.stringify(r));const svg=document.querySelector('#a svg');if(!svg||!svg.querySelector('[data-layer=geometry] path,[data-layer=geometry] rect,[data-layer=geometry] circle'))throw Error('Financial geometry not painted: '+item.family);r.value.destroy();},item);families.push(item.family);}
  for(const direction of ['ltr','rtl'])await page.evaluate(({item,direction})=>{const r=NC.createChart(document.getElementById('a'),item.data,{...item.options,width:375,direction},{instanceId:'axis-bounds'});if(r.status!=='ok')throw Error(JSON.stringify(r));const labels=[...document.querySelectorAll('#a g[data-axis-label]')].filter(text=>text.getAttribute('data-axis-coordinate')==='-12');if(labels.length!==4||labels.some(text=>{const box=text.getBBox();return box.x+box.width>-8||box.x<-112;}))throw Error('Long labels leave gutter or cover bars: '+direction);r.value.destroy();},{item:catalog.find(item=>item.family==='bar'&&item.id==='long-labels'),direction});
  const region=await page.evaluate(item=>{const result=NC.createChart(document.getElementById('a'),item.data,item.options,{instanceId:'venn-hit',onPointActivate:event=>globalThis.vennActivation=event.id});if(result.status!=='ok')throw Error(JSON.stringify(result));globalThis.regionOwner=result.value;const frame=result.value.getFrame(),point=frame.observations.find(observation=>observation.venn?.sets.length>1&&observation.venn.geometry==='placed');if(!point)throw Error('Missing real intersection fixture');const box=document.querySelector('#a svg').getBoundingClientRect();let chosen;for(let y=8;y<frame.height&&!chosen;y+=8)for(let x=8;x<frame.width;x+=8){let mask=0;for(const circle of frame.vennLayout.circles)if(Math.hypot(x-circle.cx,y-circle.cy)<=circle.radius)mask|=circle.bit;if(mask!==point.venn.mask||frame.observations.some(o=>Math.hypot(x-o.x,y-o.y)<45))continue;const screen={x:box.left+x*box.width/frame.width,y:box.top+y*box.height/frame.height};if(document.elementFromPoint(screen.x,screen.y)?.localName==='circle'){chosen=screen;break;}}if(!chosen)throw Error('No region interior away from annotation anchors');return {id:point.id,...chosen};},catalog.find(item=>item.family==='venn'&&item.id==='basic'));
  await page.mouse.click(region.x,region.y);assert.deepEqual(await page.evaluate(()=>vennActivation),region.id,'Overlap selects the intersection, not the top SVG circle');await page.evaluate(()=>regionOwner.destroy());
  assert.deepEqual(errors,[]);results.push({browser:name,checks,financialFamilies:families.length,wheel:'PASS',drag:'PASS',pinch:name==='chromium'?'PASS_REAL_CDP':'NOT_EXECUTED',pendingGestureDestroy:'PASS',axisLabelGutter:'PASS_LTR_RTL',reducedMotion:'PASS'});console.log('PASS '+name+' exports,animation,controlled state,synchronization,real wheel/drag,financial SVG and LTR/RTL label bounds');
  await writeCoverage?.();
 }catch(error){fs.writeFileSync(path.join(out,'advanced-browser.json'),JSON.stringify({...evidence,status:'FAIL',results,error:String(error)},null,2));throw error;}finally{await browser.close();}
}
fs.writeFileSync(path.join(out,'advanced-browser.json'),JSON.stringify({...evidence,status:'PASS',results},null,2));
