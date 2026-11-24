import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {chromium, firefox, webkit} from '@playwright/test';
import {packWeb} from './pack-web.mjs';

const root=path.resolve(import.meta.dirname,'..'),out=path.resolve(root,process.env.NEURAL_REVIEW_ARTIFACTS??'artifacts/performance-corrections'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'nc-large-profile-'));
fs.mkdirSync(out,{recursive:true});
const candidate=JSON.parse(fs.readFileSync(path.join(root,'docs/core-candidate.json'))),archive=packWeb(),result={recordedAt:new Date().toISOString(),core:candidate,webArchiveSha256:createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),environment:{node:process.version,cpu:os.cpus()[0]?.model,arch:os.arch()},scope:'30 samples after 3 warmups, initial, one actually changed datum, real zoom/pan and export. Synchronous API plus forced layout; not paint/FPS. svg retains the previous plot-only scenario; svgChart separately measures full visible title/legend export.',browsers:[]};
try{
 fs.writeFileSync(path.join(temp,'package.json'),JSON.stringify({name:'private-large-profile',private:true,type:'module'}));const installed=spawnSync('npm',['install',archive,path.join(root,candidate.archive),'--offline','--ignore-scripts','--no-audit','--no-fund'],{cwd:temp,encoding:'utf8'});if(installed.status)throw Error(installed.stdout+installed.stderr);
 const bundle=await build({stdin:{contents:"import{createChart}from'@neural-charts/web';globalThis.NC={createChart}",resolveDir:temp},bundle:true,write:false,minify:false,format:'iife',platform:'browser'});
 // Profile the same production modules without minifying function names. This
 // profile build is separate from the minified timing bundle below.
 const timing=await build({stdin:{contents:"import{createChart}from'@neural-charts/web';globalThis.NC={createChart}",resolveDir:temp},bundle:true,write:false,minify:true,format:'iife',platform:'browser'});
 for(const [name,engine]of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch();try{
   const page=await browser.newPage({viewport:{width:1100,height:800},reducedMotion:'reduce'});await page.setContent('<!doctype html><html lang="en"><title>Large update profile</title><body><div id="host" style="width:960px"></div></body></html>');await page.addScriptTag({content:timing.outputFiles[0].text});
   const measure=async()=>page.evaluate(()=>{const host=document.getElementById('host'),phase={initial:[],changedData:[],zoom:[],pan:[],svg:[],svgChart:[]},diagnostics=[],check=(v,m)=>{if(!v)throw Error(m)};const data={type:'line',axes:{x:{type:'linear'},y:{type:'linear'}},series:[{id:'s',name:'Source',data:Array.from({length:50000},(_,i)=>({id:'p'+i,x:i,y:Math.sin(i/17)*40+50}))}]},options={capacity:{points:50000},width:900,height:380,animation:{enabled:false},appearance:{markers:false},viewport:{axes:'xy'}};for(let i=-3;i<30;i++){let chart;const run=(key,fn)=>{const start=performance.now();fn();host.getBoundingClientRect();if(i>=0)phase[key].push(performance.now()-start)};run('initial',()=>{const r=NC.createChart(host,data,options,{instanceId:'large',onDiagnostic:d=>diagnostics.push(d)});check(r.status==='ok','Initial failed');chart=r.value});const next={...data,series:[{...data.series[0],data:data.series[0].data.map((p,j)=>j===49999?{...p,y:100+i}:p)}]};run('changedData',()=>check(chart.update(next,options).status==='ok','Update failed'));check(chart.getFrame().observations.find(o=>o.id.pointId==='p49999').value===100+i,'Actual changed value not applied');const node=host.querySelector('[data-nc-web]'),before=JSON.stringify(chart.getFrame().viewport.value);run('zoom',()=>node.dispatchEvent(new KeyboardEvent('keydown',{key:'+',bubbles:true})));const zoom=JSON.stringify(chart.getFrame().viewport.value);check(zoom!==before,'Zoom was a no-op');run('pan',()=>node.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true})));check(JSON.stringify(chart.getFrame().viewport.value)!==zoom,'Pan was a no-op');run('svg',()=>chart.exportSvg({composition:'plot'}));run('svgChart',()=>chart.exportSvg({composition:'chart'}));chart.destroy()}check(!diagnostics.length,JSON.stringify(diagnostics));const q=(x,p)=>[...x].sort((a,b)=>a-b)[Math.ceil(x.length*p)-1];return {points:50000,milliseconds:Object.fromEntries(Object.entries(phase).map(([k,x])=>[k,{p50:q(x,.5),p95:q(x,.95),samples:x.length,raw:x}]))};});
   const values=await measure();result.browsers.push({name,version:browser.version(),...values});
   fs.writeFileSync(path.join(out,'large-updates-'+result.webArchiveSha256.slice(0,12)+'.json'),JSON.stringify(result,null,2));
   if(name==='chromium'){
    await page.addScriptTag({content:bundle.outputFiles[0].text});const session=await page.context().newCDPSession(page);await session.send('Profiler.enable');await session.send('Profiler.setSamplingInterval',{interval:1000});await session.send('Profiler.start');
    await page.evaluate(()=>{const host=document.getElementById('host'),data={type:'line',axes:{x:{type:'linear'},y:{type:'linear'}},series:[{id:'s',name:'Source',data:Array.from({length:50000},(_,i)=>({id:'p'+i,x:i,y:Math.sin(i/17)*40+50}))}]};for(let i=0;i<5;i++){const r=NC.createChart(host,data,{capacity:{points:50000},width:900,height:380,appearance:{markers:false},animation:{enabled:false},viewport:{axes:'xy'}},{instanceId:'profile'});if(r.status!=='ok')throw Error(JSON.stringify(r));host.querySelector('[data-nc-web]').dispatchEvent(new KeyboardEvent('keydown',{key:'+',bubbles:true}));r.value.exportSvg({composition:'plot'});r.value.destroy();}});
    const {profile}=await session.send('Profiler.stop');fs.writeFileSync(path.join(out,'cpu-'+result.webArchiveSha256.slice(0,12)+'.cpuprofile'),JSON.stringify(profile));
   }
   console.log('Measured real 50k initial/change/zoom/pan/export: '+name);
  }finally{await browser.close()}
 }
}finally{fs.rmSync(temp,{recursive:true,force:true})}
assert.equal(result.browsers.length,3);
