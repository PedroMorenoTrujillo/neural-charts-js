import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {gzipSync,brotliCompressSync} from 'node:zlib';
const root=path.resolve(import.meta.dirname,'..'),consumer=path.resolve(root,'../neural-charts-showcase'),results=[];
const cartesian = ['line', 'spline', 'area', 'column', 'bar', 'stacked-column', 'stacked-bar'];
const general = ['pie', 'donut', 'scatter', 'financial', 'full'];
for(const name of ['root-unused','minimum',...cartesian,...general,'panels','drilldown','cartesian-from-root']){
  const component = name === 'minimum' || cartesian.includes(name) || name === 'cartesian-from-root' ? 'NeuralCartesianChart'
    : name === 'panels' ? 'NeuralChartPanels'
    : name === 'drilldown' ? 'NeuralChartDrilldown' : 'NeuralChart';
  const entryPoint = component === 'NeuralCartesianChart' && name !== 'cartesian-from-root'
    ? '@neural-charts/angular/cartesian' : '@neural-charts/angular';
  const contents=name==='root-unused'?"import{NeuralChart}from'@neural-charts/angular';globalThis.marker=1":`export{${component}}from'${entryPoint}'`;
  const bundle=await build({stdin:{contents,resolveDir:consumer},bundle:true,minify:true,write:false,metafile:true,format:'esm',platform:'browser',target:'es2022',external:['@angular/core','@angular/common']}),bytes=bundle.outputFiles[0].contents;
  assert(Object.keys(bundle.metafile.inputs).every(file=>file==='<stdin>'||path.resolve(file).startsWith(path.join(consumer,'node_modules')+path.sep)),'Only fixture stdin and real installed package archives');
  if(name==='root-unused')assert(bytes.length<100,'Unused APF import is eliminated');
  results.push({name,entryPoint,component,raw:bytes.length,gzip:gzipSync(bytes).length,brotli:brotliCompressSync(bytes).length});
  if(name==='minimum')fs.writeFileSync(path.join(root,'artifacts/bundle-angular-minimum.json'),JSON.stringify(bundle.metafile,null,2));
}
assert(results.find(item => item.name === 'minimum').raw < results.find(item => item.name === 'full').raw,
  'The standalone Cartesian entry point must exclude the general planner');
fs.writeFileSync(path.join(root,'artifacts/angular-bundles.json'),JSON.stringify({recordedAt:new Date().toISOString(),scope:'APF retained library code plus Web/Core; Angular Core/Common peers excluded. Partial declarations are not an AOT application-size claim. The actual AOT/SSR consumer is verified separately in the showcase. Generic family rows intentionally retain the same catalogue.',showcaseBuild:JSON.parse(fs.readFileSync(path.join(consumer,'public/build-info.json'))),results},null,2));
console.log('Measured '+results.length+' Angular package scenarios; root-unused removed, generic family retention explicit.');
