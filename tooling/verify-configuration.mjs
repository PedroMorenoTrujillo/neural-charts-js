import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {chromium,firefox,webkit} from '@playwright/test';
import {packWeb} from './pack-web.mjs';
import {webExtensions} from '../examples/web-extensions.mjs';

const root=path.resolve(import.meta.dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'nc-config-')),out=path.resolve(root,process.env.NEURAL_REVIEW_ARTIFACTS??'artifacts/configuration-review');
fs.mkdirSync(out,{recursive:true});
const core=JSON.parse(fs.readFileSync(path.join(root,'docs/core-candidate.json'))),archive=packWeb(),results={recordedAt:new Date().toISOString(),archiveSha256:createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),core,browsers:[],humanScreenReaders:'PENDING MANUAL'};
try {
  fs.writeFileSync(path.join(temp,'package.json'),JSON.stringify({name:'private-configuration-consumer',private:true,type:'module'}));
  const installed=spawnSync('npm',['install',archive,path.join(root,core.archive),'--offline','--ignore-scripts','--no-audit','--no-fund'],{cwd:temp,encoding:'utf8'});if(installed.status)throw Error(installed.stdout+installed.stderr);
  const bundle=await build({stdin:{contents:"import{createChart,renderChartSvg}from'@neural-charts/web';globalThis.NC={createChart,renderChartSvg};globalThis.RECIPES="+JSON.stringify(webExtensions),resolveDir:temp},bundle:true,write:false,minify:true,format:'iife',platform:'browser'});
  for(const [name,engine]of Object.entries({chromium,firefox,webkit})) {
    const browser=await engine.launch();try {
      const page=await browser.newPage({viewport:{width:1200,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.setContent('<!doctype html><html lang="en"><title>Configuration review</title><body><main><h1>Charts configuration</h1><div id="host" style="width:900px"></div></main></body></html>');await page.addScriptTag({content:bundle.outputFiles[0].text});
      await page.evaluate(()=>{
        const check=(v,m)=>{if(!v)throw Error(m)},data={type:'line',axes:{x:{type:'linear'},y:{type:'linear'}},series:[{id:'s',name:'Revenue',data:Array.from({length:301},(_,i)=>({id:'p'+i,x:i,y:i%17===3?null:Math.sin(i/17)*2000}))}]};
        const options={title:'Revenue',description:'Original context',height:380,legend:{position:'right'},animation:{enabled:false},appearance:{markers:true,series:[{id:'s',color:'#9b3150',dash:'dashed',marker:'diamond'}]},formatting:{number:{style:'currency',currency:'EUR',maximumFractionDigits:1}},accessibility:{description:'Revenue by measurement. Gaps are missing data.',announceDataChanges:true,seriesDescriptions:[{id:'s',description:'Audited revenue'}],pointDescriptions:[{id:{seriesId:'s',pointId:'p0'},description:'Start of the reporting period'}]},responsive:[{maxWidth:430,options:{height:280,legend:{position:'bottom'},tooltip:{placement:'docked'},appearance:{markers:false}}}]};
        const host=document.getElementById('host'),r=NC.createChart(host,data,options,{instanceId:'configuration'});check(r.status==='ok',JSON.stringify(r));globalThis.fixture={chart:r.value,data,options,check};
        const root=host.querySelector('[data-nc-web]');check(root.getAttribute('aria-describedby').includes('configuration-description'),'Description not connected');check(host.querySelector('svg desc').textContent===options.accessibility.description,'SVG description missing');
        check(host.querySelector('[data-series="s"]').getAttribute('stroke-dasharray')==='6 4','Dash absent');check(!!host.querySelector('[data-series="s"]')&&!!host.querySelector('polygon[data-observation]'),'Marker shape absent');check(host.querySelector('[data-action="legend"] span').style.color==='rgb(155, 49, 80)','Legend color differs');
        root.focus();root.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));const status=host.querySelector('[role="status"]');check(status.textContent.includes('Audited revenue')&&status.textContent.includes('Start of the reporting period'),'Point/series description missing');
        const spoken=status.textContent,o=r.value.getFrame().observations[5],svg=host.querySelector('svg'),box=svg.getBoundingClientRect(),ratio=box.width/(r.value.getFrame().width+156);
        svg.dispatchEvent(new PointerEvent('pointermove',{clientX:box.left+(o.x+128)*ratio,clientY:box.top+(o.y+22)*ratio,pointerType:'mouse',bubbles:true}));check(status.textContent===spoken,'Hover flooded live status');
        check(!host.querySelector('tbody'),'Table not deferred');const table=host.querySelector('details');table.open=true;table.dispatchEvent(new Event('toggle'));check(host.querySelector('tbody').rows.length===100,'Page size wrong');
        const next=host.querySelector('[data-action="table-next"]');next.focus();next.click();check(document.activeElement.dataset.action==='table-next','Pager lost focus');const first=host.querySelector('tbody tr').textContent;
        r.value.updateOptions({...options,title:'New title'});check(host.querySelector('tbody tr').textContent===first,'Options reset table page');check(document.activeElement.dataset.action==='table-next','Update lost table focus');
        const changed={...data,series:[{...data.series[0],data:data.series[0].data.map((p,i)=>i===0?{...p,y:123.456789}:p)}]};check(r.value.update(changed,options).status==='ok','Data update failed');check(status.textContent.startsWith('Data updated.'),'Data announcement missing');check(host.querySelector('tbody').textContent.includes('123.456789'),'Raw data was rounded');
        globalThis.fixture.data=changed;globalThis.fixture.desktopHeight=r.value.getFrame().height;globalThis.fixture.desktopWidth=r.value.getFrame().width;
      });
      const sizes=[];
      for(const width of [320,375,430,768,900]) {
        await page.evaluate(width=>document.getElementById('host').style.width=width+'px',width);
        await page.waitForFunction(width=>{const f=fixture.chart.getFrame();return f.height===(width<=430?202:302)&&f.width===Math.max(64,width-196-(width>=600?160:0))},width);
        const info=await page.evaluate(width=>{const {check,chart,desktopWidth}=fixture;check(width!==900||chart.getFrame().width===desktopWidth,'Base geometry not restored');check(document.documentElement.scrollWidth<=innerWidth,'Horizontal overflow');return {width,frame:{width:chart.getFrame().width,height:chart.getFrame().height}}},width);
        await page.screenshot({path:path.join(out,name+'-'+width+'.png'),fullPage:true});sizes.push(info);
      }
      const audit=[];await page.addScriptTag({path:path.join(root,'node_modules/axe-core/axe.min.js')});
      for(const theme of ['light','dark'])for(const direction of ['ltr','rtl']) {
        await page.evaluate(({theme,direction})=>fixture.chart.updateOptions({...fixture.options,theme,direction}),{theme,direction});
        const a=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return {passes:r.passes.length,violations:r.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))}});assert.deepEqual(a.violations,[]);audit.push({theme,direction,...a});
      }
      const boundary=await page.evaluate(async()=>{
        const {chart,options,data,check}=fixture,host=document.getElementById('host'),root=host.querySelector('[data-nc-web]');
        check(chart.updateOptions({...options,accessibility:{keyboard:false}}).status==='ok','Keyboard policy rejected');check(root.tabIndex===-1,'Disabled keyboard left a dead tab stop');const before=chart.exportSvg();root.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));check(chart.exportSvg()===before,'Disabled keyboard moved focus');
        const urls=new Set(),create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=value=>{const url=create(value);urls.add(url);return url};URL.revokeObjectURL=url=>{urls.delete(url);revoke(url)};
        const png=await chart.exportPng({width:800,pixelRatio:2});check(png.type==='image/png'&&png.size>1000,'PNG missing');check(!urls.size,'Export Blob URL retained');
        const raw=chart.exportSvg();check(new TextEncoder().encode(raw).byteLength>1000&&!raw.includes('data-nc-path'),'SVG not materialized');
        const stale=host.querySelector('[data-action="table-next"]'),tbody=host.querySelector('tbody'),text=tbody.textContent;chart.destroy();stale.click();check(tbody.textContent===text,'Detached pager retained a live handler');check(!host.querySelector('[data-nc-web]'),'Chart retained after destroy');
        const observer=new MutationObserver(()=>{});observer.disconnect();URL.createObjectURL=create;URL.revokeObjectURL=revoke;
        return {deferredTable:true,pagingFocus:true,rawPrecision:true,hoverQuiet:true,keyboardDescriptions:true,responsiveRestoration:true,keyboardPolicy:true,pngBytes:png.size,svgBytes:new TextEncoder().encode(raw).byteLength,blobUrlsReleased:true,detachedPagerInert:true};
      });
      const extensions=[];
      for(const width of [375,768])for(let i=0;i<webExtensions.length;i++) {
        const result=await page.evaluate(async({width,i})=>{
          const recipe=RECIPES[i],host=document.getElementById('host'),check=(v,m)=>{if(!v)throw Error(m)};host.style.width=width+'px';
          const options={...recipe.options,theme:i%2?'dark':'light',direction:i%2?'rtl':'ltr',animation:{enabled:false},axes:{...recipe.options.axes,x:{...recipe.options.axes?.x,labels:{rotation:-25,maxLines:1,maxCharacters:8}}},legend:{...recipe.options.legend,reverse:true,maxLabelCharacters:12,itemSpacing:12}};
          const activated=[],r=NC.createChart(host,recipe.data,options,{instanceId:'extension',onPointActivate:e=>activated.push(e.id)});check(r.status==='ok',JSON.stringify(r));globalThis.extension=r.value;const root=host.querySelector('[data-nc-web]');root.focus();root.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));root.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));check(activated.length===1,'Duplicate/missing activation');check(r.value.getSelection()[0].pointId===activated[0].pointId,'Selection identity wrong');
          if(recipe.family==='mixed')check(host.querySelectorAll('pattern').length>=2,'Missing SVG patterns');
          const svg=r.value.exportSvg(),xml=new DOMParser().parseFromString(svg,'image/svg+xml');check(!xml.querySelector('parsererror'),'Malformed export');check(xml.querySelector('[data-export-header] text').textContent===options.title,'Visible exported title missing');check(xml.querySelectorAll('[data-export-legend]').length===r.value.getFrame().legend.length,'Visible legend missing');
          const stage=document.createElement('div');stage.style.cssText='position:absolute;left:-20000px;top:0';const exported=document.importNode(xml.documentElement,true);stage.append(exported);document.body.append(stage);const ew=Number(exported.getAttribute('width')),eh=Number(exported.getAttribute('height'));
          for(const text of exported.querySelectorAll('[data-export-header] text,[data-export-legend] text')){const b=text.getBBox();check(b.x>=-.5&&b.x+b.width<=ew+.5&&b.y>=-.5&&b.y+b.height<=eh+.5,'Exported text clipped: '+text.textContent);}
          stage.remove();
          const blob=await r.value.exportPng({width:600}),url=URL.createObjectURL(blob),image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url});
          const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);const scale=image.width/Number(xml.documentElement.getAttribute('width')),headerHeight=Math.max(1,Math.floor(Number(xml.querySelector('svg svg').getAttribute('y'))*scale)),pixels=context.getImageData(0,0,image.width,headerHeight).data,bg=pixels.slice(0,3);let ink=0;for(let p=0;p<pixels.length;p+=4)if(Math.abs(pixels[p]-bg[0])+Math.abs(pixels[p+1]-bg[1])+Math.abs(pixels[p+2]-bg[2])>60)ink++;check(ink>10,'PNG lost visible title/description');URL.revokeObjectURL(url);image.src='';canvas.width=canvas.height=0;
          const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let j=0;j<bytes.length;j+=16384)binary+=String.fromCharCode(...bytes.subarray(j,j+16384));
          check(r.value.updateOptions({...options,legend:{...options.legend,interactive:false}}).status==='ok','Static legend rejected');check(!host.querySelector('[data-action="legend"]'),'Static legend still interactive');check(!host.querySelector('span[aria-pressed]'),'Invalid static legend ARIA');
          return {family:recipe.family,id:recipe.id,width,theme:options.theme,direction:options.direction,activationOnce:true,patterns:host.querySelectorAll('pattern').length,visibleExport:true,pngHeaderInk:ink,pngBytes:bytes.length,png:btoa(binary)};
        },{width,i});
        fs.writeFileSync(path.join(out,name+'-'+result.family+'-'+result.id+'-'+width+'-export.png'),Buffer.from(result.png,'base64'));delete result.png;extensions.push(result);await page.locator('[data-nc-web]').screenshot({path:path.join(out,name+'-'+result.family+'-'+result.id+'-'+width+'.png')});await page.evaluate(()=>{extension.destroy();globalThis.extension=undefined});
      }
      const longText=await page.evaluate(()=>{const host=document.getElementById('host'),recipe=RECIPES[0],checked=[];host.style.width='375px';for(const direction of ['ltr','rtl']){const data={...recipe.data,series:recipe.data.series.map((s,i)=>({...s,name:'W'.repeat(80)+' · '+i}))},r=NC.createChart(host,data,{...recipe.options,title:'W'.repeat(120),direction,width:375},{instanceId:'long-export'});if(r.status!=='ok')throw Error(JSON.stringify(r));const xml=new DOMParser().parseFromString(r.value.exportSvg(),'image/svg+xml'),svg=document.importNode(xml.documentElement,true);host.append(svg);const width=Number(svg.getAttribute('width')),height=Number(svg.getAttribute('height'));for(const text of svg.querySelectorAll('[data-export-header] text,[data-export-legend] text')){const b=text.getBBox();if(b.x<-.5||b.x+b.width>width+.5||b.y<-.5||b.y+b.height>height+.5)throw Error('Long export text clipped');}svg.remove();r.value.destroy();checked.push(direction);}return checked;});
      assert.deepEqual(errors,[]);results.browsers.push({name,version:browser.version(),sizes,audit,boundary,extensions,longText});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log('PASS configuration, accessibility, responsive and PNG cleanup: '+name);
    }finally{await browser.close()}
  }
}finally{fs.rmSync(temp,{recursive:true,force:true})}
