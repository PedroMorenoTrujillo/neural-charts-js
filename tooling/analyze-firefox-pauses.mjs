import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'artifacts/five-point-closure/firefox-pauses'),profile=JSON.parse(fs.readFileSync(path.join(out,'gecko.json'),'utf8')),rows=[];
function visit(process){
 for(const thread of process.threads??[]){
  const schema=thread.markers?.schema;if(!schema)continue;
  const markers=thread.markers.data;
  const measures=markers.filter(row=>row[schema.data]?.type==='UserTiming'&&row[schema.data]?.entryType==='measure'&&/^nc:(zoom|pan):\d+$/.test(row[schema.data]?.name??''));
  // A GCMajor spans the incremental collection lifetime, including mutator
  // work. Only actual stopping slices/minor collections enter this union.
  const pauses=markers.filter(row=>['GCMinor','GCSlice','CCSlice'].includes(row[schema.data]?.type)&&row[schema.endTime]>=row[schema.startTime]);
  for(const row of measures){
   const start=row[schema.startTime],end=row[schema.endTime],overlaps=pauses.map(pause=>[Math.max(start,pause[schema.startTime]),Math.min(end,pause[schema.endTime])]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
   let duration=0,last=-Infinity;for(const [a,b]of overlaps){duration+=Math.max(0,b-Math.max(a,last));last=Math.max(last,b);}
   rows.push({name:row[schema.data].name,milliseconds:end-start,stoppingGcMilliseconds:duration,nonGcMilliseconds:end-start-duration});
  }
 }
 for(const child of process.processes??[])visit(child);
}
visit(profile);assert.equal(rows.length,60,'Expected thirty zoom and thirty pan diagnostic measures');
const result={status:'MEASURED',recordedAt:new Date().toISOString(),scope:'Local instrumented Firefox profile; union of overlapping GCMinor/GCSlice/CCSlice intervals on the same content main thread. GCMajor lifetimes deliberately excluded because incremental GC lifetimes include mutator work. Not a replacement for uninstrumented p95 or a claim that GC overhead is solved.',rows};
fs.writeFileSync(path.join(out,'analysis.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({measures:rows.length,slowest:rows.reduce((a,b)=>a.milliseconds>b.milliseconds?a:b)}));
