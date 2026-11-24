import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
/** Normalize local development resolution to the exact package version in distribution. */
export function packWeb(){
  const out=path.join(root,'artifacts'),work=path.join(root,'work');fs.mkdirSync(out,{recursive:true});fs.mkdirSync(work,{recursive:true});const stage=fs.mkdtempSync(path.join(work,'pack-web-'));
  try{const manifest=JSON.parse(fs.readFileSync(path.join(root,'package.json'))),core=JSON.parse(fs.readFileSync(path.join(root,'node_modules/@neural-charts/core/package.json')));manifest.dependencies={'@neural-charts/core':core.version};delete manifest.devDependencies;manifest.scripts={prepublishOnly:"node -e \"throw Error('Private package: publication is not authorized')\""};
    manifest.files=['dist','README.md','docs/WEB-API.md','docs/CUSTOM-CONTENT.md','docs/core-candidate.json'];
    fs.writeFileSync(path.join(stage,'package.json'),JSON.stringify(manifest,null,2));fs.cpSync(path.join(root,'dist'),path.join(stage,'dist'),{recursive:true});fs.copyFileSync(path.join(root,'README.md'),path.join(stage,'README.md'));
    fs.mkdirSync(path.join(stage,'docs'));for(const name of ['WEB-API.md','CUSTOM-CONTENT.md','core-candidate.json'])fs.copyFileSync(path.join(root,'docs',name),path.join(stage,'docs',name));
    const result=spawnSync('npm',['pack','--ignore-scripts','--json','--pack-destination',out],{cwd:stage,encoding:'utf8'});if(result.status!==0)throw Error(result.stdout+result.stderr);return path.join(out,JSON.parse(result.stdout)[0].filename);
  }finally{fs.rmSync(stage,{recursive:true,force:true});}
}
if(process.argv[1]===import.meta.filename)console.log(packWeb());
