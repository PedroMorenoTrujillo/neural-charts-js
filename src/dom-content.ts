import {contentFailure} from './content.js';
import type {ChartContentFor,ChartContentHost,ChartContentKey,ChartContentPorts,ChartContentSlot} from './content.js';
import {svgNamespace} from './svg.js';

/** Owns only template children. Chart semantics, buttons and SVG geometry stay outside. */
export function createDomContentOwner(win:Window&typeof globalThis,ports:()=>ChartContentPorts|undefined){
  type RecordValue={key:ChartContentKey;token:string;abort:AbortController;cleanup:(()=>void)|undefined};
  const records=new Map<Element,RecordValue>();let destroyed=false;
  function release(host:Element):void{const previous=records.get(host);if(!previous)return;records.delete(host);previous.abort.abort();try{previous.cleanup?.();}catch{if(!destroyed)contentFailure(ports(),previous.key,'CONTENT_CLEANUP_FAILED');}host.removeAttribute('aria-label');host.replaceChildren();}
  function put<K extends ChartContentKey>(host:ChartContentHost<K>,key:K,context:ChartContentFor<K>,text:string,token:string):void{
    if(destroyed)return;
    const slot=ports()?.[key] as ChartContentSlot<K>|undefined;
    if(!slot?.render){release(host);host.textContent=text;return;}
    if(records.get(host)?.token===token)return;
    release(host);if(destroyed)return;host.replaceChildren();host.setAttribute('aria-label',text||context.defaultText);
    const current:RecordValue={key,token,abort:new win.AbortController(),cleanup:undefined};
    // Register before consumer code: destroy/replacement can abort an in-flight render.
    records.set(host,current);
    try{
      if(records.size>512)throw Error('CONTENT_HOST_LIMIT');
      const renderContext=Object.assign({},context,{text});Object.freeze(renderContext);
      const result=slot.render(host,renderContext,current.abort.signal);
      const cleanup=typeof result==='function'?result:undefined;
      if(destroyed||current.abort.signal.aborted||records.get(host)!==current){try{cleanup?.();}catch{}return;}
      current.cleanup=cleanup;
      if(result!==undefined&&typeof result!=='function'){if(result&&typeof(result as unknown as Promise<unknown>).then==='function')Promise.resolve(result).catch(()=>{});throw Error('SYNCHRONOUS_CONTENT_REQUIRED');}
      if(host.querySelectorAll('*').length>100||host.querySelector('button,input,select,textarea,a[href],summary,details,iframe,object,embed,audio,video,label,[tabindex],[contenteditable]:not([contenteditable="false"]),[role="button"],[role="link"],[role="checkbox"],[role="switch"]'))throw Error('PRESENTATIONAL_CONTENT_REQUIRED');
      for(const node of host.querySelectorAll('*')){
        if(node.localName==='a'&&[...node.attributes].some(a=>a.localName==='href'))throw Error('PRESENTATIONAL_CONTENT_REQUIRED');
        if((key==='axisLabel'||key==='dataLabel')&&(node.namespaceURI!==svgNamespace||!['tspan','title'].includes(node.localName)))throw Error('SVG_TEXT_CONTENT_REQUIRED');
      }
    }catch{
      if(records.get(host)!==current)return;
      release(host);if(!destroyed){host.textContent=text;contentFailure(ports(),key,'CONTENT_RENDER_FAILED');}
    }
  }
  function clear(keys?:readonly ChartContentKey[]):void{for(const [host,record]of records)if(!keys||keys.includes(record.key))release(host);}
  return{put,release,clear,destroy:()=>{destroyed=true;clear();}};
}
