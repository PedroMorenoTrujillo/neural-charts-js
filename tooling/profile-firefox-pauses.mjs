import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {firefox} from '@playwright/test';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),consumer=path.resolve(root,'../neural-charts-showcase'),out=path.resolve(root,process.env.NEURAL_REVIEW_ARTIFACTS??'artifacts/five-point-closure/firefox-pauses');fs.mkdirSync(out,{recursive:true});
const packages=JSON.parse(fs.readFileSync(path.join(consumer,'package.json'))).dependencies,archive=path.resolve(consumer,packages['@neural-charts/web'].slice(5)),archiveSha256=createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
const profile=path.join(out,'gecko.json');assert(!fs.existsSync(profile),'Keep the earlier profile, choose a new output before rerunning');
const bundle=await build({stdin:{contents:"import{createChart}from'@neural-charts/web';globalThis.NC={createChart}",resolveDir:consumer},bundle:true,write:false,minify:false,format:'iife',platform:'browser'});
const browser=await firefox.launch({env:{...process.env,MOZ_PROFILER_STARTUP:'1',MOZ_PROFILER_STARTUP_INTERVAL:'2',MOZ_PROFILER_STARTUP_ENTRIES:'16000000',MOZ_PROFILER_STARTUP_FEATURES:'js,stackwalk,cpu,processcpu',MOZ_PROFILER_STARTUP_FILTERS:'GeckoMain',MOZ_PROFILER_SHUTDOWN:profile}});
let observation;
try{
 const page=await browser.newPage({viewport:{width:1100,height:800},reducedMotion:'reduce'});await page.setContent('<!doctype html><html lang="en"><title>Firefox pause diagnosis</title><body><div id="host" style="width:960px"></div></body></html>');await page.addScriptTag({content:bundle.outputFiles[0].text});
 observation=await page.evaluate(()=>{
  const host=document.getElementById('host'),results=[],data={type:'line',axes:{x:{type:'linear'},y:{type:'linear'}},series:[{id:'s',name:'Source',data:Array.from({length:50000},(_,i)=>({id:'p'+i,x:i,y:Math.sin(i/17)*40+50}))}]},options={capacity:{points:50000},width:900,height:380,animation:{enabled:false},appearance:{markers:false},viewport:{axes:'xy'}};
  const check=(v,m)=>{if(!v)throw Error(m)};
  for(let i=-3;i<30;i++){
   let chart;
   const run=(stage,fn)=>{const name='nc:'+stage+':'+i;performance.mark(name+':start');fn();host.getBoundingClientRect();performance.mark(name+':end');performance.measure(name,name+':start',name+':end');};
   run('initial',()=>{const r=NC.createChart(host,data,options,{instanceId:'firefox-profile'});check(r.status==='ok','Initial failed');chart=r.value});
   const next={...data,series:[{...data.series[0],data:data.series[0].data.map((p,j)=>j===49999?{...p,y:100+i}:p)}]};run('changedData',()=>check(chart.update(next,options).status==='ok','Update failed'));check(chart.getFrame().observations.find(o=>o.id.pointId==='p49999').value===100+i,'Actual update required');
   const node=host.querySelector('[data-nc-web]'),before=JSON.stringify(chart.getFrame().viewport.value);run('zoom',()=>node.dispatchEvent(new KeyboardEvent('keydown',{key:'+',bubbles:true})));check(JSON.stringify(chart.getFrame().viewport.value)!==before,'Actual zoom required');const zoom=JSON.stringify(chart.getFrame().viewport.value);run('pan',()=>node.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true})));check(JSON.stringify(chart.getFrame().viewport.value)!==zoom,'Actual pan required');
   run('svg',()=>chart.exportSvg({composition:'plot'}));run('svgChart',()=>chart.exportSvg({composition:'chart'}));chart.destroy();
  }
  return {timeOrigin:performance.timeOrigin,measures:performance.getEntriesByType('measure').map(e=>({name:e.name,startTime:e.startTime,duration:e.duration}))};
 });
}finally{await browser.close();}
for(let i=0;i<50&&!fs.existsSync(profile);i++)await new Promise(r=>setTimeout(r,100));assert(fs.existsSync(profile),'Firefox did not emit its shutdown profile');
fs.writeFileSync(path.join(out,'observations.json'),JSON.stringify({recordedAt:new Date().toISOString(),scope:'Diagnostic instrumented/unminified build of the actual installed archive, profiler enabled. Does not replace production timing receipts or prove FPS.',version:browser.version(),packages,archiveSha256,documentation:'https://raw.githubusercontent.com/firefox-devtools/profiler/main/docs-user/guide-startup-shutdown.md',profile,...observation},null,2)+'\n');
console.log('Saved local Firefox profile and '+observation.measures.length+' timed stage markers. No profile uploaded.');
