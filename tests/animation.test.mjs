import test from 'node:test';
import assert from 'node:assert/strict';
import {chartMotion} from '../dist/animation.js';
test('animation shares a live media query across chart lifetimes without adding listeners',()=>{
  let queries=0,animations=0,cancels=0;
  const preference={matches:false},window={matchMedia:()=>{queries++;return preference}};
  const geometry={animate:(frames)=>{
    assert.equal(frames[0].clipPath,'inset(0 100% 0 0)');
    animations++;
    return {cancel(){cancels++;}};
  }};
  const target={animate:geometry.animate,querySelector:()=>({querySelector:()=>geometry})};
  const frame=()=>({family:'line',observations:[{}]});
  const options={animation:{enabled:true,duration:100}};
  for(let i=0;i<100;i++){const motion=chartMotion(window,target,frame);motion.apply(options,true);motion.destroy();motion.apply(options,true);}
  assert.equal(queries,1);assert.equal(animations,100);assert.equal(cancels,100);
  preference.matches=true;const next=chartMotion(window,target,frame);next.apply(options,true);assert.equal(animations,100);
  preference.matches=false;next.apply(options,true);assert.equal(animations,101);next.destroy();assert.equal(cancels,101);assert.equal(queries,1);
});
