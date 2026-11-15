import type {PlanFrame,PlanObservation} from '@neural-charts/core';
import type {ChartDiagnostic,ChartData,ChartOptions,ChartResult} from './types.js';

interface ContentContext {readonly family:PlanFrame['family'];readonly locale:'en'|'es';readonly defaultText:string;}
export interface ChartTitleContext extends ContentContext {readonly description:string;}
export interface ChartAxisLabelContext extends ContentContext {readonly axis:'x'|'y'|'secondaryY';readonly index:number;readonly tick:Readonly<{label:string;value?:number|string;type?:string}>;}
export interface ChartDataLabelContext extends ContentContext {readonly index:number;readonly observation?:PlanObservation;readonly annotation?:NonNullable<PlanFrame['annotations']>[number];}
export interface ChartLegendContext extends ContentContext {readonly id:string;readonly name:string;readonly color:string;readonly visible:boolean;}
export interface ChartTooltipRow {
  readonly seriesId: string;
  readonly name: string;
  readonly color: string;
  readonly point: PlanObservation | null;
}
export interface ChartTooltipContext extends ContentContext {
  readonly observation: PlanObservation;
  readonly points: readonly PlanObservation[];
  /** Shared tooltip rows include a null point for visible series with a missing measurement. */
  readonly rows?: readonly ChartTooltipRow[];
  readonly selected: boolean;
}
/** Public names for the customizable chart content slots. */
export enum ChartContentSlotName {
  Title = 'title',
  Legend = 'legend',
  Tooltip = 'tooltip',
  AxisLabel = 'axisLabel',
  DataLabel = 'dataLabel',
}

export interface ChartContentContextMap {title:ChartTitleContext;axisLabel:ChartAxisLabelContext;dataLabel:ChartDataLabelContext;legend:ChartLegendContext;tooltip:ChartTooltipContext;}
export type ChartContentKey=keyof ChartContentContextMap;
export type ChartContentContext=ChartContentContextMap[ChartContentKey];
/** The enum and its serialized string select the same context. */
export type ChartContentFor<K extends ChartContentKey>=ChartContentContextMap[`${K}`];
export type ChartRenderContext<K extends ChartContentKey>=ChartContentFor<K>&Readonly<{text:string}>;
export type ChartContentHost<K extends ChartContentKey>=`${K}` extends 'axisLabel'|'dataLabel'?SVGTextElement:HTMLElement;
/** Text is the portable representation. Render only enhances the owned browser host. */
export interface ChartContentSlot<K extends ChartContentKey>{
  readonly text:(context:ChartContentFor<K>)=>string;
  readonly render?:(host:ChartContentHost<K>,context:ChartRenderContext<K>,signal:AbortSignal)=>void|(()=>void);
}
export type ChartContentPorts={readonly [K in ChartContentSlotName]?:ChartContentSlot<K>}&Readonly<{onError?:(diagnostic:ChartDiagnostic)=>void}>;
export interface ChartSvgContentTarget {readonly key:'axisLabel'|'dataLabel';readonly context:ChartAxisLabelContext|ChartDataLabelContext;readonly text:string;}
export type ChartSvgContentTargets=Map<string,ChartSvgContentTarget>;
export const contentKeys:readonly ChartContentKey[]=['title','axisLabel','dataLabel','legend','tooltip'];
const activeText=new WeakSet<object>(),activeErrors=new WeakSet<object>();
function contentDescriptors(value: unknown): PropertyDescriptorMap {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error('INVALID_CONTENT_PORTS');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).length !== Object.keys(descriptors).length) throw Error('INVALID_CONTENT_PORTS');
  return descriptors;
}
function contentValue(descriptor: PropertyDescriptor): unknown {
  if (!Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) throw Error('INVALID_CONTENT_PORTS');
  return descriptor.value;
}
/** Copy capabilities without calling getters or admitting a function into plain options. */
export function ownContent(input:ChartContentPorts|undefined):ChartContentPorts|undefined{
  if(input===undefined)return undefined;
  const result: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(contentDescriptors(input))) {
    const value = contentValue(descriptor);
    if (key === 'onError') {
      if (typeof value !== 'function') throw Error('INVALID_CONTENT_PORTS');
      result[key] = value;
      continue;
    }
    if (!contentKeys.includes(key as ChartContentKey)) throw Error('INVALID_CONTENT_PORTS');
    const entries = contentDescriptors(value);
    if (typeof entries.text?.value !== 'function') throw Error('INVALID_CONTENT_PORTS');
    const slot: Record<string, unknown> = {};
    for (const [field, descriptor] of Object.entries(entries)) {
      const callback = contentValue(descriptor);
      if ((field !== 'text' && field !== 'render') || typeof callback !== 'function') throw Error('INVALID_CONTENT_PORTS');
      slot[field] = callback;
    }
    result[key] = Object.freeze(slot);
  }
  return Object.freeze(result) as ChartContentPorts;
}
/** Validate and copy capabilities before a framework adapter combines template slots. */
export function validateChartContent(input:ChartContentPorts|undefined):ChartResult<ChartContentPorts|undefined>{
  try{return{status:'ok',value:ownContent(input)};}catch{return{status:'invalid',diagnostic:{code:'CUSTOM_CONTENT',reason:'INVALID_CONTENT_PORTS',path:'content',message:'Custom content must contain plain synchronous text/render capability slots.'}};}
}
export function contentFailure(ports:ChartContentPorts|undefined,key:ChartContentKey,reason='CONTENT_TEXT_FAILED'):void{
  const notify=ports?.onError;if(!notify||activeErrors.has(notify))return;activeErrors.add(notify);
  try{notify(Object.freeze({code:'CUSTOM_CONTENT',reason,path:'content.'+key,message:reason==='CONTENT_TEXT_FAILED'?'Custom text must return a synchronous string of at most4096 characters.':'Custom content failed; the portable text was restored.'}));}catch{/* Consumer diagnostics cannot break rendering/cleanup. */}finally{activeErrors.delete(notify);}
}
export function contentText<K extends ChartContentKey>(ports:ChartContentPorts|undefined,key:K,context:ChartContentFor<K>):string{
  const slot=ports?.[key] as ChartContentSlot<K>|undefined;if(!slot)return context.defaultText;
  if(activeText.has(slot.text)){contentFailure(ports,key,'CONTENT_REENTRANCY');return context.defaultText;}activeText.add(slot.text);
  try{const text=slot.text(context);if(typeof text!=='string'||text.length>4096){if(text&&typeof(text as unknown as Promise<unknown>).then==='function')Promise.resolve(text).catch(()=>{});throw Error('INVALID_CONTENT_TEXT');}return text;}
  catch{contentFailure(ports,key);return context.defaultText;}finally{activeText.delete(slot.text);}
}
export function titleContext(frame:PlanFrame,locale:'en'|'es'|undefined,text=frame.title):ChartTitleContext{return Object.freeze({family:frame.family,locale:locale??'en',defaultText:text,description:frame.description});}
/** Header presentation without planning geometry; shared by framework SSR shells. */
export function formatChartTitle(data:Pick<ChartData,'type'>,options:ChartOptions,ports?:ChartContentPorts):string{
  const context:ChartTitleContext=Object.freeze({family:data.type==='column'&&options.layout?.orientation==='horizontal'?'bar':data.type,locale:options.locale??'en',defaultText:options.title??'Chart',description:options.description??''});
  const validated=validateChartContent(ports);return validated.status==='ok'?contentText(validated.value,'title',context):context.defaultText;
}
export function legendContext(frame:PlanFrame,locale:'en'|'es'|undefined,item:PlanFrame['legend'][number]):ChartLegendContext{return Object.freeze({family:frame.family,locale:locale??'en',defaultText:item.name,id:item.id,name:item.name,color:item.color,visible:item.visible});}
