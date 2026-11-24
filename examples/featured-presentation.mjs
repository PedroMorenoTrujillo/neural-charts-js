// Web editorial presentation for the shared data recipes.
export function featureRecipe(recipe) {
  if (recipe.family === 'candlestick' || recipe.family === 'ohlc') {
    return {...recipe, options: {...recipe.options,
      formatting: {
        date: {day: 'numeric', month: 'short', year: 'numeric'},
        number: {minimumFractionDigits: 2, maximumFractionDigits: 2},
      },
      responsive: [{maxWidth: 480, options: {tooltip: {placement: 'below'}}}],
    }};
  }
  if (['ikh', 'pivotpoints', 'psar', 'supertrend', 'zigzag'].includes(recipe.family)) {
    const options = recipe.options;
    const mobile = {
      maxWidth: 480,
      options: {
        axes: {y: {labels: {maxLines: 1, maxCharacters: recipe.family === 'psar' ? 8 : 6}}},
        tooltip: {placement: 'below', maxHeight: 320},
      },
    };
    const previous = (options.responsive ?? []).filter(rule =>
      !(rule.minWidth === undefined && rule.maxWidth === 480 &&
        rule.options.tooltip?.placement === 'below' && rule.options.tooltip?.maxHeight === 320));
    return {...recipe, options: {...options,
      formatting: {
        ...options.formatting,
        date: {day: 'numeric', month: 'short', year: 'numeric'},
        number: {minimumFractionDigits: 2, maximumFractionDigits: recipe.family === 'psar' ? 4 : 2},
      },
      responsive: [...previous, mobile],
    }};
  }
  const key = recipe.family + '/' + recipe.id;
  const titles = {
    'column/stack-groups': ['Pedidos registrados y previstos', 'Compara dos pilas por día. Cada pila separa los pedidos de los equipos A y B.'],
    'bubble/multiple': ['Alcance e interacción por campaña', 'Compara dos grupos de campañas con un umbral de interacción. El área de cada burbuja representa el presupuesto de ejemplo.'],
    'areaspline/stacked': ['Aportaciones durante una campaña', 'Lee el total de actividad y compara tres canales durante el intervalo de campaña destacado.'],
    'mixed/stacked-dual-axes': ['Volumen y objetivo de conversión', 'Compara los volúmenes apilados con una tasa de conversión y su intervalo objetivo en el eje derecho.'],
    'line/labels': ['Destaca observaciones concretas', 'Dos visitas se destacan por ID. Selecciona una observación para fijar su detalle.'],
  };
  if (!Object.hasOwn(titles, key)) return recipe;
  const [title, description] = titles[key];
  const options = { ...recipe.options, title, description };
  const band = (id, axis, from, to, color, opacity, label, valueAxis) => {
    options.referenceBands = [{id, axis, from, to, ...(valueAxis ? {valueAxis} : {})}];
    options.referenceBandStyles = [{id, color, opacity, label}];
  };
  switch (key) {
    case 'column/stack-groups':
      options.appearance = {...options.appearance, colors:['#2C6DCD','#4B8CDE','#B45309','#C47C1A']};
      options.axes = {...options.axes, y:{...options.axes.y, title:'Pedidos'}};
      break;
    case 'bubble/multiple':
      options.appearance = {...options.appearance, colors:['#167E6B','#8B58C2']};
      options.axes = {x:{...options.axes.x,title:'Alcance (miles)'},y:{...options.axes.y,title:'Interacción (%)'}};
      band('engagement-target','y',65,95,'#167E6B',0.16,'Zona objetivo');
      break;
    case 'areaspline/stacked':
      options.appearance = {...options.appearance,series:options.appearance.series.map((style,index)=>({...style,fillOpacity:[.52,.46,.42][index]}))};
      band('campaign-period','x','q3','q5','#2C6DCD',0.13,'Periodo de campaña');
      break;
    case 'mixed/stacked-dual-axes':
      band('conversion-target','y',.55,.7,'#167E6B',0.13,'Objetivo de conversión','secondary');
      break;
    case 'line/labels':
      options.appearance = {...options.appearance,points:[
        {seriesId:'visits',pointId:'day-2',color:'#B45309'},
        {seriesId:'visits',pointId:'day-6',color:'#167E6B'},
      ]};
      options.tooltip = {...options.tooltip,pinnable:true};
      break;
  }
  return {...recipe,title,description,options};
}
