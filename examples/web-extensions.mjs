/** Web-owned variants extending the read-only Native reference catalogue. */
const categories=['Q1','Q2','Q3','Q4','Q5','Q6'].map((label,i)=>({id:'q'+i,label}));
const series=[{id:'direct',name:'Directo',values:[18,28,22,36,30,42]},{id:'partner',name:'Colaboradores',values:[12,16,24,19,27,24]},{id:'online',name:'En línea',values:[8,14,12,20,17,28]}];
const smoothAreas=['sum','percent'].map(stacking=>({
  family:'areaspline',id:stacking==='sum'?'stacked':'stacked-percent',
  title:stacking==='sum'?'Área suave apilada':'Área suave apilada al 100 %',
  description:stacking==='sum'?'Compara contribuciones con límites suaves compartidos y sin sobrepasar los valores.':'Compara proporciones conservando los valores originales en el tooltip y la tabla.',
  data:{type:'areaspline',axes:{x:{type:'category',values:categories},y:{type:'linear'}},series:series.map(s=>({id:s.id,name:s.name,data:s.values.map((y,i)=>({id:s.id+'-'+i,x:categories[i].id,y}))}))},
  options:{title:stacking==='sum'?'Contribución por canal':'Participación por canal',height:380,layout:{stacking},appearance:{markers:false,stackLabels:true,series:[{id:'direct',color:'#2c6ed5',dash:'solid'},{id:'partner',color:'#698e37',dash:'dashed'},{id:'online',color:'#9a55a5',dash:'dotted'}]},legend:{visible:true,position:'bottom'},tooltip:{content:'shared',crosshair:true},viewport:{axes:'x'},responsive:[{maxWidth:430,options:{height:300,tooltip:{placement:'docked'}}}],accessibility:{description:stacking==='sum'?'Las áreas suaves apiladas comparan las aportaciones de tres canales. Consulta los valores originales en la tabla.':'Las aportaciones mostradas suman el 100 por ciento; el tooltip y la tabla conservan los valores originales de cada canal.'}}
}));
const mixed=['sum','percent','dual'].map(mode=>({
  family:'mixed',id:mode==='sum'?'stacked-columns':mode==='percent'?'stacked-percent':'stacked-dual-axes',
  title:mode==='dual'?'Columnas apiladas y porcentaje en otro eje':mode==='percent'?'Columnas al 100 % con línea':'Columnas apiladas, área y línea',
  description:mode==='dual'?'El apilado conserva valores originales; la línea utiliza su propio eje porcentual.':'Comparte categorías y consulta valores originales de cada representación.',
  data:{type:'mixed',axes:{x:{type:'category',values:categories},y:{type:'linear'},...(mode==='dual'?{secondaryY:{type:'linear'}}:{})},series:[
    ...series.slice(0,2).map((s,si)=>({id:s.id,name:s.name,type:'column',data:s.values.map((y,i)=>({id:s.id+'-'+i,x:categories[i].id,y:mode==='sum'&&i===2?-y:y}))})),
    {id:'target',name:'Objetivo',type:'line',...(mode==='dual'?{yAxis:'secondary'}:{}),data:[35,44,40,62,58,74].map((y,i)=>({id:'target-'+i,x:categories[i].id,y:mode==='dual'?y/100:y}))},
    ...(mode==='sum'?[{id:'baseline',name:'Base',type:'area',data:[8,10,12,14,16,18].map((y,i)=>({id:'baseline-'+i,x:categories[i].id,y}))}]:[])
  ]},
  options:{title:mode==='dual'?'Totales por canal y conversión':'Comparación de canales apilados',height:400,layout:{stacking:mode==='percent'?'percent':'sum'},appearance:{stackLabels:true,markers:false,series:[{id:'direct',color:'#2c6ed5',pattern:'diagonal'},{id:'partner',color:'#698e37',pattern:'dots'},{id:'target',color:'#9a3d64',dash:'dashed'},{id:'baseline',color:'#8294b0',fillOpacity:.12}]},axes:{x:{title:'Trimestre'},y:{title:mode==='percent'?'Participación (%)':'Volumen'},...(mode==='dual'?{secondaryY:{title:'Conversión',numberFormat:{style:'percent',maximumFractionDigits:0}}}:{})},legend:{position:'bottom'},tooltip:{content:'shared',crosshair:true},viewport:{axes:'x'},responsive:[{maxWidth:430,options:{height:300,legend:{maxLabelCharacters:18},tooltip:{placement:'docked'}}}]}
}));
export const webExtensions=[...smoothAreas,...mixed];
