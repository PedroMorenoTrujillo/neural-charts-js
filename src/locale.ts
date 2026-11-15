const translations = {
  pin: ["Pin detail","Fijar detalle"],
  unpin: ["Unpin detail","Desfijar detalle"],
  pinned: ["Pinned detail","Detalle fijado"],
  updated: ["Data updated. ","Datos actualizados. "],
  visibleObservations: [" visible observations."," observaciones visibles."],
  category: ["Category ","Categoría "],
  date: ["Date ","Fecha "],
  chart: ["Chart","Gráfico"],
  empty: ["No visible observations.","No hay observaciones visibles."],
  selected: ["Selected","Seleccionado"],
  table: ["View original data","Ver datos originales"],
  originals: ["original observations, including missing and hidden values","observaciones originales, incluidos valores ausentes y series ocultas"],
  previous: ["Previous page","Página anterior"],
  next: ["Next page","Página siguiente"],
  hide: ["Hide ","Ocultar "],
  show: ["Show ","Mostrar "],
  zoomIn: ["Zoom in","Acercar"],
  zoomOut: ["Zoom out","Alejar"],
  reset: ["Reset zoom","Restablecer zoom"],
  zoom: ["Zoom","Zoom"],
  horizontalScroll: ["Scroll across the chart","Desplazamiento horizontal de la gráfica"],
  help: ["Arrow keys explore observations. Home and End move to endpoints. Enter or Space selects. Escape closes detail. Data table contains original values.","Las flechas recorren los datos. Inicio y Fin buscan los extremos. Enter o Espacio seleccionan. Escape cierra el detalle. La tabla conserva los valores originales."],
  series: ["Series","Serie"],
  visible: ["Visible","Visible"],
  yes: ["Yes","Sí"],
  no: ["No","No"],
  missing: ["Missing measurement","Medición ausente"],
  open: ["Open","Apertura"],
  high: ["High","Máximo"],
  low: ["Low","Mínimo"],
  close: ["Close","Cierre"],
  volume: ["Volume","Volumen"],
  intervalStart: ["Start","Inicio"],
  intervalEnd: ["End","Fin"],
  duration: ["Duration","Duración"],
  selfDuration: ["Self duration","Duración propia"],
  completed: ["Completed","Completado"],
  target: ["Target","Objetivo"],
  median: ["Median","Mediana"],
  samples: ["Samples","Muestras"],
  size: ["Size","Tamaño"],
  windDirection: ["Direction","Dirección"],
  toolbar: ["Chart tools","Herramientas de la gráfica"],
  downloads: ["Downloads","Descargas"],
} as const;

type Messages = Readonly<Record<keyof typeof translations, string>>;
function labelsFor(language: 0 | 1): Messages {
  return Object.freeze(Object.fromEntries(Object.entries(translations).map(([key, labels]) => [key, labels[language]]))) as Messages;
}
const english = /* @__PURE__ */ labelsFor(0);
const spanish = /* @__PURE__ */ labelsFor(1);
export function messages(locale: 'en' | 'es' = 'en'): Messages {
  return locale === 'es' ? spanish : english;
}
