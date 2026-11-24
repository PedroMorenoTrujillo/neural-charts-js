import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {packWeb} from './pack-web.mjs';
const root=path.resolve(import.meta.dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'nc-heap-')),out=path.resolve(root,process.env.NEURAL_REVIEW_ARTIFACTS??'artifacts/performance-corrections');fs.mkdirSync(out,{recursive:true});
const pointCount=Number(process.env.NEURAL_MEMORY_POINTS??2000);assert(Number.isInteger(pointCount)&&pointCount>=2000&&pointCount<=10000,'Bounded memory scenario required');
const candidate=JSON.parse(fs.readFileSync(path.join(root,'docs/core-candidate.json'))),archive=packWeb();
const previousReceipt=path.join(out,'retained-memory.json');if(fs.existsSync(previousReceipt)){const previous=JSON.parse(fs.readFileSync(previousReceipt)),saved=path.join(out,'retained-memory-'+previous.archiveSha256.slice(0,12)+'.json');if(!fs.existsSync(saved))fs.copyFileSync(previousReceipt,saved);}
try {
  fs.writeFileSync(path.join(temp,'package.json'),JSON.stringify({name:'private-retained-memory-consumer',private:true,type:'module'}));
  const installed=spawnSync('npm',['install',archive,path.join(root,candidate.archive),'--offline','--ignore-scripts','--no-audit','--no-fund'],{cwd:temp,encoding:'utf8'});if(installed.status)throw Error(installed.stdout+installed.stderr);
  const bundle=await build({stdin:{contents:"import{createChart}from'@neural-charts/web';globalThis.NC={createChart}",resolveDir:temp},bundle:true,write:false,minify:true,platform:'browser',format:'iife'});
  const browser=await chromium.launch();try {
    const page=await browser.newPage({reducedMotion:'reduce'});await page.setContent('<!doctype html><html lang="en"><title>Memory</title><body><div id="host" style="width:800px"></div></body></html>');await page.addScriptTag({content:bundle.outputFiles[0].text});const session=await page.context().newCDPSession(page);
    await page.evaluate(pointCount=>{globalThis.cycles=count=>{const host=document.getElementById('host');for(let cycle=0;cycle<count;cycle++){
      const data={type:'line',axes:{x:{type:'linear'},y:{type:'linear'}},series:[{id:'s',name:'Source',data:Array.from({length:pointCount},(_,i)=>({id:'p'+i,x:i,y:Math.sin(i/7)*20}))}]},options={title:'Owned chart',capacity:{points:pointCount},width:760,height:300,appearance:{markers:false},viewport:{axes:'xy'},animation:{enabled:false}};
      const result=NC.createChart(host,data,options,{instanceId:'memory'});if(result.status!=='ok')throw Error(JSON.stringify(result));const chart=result.value,root=host.querySelector('[data-nc-web]');root.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));root.dispatchEvent(new KeyboardEvent('keydown',{key:'+',bubbles:true}));
      const details=host.querySelector('details');details.open=true;details.dispatchEvent(new Event('toggle'));host.querySelector('[data-action="table-next"]').click();chart.exportSvg();
      const changed={...data,series:[{...data.series[0],data:data.series[0].data.map((p,i)=>i===pointCount-1?{...p,y:cycle}:p)}]};if(chart.update(changed,options).status!=='ok')throw Error('Update rejected');chart.destroy();if(host.childElementCount)throw Error('Retained chart DOM');
    }};},pointCount);
    const settle=async()=>{await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame)});await session.send('HeapProfiler.collectGarbage');await session.send('HeapProfiler.collectGarbage');return {heap:await session.send('Runtime.getHeapUsage'),dom:await session.send('Memory.getDOMCounters')};};
    await page.evaluate(()=>cycles(50));const before=await settle(),rounds=[];for(let i=0;i<3;i++){await page.evaluate(()=>cycles(100));rounds.push(await settle());}
    const last=rounds.at(-1),growth=last.heap.usedSize-before.heap.usedSize,limits={usedHeapGrowthBytes:3*1024*1024,domNodesGrowth:20,eventListenersGrowth:5};
    const passed=growth<limits.usedHeapGrowthBytes&&last.dom.nodes-before.dom.nodes<=limits.domNodesGrowth&&last.dom.jsEventListeners-before.dom.jsEventListeners<=limits.eventListenersGrowth;
    // Preserve measurements on failure too; an assertion must not discard the
    // evidence needed to distinguish retained objects from runtime variation.
    const result={recordedAt:new Date().toISOString(),status:passed?'passed':'failed',core:candidate,archiveSha256:createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),browser:browser.version(),pointCount,scope:`Chromium forced-GC retained heap/DOM only. 50 warmup +3x100 create, keyboard, zoom, paged table, SVG export, changed-data update and destroy cycles with${pointCount} points. Not an RSS or Firefox/WebKit heap claim.`,limits,limitsStatus:'Local leak-detection threshold, not an approved product memory budget.',before,rounds,growth};fs.writeFileSync(path.join(out,'retained-memory.json'),JSON.stringify(result,null,2));
    assert(growth<limits.usedHeapGrowthBytes,'Retained heap exceeded the local leak detector');assert(last.dom.nodes-before.dom.nodes<=limits.domNodesGrowth,'Retained DOM growth');assert(last.dom.jsEventListeners-before.dom.jsEventListeners<=limits.eventListenersGrowth,'Retained event listeners');console.log('PASS Chromium retained heap, DOM and listeners across300 measured lifecycles');
  }finally{await browser.close()}
}finally{fs.rmSync(temp,{recursive:true,force:true})}
