import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {chromium, firefox, webkit} from '@playwright/test';
import {packWeb} from './pack-web.mjs';

const root=path.resolve(import.meta.dirname,'..'),out=path.resolve(root,process.env.NEURAL_REVIEW_ARTIFACTS??'artifacts/performance-corrections'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'nc-update-consumer-'));
fs.mkdirSync(out,{recursive:true});
const receipt=path.join(out,'updates.json');
if(fs.existsSync(receipt)){const previous=JSON.parse(fs.readFileSync(receipt));const checkpoint=path.join(out,'updates-'+previous.recordedAt.replaceAll(/[:.]/g,'-')+'.json');if(!fs.existsSync(checkpoint))fs.copyFileSync(receipt,checkpoint);}
const candidate=JSON.parse(fs.readFileSync(path.join(root,'docs/core-candidate.json'))),archive=packWeb();
const results={recordedAt:new Date().toISOString(),core:candidate,webArchiveSha256:createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),environment:{node:process.version,cpu:os.cpus()[0]?.model,arch:os.arch()},scope:'Packed consumer; synchronous API plus forced layout. 30 measured samples after 3 warmups; no FPS claim.',browsers:[]};
try {
 fs.writeFileSync(path.join(temp,'package.json'),JSON.stringify({name:'private-update-verification',private:true,type:'module'}));
 const installed=spawnSync('npm',['install',archive,path.join(root,candidate.archive),'--offline','--ignore-scripts','--no-audit','--no-fund'],{cwd:temp,encoding:'utf8'});if(installed.status)throw Error(installed.stdout+installed.stderr);
 for(const name of ['core','web'])assert(!fs.lstatSync(path.join(temp,'node_modules/@neural-charts',name)).isSymbolicLink());
 const bundle=await build({stdin:{contents:"import{createChart}from'@neural-charts/web';globalThis.NC={createChart}",resolveDir:temp},bundle:true,write:false,minify:true,format:'iife',platform:'browser'});
 for(const [name,engine] of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch();try {
   const page=await browser.newPage({viewport:{width:1100,height:800},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.setContent('<!doctype html><html lang="en"><title>Update tests</title><body><div id="host" style="width:960px"></div></body></html>');await page.addScriptTag({content:bundle.outputFiles[0].text});
   const scenarios=[];
   for(const count of [1000,10000,50000])scenarios.push(await page.evaluate(count=>{
    const check=(v,m)=>{if(!v)throw Error(m)},host=document.getElementById('host');
    const data={type:'line',axes:{x:{type:'linear'},y:{type:'linear'}},series:[{id:'s0',name:'Series 0',data:Array.from({length:count},(_,i)=>({id:'p'+i,x:i,y:Math.sin(i/17)*40+50}))}]};
    const options={title:'Before',width:900,height:380,capacity:{points:count},animation:{enabled:false},appearance:{markers:false},viewport:{axes:'xy'}};
    const result=NC.createChart(host,data,options,{instanceId:'updates'});check(result.status==='ok','Mount failed');const chart=result.value,svg=host.querySelector('svg'),observations=chart.getFrame().observations;
    check(!host.querySelector('tbody'),'Closed table eagerly constructed');const details=host.querySelector('details');details.open=true;details.dispatchEvent(new Event('toggle'));const row=host.querySelector('tbody tr');check(!!row,'Open table missing rows');
    const timings={identical:[],titleOnly:[],controlledSelection:[],optionsOnly:[],keyboardOverlay:[],pointerOverlay:[]};
    for(let i=-3;i<30;i++)for(const [phase,action] of [
     ['identical',()=>chart.update(data,options)],
     ['titleOnly',()=>chart.update(data,{...options,title:'Title '+i})],
     ['controlledSelection',()=>chart.update(data,{...options,selectedPoints:[{seriesId:'s0',pointId:'p0'}]})],
     ['optionsOnly',()=>chart.updateOptions({...options,title:'Fast '+i,selectedPoints:[{seriesId:'s0',pointId:'p1'}]})],
     ['keyboardOverlay',()=>host.querySelector('[data-nc-web]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))],
     ['pointerOverlay',()=>{const frame=chart.getFrame(),o=frame.observations[(i+3)*97%count],box=svg.getBoundingClientRect(),ratio=box.width/(frame.width+88);svg.dispatchEvent(new PointerEvent('pointermove',{clientX:box.left+(o.x+60)*ratio,clientY:box.top+(o.y+22)*ratio,pointerType:'mouse',bubbles:true}));}]
    ]){const start=performance.now(),r=action();host.getBoundingClientRect();const duration=performance.now()-start;if(i>=0)timings[phase].push(duration);check(!r?.status||r.status==='ok','Update failed');check(host.querySelector('svg')===svg,'Unchanged geometry replaced SVG');check(host.querySelector('tbody tr')===row,'Unchanged data replaced table');check(chart.getFrame().observations===observations,'Unchanged geometry rebuilt observations');}
    check(host.querySelector('svg title').textContent==='Fast 29','SVG metadata stale');
    check(chart.getSelection()[0]?.pointId==='p1','Controlled selection stale');
    const revision=host.querySelector('[data-nc-web]').dataset.revision,frame=chart.getFrame();
    const invalid=chart.updateOptions({...options,theme:'invalid'});check(invalid.status==='invalid','Invalid options accepted');check(chart.getFrame()===frame&&host.querySelector('[data-nc-web]').dataset.revision===revision,'Rejected update was not atomic');
    data.series[0].data[0].y=123;check(chart.update(data,options).status==='ok','Mutable caller update rejected');check(chart.getFrame().observations.find(o=>o.id.pointId==='p0').value===123,'Mutation hidden by identity cache');check(frame.observations.find(o=>o.id.pointId==='p0').value!==123,'Previous frame mutated');
    const next=host.querySelector('svg'),largePath=[...next.querySelectorAll('path')].find(p=>(p.getAttribute('d')?.length??0)>10000);check(!!largePath,'Large path missing');check(chart.updateOptions({...options,theme:'dark'}).status==='ok','Theme rejected');check(host.querySelector('svg')!==next,'Style not repainted');check(largePath.isConnected,'Immutable native path was rebuilt');check(!host.querySelector('[data-nc-path]'),'Deferred path placeholder leaked');
    chart.destroy();check(chart.updateOptions(options).status==='invalid','Destroyed owner accepted options');check(!host.querySelector('[data-nc-web]'),'Retained chart');
    const q=(x,p)=>[...x].sort((a,b)=>a-b)[Math.ceil(x.length*p)-1];return {count,milliseconds:Object.fromEntries(Object.entries(timings).map(([k,x])=>[k,{p50:q(x,.5),p95:q(x,.95),samples:x.length,raw:x}])),svgRetained:true,tableRetained:true,observationsRetained:true,mutableInputDetected:true,rejectedUpdateAtomic:true};
   },count));
   const categories=await page.evaluate(()=>{const host=document.getElementById('host'),diagnostics=[],check=(v,m)=>{if(!v)throw Error(m)};for(const orientation of ['vertical','horizontal']){const data={type:'column',axes:{x:{type:'category',values:Array.from({length:1000},(_,i)=>({id:'p'+i,label:'Duplicate label'}))},y:{type:'linear'}},series:Array.from({length:3},(_,s)=>({id:'s'+s,name:'S'+s,data:Array.from({length:1000},(_,i)=>({id:'p'+i,x:'p'+i,y:i%17-8}))}))};const options={width:900,height:380,capacity:{points:3000,categories:1000},layout:{orientation},viewport:{axes:'x'},animation:{enabled:false}};const r=NC.createChart(host,data,options,{instanceId:'category',onDiagnostic:d=>diagnostics.push(d)});check(r.status==='ok','Category mount failed');const chart=r.value,node=host.querySelector('[data-nc-web]');node.dispatchEvent(new KeyboardEvent('keydown',{key:'+',bubbles:true}));const zoom=chart.getFrame().viewport.value;check(!!zoom.x,'Zoom did not apply');node.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true}));check(JSON.stringify(chart.getFrame().viewport.value)!==JSON.stringify(zoom),'Pan did not apply');node.querySelector('[data-action="reset"]').click();check(!chart.getFrame().viewport.value.x,'Reset failed');chart.destroy();}check(!diagnostics.length,JSON.stringify(diagnostics));return {orientations:2,categories:1000,series:3,zoom:true,pan:true,reset:true,diagnostics};});
   assert.deepEqual(errors,[]);results.browsers.push({name,version:browser.version(),scenarios,categories});fs.writeFileSync(path.join(out,'updates.json'),JSON.stringify(results,null,2));console.log('PASS update invalidation and category viewport: '+name);
  }finally{await browser.close();}
 }
}finally{fs.rmSync(temp,{recursive:true,force:true});}
