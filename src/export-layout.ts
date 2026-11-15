import type {PlanFrame} from '@neural-charts/core';
import {headingStyle,systemFontFamily} from './text-style.js';
import type {ChartOptions,ChartPointId} from './types.js';
import {chartSvg,escapeXml,hasSideLegend,plotBounds,svgOpening} from './svg.js';
import {themeTokens} from './theme.js';
import {seriesStyles,markerElement} from './series-style.js';
import {contentText,titleContext,legendContext,ownContent} from './content.js';
import type {ChartContentPorts} from './content.js';
export interface SvgExportOptions { readonly composition?: 'chart' | 'plot'; readonly legend?: boolean; readonly description?: boolean; readonly content?:ChartContentPorts; }

/** Deterministic export layout; no browser, external fonts or second renderer. */
export function serializeChartExport(frame:PlanFrame,options:ChartOptions,id:string,active?:ChartPointId,selection:readonly ChartPointId[]=[],settings:SvgExportOptions={},containerWidth=options.width??640,colorsByPoint?:ReadonlyMap<string,string>,hiddenLabels?:ReadonlySet<number>):string {
  if(!settings||typeof settings!=='object'||Array.isArray(settings)||settings.composition!==undefined&&!['chart','plot'].includes(settings.composition)||settings.legend!==undefined&&typeof settings.legend!=='boolean'||settings.description!==undefined&&typeof settings.description!=='boolean')throw Error('INVALID_SVG_EXPORT_OPTIONS');
  const custom = ownContent(settings.content);
  let plot = chartSvg(frame,options,id,active,selection,undefined,custom,undefined,colorsByPoint);
  if (hiddenLabels?.size) {
    let label = 0;
    plot = plot.replace(/<g data-label=""/g, tag => hiddenLabels.has(label++) ? tag + ' visibility="hidden" aria-hidden="true"' : tag);
  }
  if (settings.composition === 'plot') return plot;
  const {width:pw,height:ph}=plotBounds(frame,options),pad=20,tokens=themeTokens(options),rtl=options.direction==='rtl';
  const entries=settings.legend===false||options.legend?.visible===false?[]:options.legend?.reverse?[...frame.legend].reverse():frame.legend;
  const position=options.legend?.position??'bottom',side=entries.length>0&&hasSideLegend(options,containerWidth),sideWidth=side?160:0,width=pw+pad*2+sideWidth,contentWidth=width-pad*2,styles=seriesStyles(options);
  const advance=(char:string)=>/[ilI .,:;'!|]/u.test(char)?.75:/[MW@#%]/u.test(char)?2.1:/\p{Lu}/u.test(char)?1.65:/\p{Ll}/u.test(char)?1.3:/\p{N}/u.test(char)?1.4:2.4;
  const wrap=(value:string,limit:number)=>{
    const lines:string[]=[];
    for(const paragraph of value.split(/\r\n?|\n/u)){
      let line='',count=0;
      for(const word of paragraph.match(/\S+/gu) ?? []){
        let size = 0;
        for (const char of word) size += advance(char);
        if(line&&count+.75+size<=limit){line+=' '+word;count+=.75+size;continue;}
        if(line){lines.push(line);line='';count=0;}
        for(const char of word){const width=advance(char);if(line&&count+width>limit){lines.push(line);line='';count=0;}line+=char;count+=width;}
      }
      lines.push(line);
    }
    return lines;
  };
  // SVG start/end follow direction. Start anchors to the right in RTL.
  const text = (x: number, y: number, value: string, size = 12, weight = 400,
    fill = tokens.foreground, anchor?: string) =>
    `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor ?? 'start'}" direction="${rtl?'rtl':'ltr'}"${anchor ? '' : ' style="unicode-bidi:plaintext"'}>${escapeXml(value)}</text>`;
  const title=custom?.title?contentText(custom,'title',titleContext(frame,options.locale,options.title??frame.title)):options.title??frame.title;
  const description = settings.description === false ? '' : options.accessibility?.description ?? options.description ?? frame.description;
  const exportHeading = (value: string, isDescription: boolean, top: number) => {
    const style = headingStyle(isDescription ? options.appearance?.descriptionStyle : options.appearance?.titleStyle, isDescription);
    const align = style.align ?? (rtl ? 'right' : 'left');
    const x = align === 'center' ? width / 2 : align === 'right' ? width - pad : pad;
    const anchor = align === 'center' ? 'middle' : (align === 'right') === rtl ? 'start' : 'end';
    const lines = value ? wrap(value, Math.max(8, Math.floor(contentWidth / (style.fontSize / 2)))) : [];
    const height = style.lineHeight * lines.length;
    const markup = lines.map((line, i) => text(x, top + style.fontSize + i * style.lineHeight, line,
      style.fontSize, style.fontWeight, style.color, anchor)).join('');
    return {height, markup};
  };
  const titleLayout = exportHeading(title, false, pad);
  const descriptionLayout = exportHeading(description, true, pad + titleLayout.height);
  const headerHeight = titleLayout.height + descriptionLayout.height + 12;
  const header = titleLayout.markup + descriptionLayout.markup;
  const legendWidth=side?sideWidth-12:contentWidth,columns=side?1:Math.max(1,Math.min(3,Math.floor(legendWidth/180))),cellWidth=legendWidth/columns,items=entries.map(item=>{const label=custom?.legend?contentText(custom,'legend',legendContext(frame,options.locale,item)):item.name;return{item,label,lines:wrap(label,Math.max(4,Math.floor((cellWidth-26)/7)))}}),rows:number[]=[];
  items.forEach((item,i)=>{const row=Math.floor(i/columns);rows[row]=Math.max(rows[row]??0,item.lines.length*17+10);});const offsets:number[]=[];let legendHeight=0;for(const height of rows){offsets.push(legendHeight);legendHeight+=height;}
  const topLegend=!side&&position==='top'?legendHeight+12:0,plotX=pad+(side&&position==='left'?sideWidth:0),plotY=pad+headerHeight+topLegend,legendX=side?(position==='left'?pad:pad+pw+12):pad,legendY=side?plotY:position==='top'?pad+headerHeight:plotY+ph+16,height=plotY+Math.max(ph,side?legendHeight:ph+(!side&&entries.length&&position!=='top'?legendHeight+16:0))+pad;
  const patterns=new Map<string,string>();let patternIndex=0;for(const item of frame.legend) {const style=styles.get(item.id);if(style?.pattern&&style.pattern!=='none')patterns.set(item.id,`${id}-pattern-${patternIndex++}`);}
  let legend='';items.forEach(({item,label:legendLabel,lines},i)=>{const column=rtl?columns-1-i%columns:i%columns,row=Math.floor(i/columns),x=legendX+column*cellWidth,y=legendY+offsets[row]!,markX=rtl?x+cellWidth-14:x,tx=rtl?x+cellWidth-22:x+22,index=frame.legend.findIndex(s=>s.id===item.id),style=styles.get(item.id),color=style?.color??options.appearance?.colors?.[index%(options.appearance.colors.length||1)]??item.color,pattern=patterns.get(item.id),fill=pattern?`url(#${pattern})`:color;
    const sourceSeries=frame.series.find(s=>s.id===item.id),lineSeries=!!sourceSeries?.commands&&!sourceSeries.fill&&!sourceSeries.areaCommands;
    legend+=`<g data-export-legend="${escapeXml(item.id)}" opacity="${item.visible?1:.45}"><title>${escapeXml(legendLabel)}</title>${lineSeries?`<path d="M${markX},${y+7} h14" stroke="${color}" stroke-width="2"${style?.dash==='dashed'?' stroke-dasharray="4 3"':style?.dash==='dotted'?' stroke-dasharray="1 3"':''}/>${style?.marker?markerElement(style.marker,markX+7,y+7,3,`fill="${color}"`):''}`:`<rect x="${markX}" y="${y+2}" width="14" height="10" fill="${fill}"/>`}${lines.map((s,j)=>text(tx,y+12+j*17,s)).join('')}${!item.visible?`<path d="M${tx},${y+7} h${(rtl?-1:1)*Math.min(cellWidth-26,legendLabel.length*7)}" stroke="${tokens.foreground}"/>`:''}</g>`;});
  const drawing=plot.replace('<svg ',`<svg x="${plotX}" y="${plotY}" aria-hidden="true" `).replace(/ role="img" lang="[^"]*" aria-labelledby="[^"]*"/,'');
  return `${svgOpening(width, height, options.locale, id, 'export')} style="font-family:${systemFontFamily};background:${tokens.background}"><title id="${id}-export-title">${escapeXml(title)}</title><desc id="${id}-export-desc">${escapeXml(options.accessibility?.description??description)}</desc><rect data-export-background="" width="${width}" height="${height}" fill="${tokens.background}"/><g data-export-header="">${header}</g>${drawing}<g data-export-legend-group="">${legend}</g></svg>`;
}
