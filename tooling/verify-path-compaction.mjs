import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {chromium,firefox,webkit} from '@playwright/test';
import {packWeb} from './pack-web.mjs';

// Same isolated archive-consumer boundary as verify.mjs/configuration review.
// This is functional/visual QA, not an uninstrumented performance benchmark.
// Normal mode certifies the exact current rendering. Experimental mode can
// reproduce the rejected compaction archive without changing installed sources.
const experiment=process.env.NEURAL_PATH_EXPERIMENT==='1';
const root=path.resolve(import.meta.dirname,'..'),out=path.resolve(root,process.env.NEURAL_REVIEW_ARTIFACTS??(experiment?'artifacts/performance-round-2/path-compaction/reproduction':'artifacts/performance-round-2/path-preservation'));
assert(!fs.existsSync(path.join(out,'results.json')),'Preserve the previous campaign; choose a fresh NEURAL_REVIEW_ARTIFACTS directory before rerunning');
const temp=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'nc-path-compaction-')));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
fs.mkdirSync(out,{recursive:true});
const result={status:'RUNNING',recordedAt:new Date().toISOString(),experiment,scope:(experiment?'Reproduction of rejected orthogonal path compaction. ':'Current exact path-preservation regression. ')+'Native path metrics and zero-changed-pixel screenshots captured sequentially at identical bounding boxes in three real engines. Production getFrame commands/source data remain intact. No human or performance certification.',limits:{changedPixels:0,nativeGeometryDifferenceSvgUnits:.25},browsers:[],failures:[],humanApproval:'PENDING'};
const save=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2)+'\n');
try{
  const archive=process.env.NEURAL_WEB_ARCHIVE?fs.realpathSync(path.resolve(root,process.env.NEURAL_WEB_ARCHIVE)):packWeb();
  const core=process.env.NEURAL_WEB_ARCHIVE?JSON.parse(execFileSync('/usr/bin/tar',['-xOf',archive,'package/docs/core-candidate.json'],{encoding:'utf8'})):JSON.parse(fs.readFileSync(path.join(root,'docs/core-candidate.json'),'utf8'));
  const coreArchive=process.env.NEURAL_CORE_ARCHIVE?path.resolve(root,process.env.NEURAL_CORE_ARCHIVE):[path.join(root,core.archive),path.join(path.dirname(archive),path.basename(core.archive))].find(file=>fs.existsSync(file));
  assert(coreArchive,'Original Core archive missing; preserve it beside the Web experiment or set NEURAL_CORE_ARCHIVE');
  assert.equal(hash(fs.readFileSync(coreArchive)),core.sha256,'Core archive does not match its provenance');
  result.core=core;result.archiveFile=path.basename(archive);result.archiveSha256=hash(fs.readFileSync(archive));
  fs.writeFileSync(path.join(temp,'package.json'),JSON.stringify({name:'private-path-compaction-consumer',private:true,type:'module'}));
  const install=spawnSync('npm',['install',archive,coreArchive,'--offline','--ignore-scripts','--no-audit','--no-fund','--cache',path.join(temp,'empty-cache')],{cwd:temp,encoding:'utf8',timeout:120000});
  assert.equal(install.status,0,'Offline archive consumer install failed: '+install.stderr);
  for(const name of ['web','core'])assert(!fs.lstatSync(path.join(temp,'node_modules/@neural-charts',name)).isSymbolicLink(),'A package must not resolve through a source link');
  const entry=path.join(temp,'entry.js');fs.writeFileSync(entry,"import{createChart}from'@neural-charts/web';globalThis.NC={createChart};");
  const bundle=await build({entryPoints:[entry],bundle:true,write:false,minify:true,format:'iife',platform:'browser',target:'es2022',metafile:true});
  assert(Object.keys(bundle.metafile.inputs).every(file=>path.resolve(file).startsWith(temp+path.sep)),'Only isolated installed production modules may enter the bundle');
  for(const [name,engine]of Object.entries({chromium,firefox,webkit})){
    const browser=await engine.launch({timeout:30000}),watchdog=setTimeout(()=>{browser.close().catch(()=>{});},180000);watchdog.unref();const checked={name,version:browser.version(),cases:[]};
    try{
      const page=await browser.newPage({viewport:{width:1000,height:900},deviceScaleFactor:1,reducedMotion:'reduce'}),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Path compaction review</title><style>body{margin:0}#host,#comparison{width:900px}#comparison>svg{display:block}</style></head><body><div id="host"></div><div id="comparison"></div></body></html>');
      await page.addScriptTag({content:bundle.outputFiles[0].text});
      for(const scenario of ['flat','plateaus','gaps','step-mid'])for(const dash of ['solid','dashed']){
        const key=scenario+'-'+dash,base=name+'-'+key,renderedName=experiment?'compact':'actual';
        try{
          const observation=await page.evaluate(({scenario,dash,experiment})=>{
            const check=(value,message)=>{if(!value)throw Error(message)},host=document.getElementById('host'),comparison=document.getElementById('comparison');comparison.replaceChildren();
            const points=Array.from({length:5001},(_,i)=>({id:'p'+i,x:i,y:scenario==='flat'?4:scenario==='gaps'&&i%113===0?null:(Math.floor(i/400)%4<2?10:-.5)}));
            const deepFreeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value)}return value};
            const data=deepFreeze({type:'line',axes:{x:{type:'linear',domain:[0,5000]},y:{type:'linear',domain:[-2,12]}},series:[{id:'s',name:'Original source',...(scenario==='step-mid'?{curve:'step-mid'}:{}),data:points}]}),before=JSON.stringify(data);
            const visibleRange=scenario==='gaps'?[1000,4200]:[0,5000],options={title:'Exact path compaction',width:900,height:380,capacity:{points:6000},animation:{enabled:false},theme:scenario==='plateaus'||scenario==='step-mid'?'dark':'light',appearance:{markers:false,series:[{id:'s',dash}]},selectedPoints:[{seriesId:'s',pointId:'p4900'}],...(scenario==='gaps'?{viewport:{axes:'x',value:{x:visibleRange}}}:{})};
            const events=[],mounted=NC.createChart(host,data,options,{instanceId:'path-compaction',onPointActivate:event=>events.push(event.id)});check(mounted.status==='ok',JSON.stringify(mounted));const chart=mounted.value;globalThis.pathFixture={chart};
            const frame=chart.getFrame(),frameBefore=JSON.stringify(frame),commands=frame.series[0].commands;check(commands.length>=4096,'Dense raw path was unexpectedly reduced before rendering');
            const expected=points.filter(p=>p.y!==null&&p.x>=visibleRange[0]&&p.x<=visibleRange[1]);check(frame.observations.length===expected.length,'Original visible observations were dropped');
            const ids=new Set(frame.observations.map(point=>point.id.pointId));check(expected.every(point=>ids.has(point.id)),'Original logical datum identity lost');
            const node=host.querySelector('[data-nc-web]');node.focus();node.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));node.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));check(events.length===1&&events[0].pointId===expected.at(-1).id,'Keyboard activation must reach the last original datum exactly once');
            check(chart.getSelection().some(id=>id.seriesId==='s'&&id.pointId==='p4900'),'Controlled original selection lost');
            const csv=chart.exportCsv();check(csv.status==='ok'&&csv.value.split('\r\n').length-2===points.length,'CSV must retain every original row, including gaps/offscreen data');
            const xml=new DOMParser().parseFromString(chart.exportSvg({composition:'plot'}),'image/svg+xml');check(!xml.querySelector('parsererror'),'Invalid exported SVG');const compact=document.importNode(xml.documentElement,true),reference=compact.cloneNode(true);
            compact.dataset.comparison='compact';reference.dataset.comparison='reference';
            const selector='[data-layer="geometry"] [data-series="s"] > path',compactPath=compact.querySelector(selector),fullPath=reference.querySelector(selector);check(compactPath&&fullPath,'Actual geometry path missing');
            const full=commands.map(command=>{check(command.type==='M'||command.type==='L','This Line fixture must contain only M/L commands');check(Number.isFinite(command.x)&&Number.isFinite(command.y),'Nonfinite raw path');return command.type+String(command.x)+','+String(command.y)}).join(' ');
            fullPath.setAttribute('d',full);
            for(const element of [reference,...reference.querySelectorAll('*')])for(const attribute of [...element.attributes])if(attribute.value.includes('path-compaction'))element.setAttribute(attribute.name,attribute.value.replaceAll('path-compaction','path-compaction-reference'));
            const compactData=compactPath.getAttribute('d'),reduced=(compactData.match(/[ML]/g)||[]).length;
            if(experiment)check(reduced<commands.length,'Experimental archive does not exercise the compaction implementation');
            else check(compactData===full&&reduced===commands.length,'Default renderer must preserve the complete original command representation');
            comparison.append(compact,reference);chart.destroy();
            check(JSON.stringify(frame)===frameBefore&&JSON.stringify(data)===before,'Compaction mutated the frame or caller data');check(!host.querySelector('[data-nc-web]'),'Chart owner was not destroyed');
            const compactLength=compactPath.getTotalLength(),referenceLength=fullPath.getTotalLength();check(Number.isFinite(compactLength)&&Number.isFinite(referenceLength)&&compactLength>0,'Invalid native path metrics');
            let maxPositionDifference=0;for(let i=0;i<=256;i++){const fraction=i/256,a=compactPath.getPointAtLength(fraction*compactLength),b=fullPath.getPointAtLength(fraction*referenceLength);maxPositionDifference=Math.max(maxPositionDifference,Math.hypot(a.x-b.x,a.y-b.y))}
            return{scenario,dash,rawPoints:points.length,visibleObservations:frame.observations.length,rawCommands:commands.length,renderedCommands:reduced,rawPathBytes:full.length,renderedPathBytes:compactData.length,native:{compactLength,referenceLength,lengthDifference:Math.abs(compactLength-referenceLength),maxPositionDifference},originalDataAndFrameUnchanged:true,originalKeyboardIdentity:true,controlledSelection:true,completeCsv:true,ownerDestroyed:true};
          },{scenario,dash,experiment});
          // Capture both real SVG trees at exactly the same page position.
          // Different absolute origins can change floating-point raster/AA even
          // for identical paths, so use the unchanged counterpart as a control.
          await page.locator('[data-comparison="reference"]').evaluate(node=>{node.style.display='none';});
          const actualBox=await page.locator('[data-comparison="compact"]').boundingBox();
          const compactPng=await page.locator('[data-comparison="compact"]').screenshot({path:path.join(out,base+'-'+renderedName+'.png')});
          await page.evaluate(()=>{document.querySelector('[data-comparison="compact"]').style.display='none';document.querySelector('[data-comparison="reference"]').style.display='block';});
          const referenceBox=await page.locator('[data-comparison="reference"]').boundingBox();assert.deepEqual(referenceBox,actualBox,'SVG screenshot origins/dimensions must be identical');
          const referencePng=await page.locator('[data-comparison="reference"]').screenshot({path:path.join(out,base+'-reference.png')});
          const pixels=compactPng.equals(referencePng)?{changedPixels:0,maxChannelDifference:0,byteIdentical:true}:await page.evaluate(async({compact,reference})=>{
            const read=async bytes=>{const image=new Image();image.src='data:image/png;base64,'+bytes;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);return{width:image.width,height:image.height,data:context.getImageData(0,0,image.width,image.height).data}};
            const a=await read(compact),b=await read(reference);if(a.width!==b.width||a.height!==b.height)throw Error('Screenshot dimensions differ');let changedPixels=0,maxChannelDifference=0;
            const canvas=document.createElement('canvas');canvas.width=a.width;canvas.height=a.height;const context=canvas.getContext('2d'),diff=context.createImageData(a.width,a.height);
            for(let i=0;i<a.data.length;i+=4){let changed=false;for(let j=0;j<4;j++){const delta=Math.abs(a.data[i+j]-b.data[i+j]);if(delta)changed=true;maxChannelDifference=Math.max(maxChannelDifference,delta)}if(changed){changedPixels++;diff.data[i]=255;diff.data[i+3]=255;}}
            context.putImageData(diff,0,0);return{changedPixels,maxChannelDifference,byteIdentical:false,width:a.width,height:a.height,diffPng:canvas.toDataURL('image/png').split(',')[1]};
          },{compact:compactPng.toString('base64'),reference:referencePng.toString('base64')});
          if(pixels.diffPng){fs.writeFileSync(path.join(out,base+'-diff.png'),Buffer.from(pixels.diffPng,'base64'));delete pixels.diffPng;}
          const entry={...observation,pixels,captureBounds:{actual:actualBox,reference:referenceBox},images:{[renderedName]:{file:base+'-'+renderedName+'.png',sha256:hash(compactPng)},reference:{file:base+'-reference.png',sha256:hash(referencePng)}}};checked.cases.push(entry);save();
          assert(observation.native.maxPositionDifference<=result.limits.nativeGeometryDifferenceSvgUnits,'Native geometry drift > .25 SVG unit: '+JSON.stringify(observation.native));
          assert.equal(pixels.changedPixels,0,'Rendered pixels differ: '+name+'/'+key+' ('+pixels.changedPixels+' changed pixels, max channel delta '+pixels.maxChannelDifference+')');
          console.log('PASS '+(experiment?'compaction experiment ':'path preservation ')+name+'/'+key);
        }catch(error){result.failures.push({browser:name,case:key,error:String(error)});save();console.log('FAIL '+(experiment?'compaction experiment ':'path preservation ')+name+'/'+key+': '+String(error));}
        finally{await page.evaluate(()=>{globalThis.pathFixture?.chart.destroy();delete globalThis.pathFixture;}).catch(()=>{});}
      }
      assert.deepEqual(errors,[],'Unexpected browser errors');
    }finally{clearTimeout(watchdog);await browser.close();result.browsers.push(checked);save();}
  }
  result.status=result.failures.length?'FAIL':'PASS';result.completedAt=new Date().toISOString();save();assert.equal(result.failures.length,0,'Path verification failures; before/after and diffs retained under '+out);
}catch(error){result.status='FAIL';result.error=String(error);save();throw error;}
finally{fs.rmSync(temp,{recursive:true,force:true});}
