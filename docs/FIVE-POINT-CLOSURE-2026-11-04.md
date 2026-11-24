# Neural Charts — cierre de los cinco puntos, 2026-11-04

Estado: implementaciones funcionales y regresiones automatizadas PASS. Rendimiento y memoria MEDIDOS, con riesgo de latencia Firefox a 50k y retención del catálogo completo en el adapter Angular genérico. Los presupuestos históricos de bundle y las revisiones humanas siguen PENDING; este informe no certifica una release ni sustituye esas aprobaciones. No se afirma rendimiento máximo universal.

## 1. Resultado por punto

| Punto | Resultado comprobado | Pendientes |
|---|---|---|
| Combinados apilados | Columnas apiladas con Line/Area independientes, signos separados, porcentajes y dos ejes; cinco ejemplos nuevos | Aceptación visual humana |
| Configuración y accesibilidad | Formatos numéricos/fecha, ejes y labels, leyendas, patrones/marcadores/dashes, reglas responsive y descripciones accesibles | VoiceOver/Safari y NVDA/Firefox manuales |
| Exportación fiel | SVG y PNG con título, descripción y leyenda; posiciones de leyenda, tema, RTL y patrones | Aceptación visual humana |
| Rendimiento y empaquetado | Optimización real, mediciones p50/p95, memoria y matriz de importaciones; importación cartesiana sin otros motores | Latencia Firefox a 50k, retención Angular genérica y excesos de bundle; no se declara cierre de esos gates |
| Regresión Angular/showcase | 3624 comprobaciones del catálogo, SSR/hydration, interacción, lifecycle y documentación compilada | Las limitaciones manuales anteriores |

Catálogo: 30 familias analíticas principales; 71 representaciones/subtipos base y 47 indicadores financieros por separado. Hay 604 ejemplos únicos: los 599 anteriores y cinco variantes nuevas. JavaScript y Angular consumen los mismos ejemplos; no se suman como tipos diferentes. Los registros internos de navegación no son el número de familias analíticas.

## 2. Implementación

### Core compartido

Trabajo sólo en el worktree aislado `/Users/pedromorenotrujillo/Documents/neural/.worktrees/charts-web-performance`, rama `codex/charts-web-performance`. Core original y worktree previo permanecen limpios en sus HEAD originales. Cero dependencias runtime externas; sin DOM, Angular o motores gráficos externos.

- Corrección del límite de transformación de viewport categórico para coincidir con la capacidad declarada; Y conserva su contrato de intervalo.
- Reutilización validada de entradas completamente inmutables, con cobro de presupuestos de nodos/caracteres/profundidad. Metadatos de caché agrupados para evitar presión por objeto.
- Caché acotada de normalización Line para viewport/resize/visibilidad, sin confiar en identidad de objetos mutables ni omitir validaciones.
- Metadatos de valores reales de ticks numéricos/temporales, sin reconstruir números desde labels redondeados.
- Areaspline apilado sum/percent: límites compartidos y subdivisión coherente; no se cambia la interpolación de Line ni el área lineal existente.
- Stacking de columnas mixtas: acumuladores positivo/negativo, segmentos con identidad original, líneas/áreas independientes y dominios por eje. Dos ejes usan subslots separados y orden estable. El porcentaje mantiene las restricciones existentes frente a negativos y datos incompletos.
- Preparación logarítmica de Scatter separada para que el entrypoint cartesiano no retenga validación/geometría de Scatter.

Ocho commits locales Core: `55d3b81`, `7e534cb`, `cfffa68`, `9696465`, `1b35106`, `ef2322d`, `e2c3a4e`, `702d79e`. Contratos específicos en `STACKED-AREASPLINE-CONTRACT.md` y `MIXED-STACKING-CONTRACT.md` de ese worktree. No se han editado los 26 archivos congelados de NC-01A.

### Web JavaScript/TypeScript

Se mantiene un renderer SVG propio sobre Core, sin geometría duplicada en Angular. Las importaciones cartesianas excluyen WordCloud/Scatter y otros motores no utilizados. Datos originales, identidad, valores de tooltip/CSV y acceso completo mediante tabla se conservan.

API nueva real: `ChartController.updateOptions`, `ChartResponsiveRule`, `ChartAccessibilityOptions`, `ChartNumberFormat`, `ChartDateFormat`, `ChartSeriesStyle`, `ChartAxisOptions`, `SvgExportOptions` y paginación de `describeChartData`.

Las reglas responsive resuelven contra el contenedor, en orden de declaración; hasta 32 reglas, con límites inclusivos y restauración de opciones base. Se valida la configuración efectiva combinada. Formato Intl acotado a 64 entradas; fechas UTC por defecto y zona horaria explícita cuando se configura. No se modifica el valor original del dato para presentarlo.

Ejes admiten formato propio, hasta tres líneas de etiquetas, límite de caracteres y rotación entre −90 y 90 grados; insets, hit testing y gestos utilizan el mismo layout. Series admiten color, dash, marcador, opacidad y patrones SVG internos diagonal/dots/crosshatch. Leyenda admite interacción opcional, orden inverso, espaciado y abreviación conservando nombre completo accesible.

La tabla se calcula al abrirla y pagina el formateo en bloques de 100; CSV conserva todas las filas originales. Se corrige el foco al desaparecer/deshabilitar un paginador. Hover no satura la región viva; teclado/activación anuncian el contexto. Descripciones por gráfico/serie/punto y anuncio de cambios opcional. Deshabilitar navegación del plot no elimina el acceso a controles y datos.

Se conservan geometría, índices, nodos SVG y strings de paths cuando el cambio no los invalida. Inputs mutables siguen inspeccionándose; un cambio real de datos no se oculta por identidad. Listeners delegados y recursos tienen owner y cleanup.

### Exportación

El controller exporta por defecto la composición visible completa, incluyendo título, descripción y leyenda. `composition:'plot'` ofrece explícitamente sólo el plot. La función pura `renderChartSvg` conserva por defecto el escenario plot usado por SSR; la composición chart es explícita. Angular exporta chart por defecto tanto con controller como desde su fallback de servidor.

SVG autocontenido, sin recursos externos obligatorios. PNG rasteriza ese SVG mediante Canvas como herramienta de exportación, sin cambiar el renderer interactivo. Validaciones bloquean etiquetas/atributos inseguros y recursos externos. Patrones seguros soportados por serializer, rasterizador y proyección estática Angular. Blob URLs liberadas.

Se detectó y corrigió clipping RTL de texto exportado y separación artificial de palabras/números. Las pruebas comprueban bounding boxes reales además de presencia de tinta; incluyen títulos de 120 caracteres, nombres largos, LTR/RTL, mobile/desktop y PNG materializado.

### Angular y showcase

Adapter fino con signals/OnPush, zoneless y recursos sólo en navegador. `updateOptions` cuando la referencia readonly de datos no cambia; actualizaciones reales cuando cambia. El DOM de fallback hidratado se conserva sin recalcular un segundo chart oculto tras el takeover. SSR sólo formatea las primeras 100 filas y conserva el total. No se añade geometría Angular.

La matriz completa detectó `UNSUPPORTED_SERIALIZED_SVG` por ausencia de `pattern` en el parser/template estático Angular. Se añadió a ambos, conservando la proyección segura y sin innerHTML/skipHydration. Regresión para los tres patrones comprueba namespace SVG, definiciones y referencias fill reales. Fallo original conservado en `artifacts/five-point-closure/browser-before-patterns` del showcase.

Cinco rutas nuevas: `areaspline/stacked`, `areaspline/stacked-percent`, `mixed/stacked-columns`, `mixed/stacked-percent`, `mixed/stacked-dual-axes`. Los 19 ajustes previos de recetas se conservan ahora en su generador de transporte, con regresión independiente. Documentación ES/EN y referencia API generada desde declarations públicas; no se documentan métodos vacíos.

## 3. Verificación

| Gate | Evidencia |
|---|---|
| Core | `npm run check`: 996 tests en 84 archivos, consumers y package audits PASS |
| Web | 42 tests de Node; 604 recetas TypeScript positivas y tres controles negativos |
| Angular | Cuatro tests de integración/unit, build real y paquete consumido por showcase |
| Showcase | 13 tests y build de producción |
| SDK empaquetado | 604 × tres motores = 1.812 comprobaciones reales; 100 ciclos de recursos por motor |
| Nuevos ejemplos | 30 comprobaciones focalizadas: cinco × dos integraciones × tres motores |
| Catálogo Angular/JS | 3624 = 604 × dos integraciones × tres motores; SSR, SVG, estabilidad y outputs |
| Capturas del catálogo | 711 capturas candidatas y 3 auditorías axe adicionales; aprobación humana pendiente |
| Documentación | 2420 snippets compilan contra entrypoints públicos; cero diagnósticos |
| Alineación Native | 148 comprobaciones; 24 capturas separadas |
| Shell | 201 verificaciones; 12 capturas |
| Lifecycle | Por motor: 100 cambios simples + 100 cambios de panel compuesto; reutilización DOM SSR, output exactly-once, touch y cleanup |
| Configuración/export | Cinco anchos 320/375/430/768/900; 12 escenarios axe; 30 capturas/PNG de variantes nuevas; tabla/foco/precisión/RTL/export |

Motores reales: Chromium, Firefox y WebKit. Los resultados automáticos de accesibilidad no equivalen a VoiceOver/NVDA manuales. No se atribuye aprobación visual a Pedro.

Se conservaron 1544 PNG históricos y 354 PNG Web byte a byte. Se conservaron también errores y capturas intermedias; no se actualizaron goldens para ocultar fallos. Recibo de hashes: `artifacts/five-point-closure/integrity.json`. Symlinks accidentales y marcadores de secretos en cambios: cero; `git diff --check` PASS.

## 4. Rendimiento y memoria

Apple M2 Pro, arm64, Node22.22.3; 30 muestras después de tres warmups, dataset determinista de 50.000 puntos. Tiempo de API síncrona más layout forzado; no incluye garantía de paint/FPS. Zoom y pan cambian de verdad el viewport; changedData aplica de verdad un valor diferente. No se alteró el dataset antiguo para esconder regresiones.

Milisegundos p50 / p95 de la medición original final (muestras y outliers conservados):

| Motor | Inicial | Cambio de datos | Zoom | Pan |
|---|---|---|---|---|
| chromium | 275.4 / 335.0 | 276.8 / 306.4 | 79.9 / 95.7 | 80.0 / 91.5 |
| firefox | 296.0 / 425.0 | 303.0 / 376.0 | 91.0 / 174.0 | 90.0 / 201.0 |
| webkit | 328.0 / 350.0 | 340.0 / 373.0 | 127.0 / 143.0 | 127.0 / 140.0 |

La base comparable anterior tenía p95 inicial 1648,4/2146/818 ms, cambio 1089,2/2085/817, zoom 505,7/875/412 y pan 339,7/977/424, respectivamente. Son mejoras medidas de estos escenarios, no un máximo garantizado para todos los tipos/dispositivos.

Una medición intermedia de Firefox presentó colas p95 más bajas que la siguiente. Se investigó mediante repetición serial del mismo escenario sobre runtime idéntico, conservando ambas series. Resultado y límites: `artifacts/five-point-closure/performance-repeat.json` (MEASURED). No se sustituye la muestra desfavorable por una favorable ni se atribuye la variación a GC sin prueba.

Repetición, también p50 / p95 en ms y con todos sus outliers conservados:

| Motor | Inicial | Cambio de datos | Zoom | Pan |
|---|---|---|---|---|
| chromium | 297.4 / 339.3 | 276.8 / 309.6 | 85.7 / 100.7 | 81.7 / 97.2 |
| firefox | 276.0 / 493.0 | 289.0 / 502.0 | 89.0 / 286.0 | 84.0 / 206.0 |
| webkit | 331.0 / 375.0 | 339.0 / 366.0 | 126.0 / 143.0 | 126.0 / 135.0 |

Firefox conserva picos reales: la repetición da zoom p95 286 ms y pan p95 206 ms. Es un riesgo de latencia a 50k, no un PASS de fluidez. Se investigó con el [profiler de Mozilla](https://raw.githubusercontent.com/firefox-devtools/profiler/main/docs-user/guide-startup-shutdown.md), configurado sólo para el proceso de prueba y sin subir el perfil. Perfil instrumentado/unminificado separado de las mediciones de producción: 198 markers de etapas, incluidos 60 zoom/pan medidos. En el zoom más lento, 255.6 ms, la unión de pausas GCMinor/GCSlice/CCSlice en el mismo hilo ocupa 166.4 ms; el resto 89.2 ms. No se suman lifetimes GCMajor incrementales porque incluirían trabajo normal. Evidencia local: `artifacts/five-point-closure/firefox-pauses/gecko.json`, `observations.json`, `analysis.json` y sus dos herramientas reproducibles. Esto atribuye gran parte de los picos observados a pausas de memoria en el escenario repetido de creación/cambio/destrucción de 50k; no demuestra que el coste de asignaciones esté eliminado. No se fuerza GC en producción ni se altera el benchmark para esconderlo. La investigación exigida ante variación >20% está realizada; la latencia extrema sigue declarada como limitación.

Actualizaciones de opciones y overlays tienen pruebas separadas a 1k/10k/50k; se mantiene coste de validación para datos mutables. Los perfiles CPU se conservan junto a las mediciones. SVG export mide serialización síncrona; materialización de SVG y rasterización real PNG se comprueban por separado.

Memoria: Chromium con GC forzado, 50 ciclos de calentamiento y tres rondas de 100 create/keyboard/zoom/tabla/SVG/update/destroy con 2.000 puntos por ciclo. Heap usado: 3359312 → 4989880 → 5072816 → 5084264 bytes. Crecimiento total 1724952 bytes; DOM/listeners no crecen y el incremento entre las dos últimas rondas es 11448 bytes. Umbral local de detección 3 MiB, no presupuesto de producto aprobado. No se declara heap cero, RSS estable ni heap de Firefox/WebKit medido. Cleanup de recursos en los tres motores se comprueba aparte.

Capacidad no significa fluidez universal: Line hasta 50.000 puntos; Column/Bar hasta 50.000 valores y 10.000 categorías; Scatter/Bubble 10.000; Mixed 10.000 valores/64 categorías; Pie/Donut 16 sectores. El total es entre series. Otros límites geométricos/de recursos siguen aplicando y las familias no comparten un único máximo.

## 5. Bundle y distribución

Mismo harness minificado, entradas reales y raw/gzip/Brotli. Bytes:

| Importación | Raw | Gzip | Brotli |
|---|---:|---:|---:|
| unused | 21 | 41 | 25 |
| factory | 557283 | 178070 | 144297 |
| line | 211129 | 68242 | 58507 |
| column | 211131 | 68242 | 58554 |
| bar | 211095 | 68214 | 58460 |
| cartesian | 211104 | 68229 | 58519 |
| line-column | 211179 | 68254 | 58545 |
| line-bar | 211291 | 68290 | 58561 |
| spline-area | 211104 | 68229 | 58519 |
| pie-donut-scatter | 557283 | 178070 | 144297 |
| full-api | 558581 | 178488 | 144732 |
| financial | 236560 | 76976 | 66053 |
| core-cartesian | 113855 | 35905 | 30589 |
| core-financial | 139883 | 44994 | 38493 |
| core-combined | 459604 | 146013 | 117051 |
| server-export | 511971 | 162664 | 131175 |

El marcador de fixture unused ocupa 21/41/25 B: el código de biblioteca se elimina. Core cartesiano baja de 119.403/37.084/31.600 B en el primer pase a 113.855/35.905/30.589 B al separar Scatter/text preparation y retención accidental. Verificación por metafile excluye motores ajenos.

El total Web incorpora funcionalidad nueva y no se afirma que haya bajado: Line pasó aproximadamente de 63.473 a 68.242 B gzip. Factory genérica conserva el catálogo completo; consumers que necesitan menos deben usar entrypoints granulares. Evitar un registry obligatorio y mejorar límites no elimina el coste de las capacidades nuevas.

Consumidor Angular mínimo real, compilado con Angular CLI/AOT de producción y comprobado en Chromium. La tabla siguiente suma los chunks JavaScript emitidos y su compresión por archivo; incluye el runtime Angular y no es comparable directamente con el bundle de biblioteca anterior. Sin Zone.js, fuentes enlazadas ni parches de node_modules:

| Aplicación Angular | Raw | Gzip | Brotli |
|---|---:|---:|---:|
| baseline | 93234 | 31161 | 28079 |
| unused | 93234 | 31161 | 28079 |
| line | 701390 | 224990 | 185551 |

Baseline y chart importado sin usar no retienen módulos de Charts según el metafile. El componente genérico NeuralChart usado con un dataset Line sí retiene la factory completa: no se afirma tree-shaking Angular por familia. Esto queda visible como limitación de distribución; no se oculta comparándolo con un import cartesiano JavaScript. Harness reproducible: showcase `tooling/measure-angular-consumer.mjs` y su recibo `artifacts/five-point-closure/angular-consumer/results.json`.

Gates históricos sin excepción aprobada: NC-01B 33.792 frente a 30.720 B gzip, exceso 3.072; NC-01C incremento 9.556 frente al objetivo exploratorio 6.144, exceso 3.412. No son escenarios intercambiables con la nueva factory; no se rebajan objetivos ni se declara aprobación implícita. Optimización implementada y medida; presupuestos globales siguen PENDING.

Core candidato local: SHA-256 `76cab2919f4c48b2134380ddadefb1512ba09380da561daac65274e285430ebc`, owner HEAD `702d79ed33afccc2d1afae32d9e3831747aeda48`. Versión 0.0.24 local no publicada. El Web probado con SHA-256 `5a042d6515eebf9095bd84f407481a8bc2850020b91069764be88273bb0cdff8` se reempaquetó sólo para README/API docs como `b75f6f92a79351b296cf0998384061c16ed4899937c5a3e6a6c5aba353208da1`. Todos los ejecutables, declarations, maps y manifiesto son idénticos: runtime SHA-256 `6d72fa54329fbf8d5abced3d5d985a5fd7b9885996ef26eb7a6adf1d14034ca2`. Prueba: `documentation-package-transition.json`. El ajuste final de un newline y este informe no cambian el runtime. Angular sí se volvió a empaquetar/probar después del fix de patrones.

Los archives activos están fijados por hashes en cada package/lock. Los 32 tarballs experimentales propios no referenciados se conservaron reversiblemente fuera de Git con manifiesto y hashes en `artifacts/five-point-closure/checkpoint-archives`. No se borraron archivos desconocidos ni se parcheó node_modules. Los paquetes no contienen symlinks ni node_modules anidados. Web y Angular conservan private/UNLICENSED. El paquete Core compartido ya declara MIT en su repositorio de origen; se conserva sin alterar esa licencia ni atribuir una nueva decisión comercial al usuario.

## 6. Entrega, comandos y pendientes

Showcase local: http://127.0.0.1:53620/charts?framework=angular&lang=es ; JavaScript usa el selector visible o `framework=vanilla` como valor interno de URL. No se ha publicado. Las capturas nuevas están en el showcase `artifacts/five-point-closure/` y en Web `artifacts/configuration-review/`; no se creó ZIP.

Comandos de reproducción (Node22, cache temporal local):

```sh
# Core, desde el worktree aislado
npm run check
# Web
npm run verify
node tooling/verify-update-performance.mjs
node tooling/profile-large-updates.mjs
node tooling/verify-configuration.mjs
node tooling/verify-retained-memory.mjs
node tooling/profile-firefox-pauses.mjs
node tooling/analyze-firefox-pauses.mjs
# Angular
npm test
npm run build
# Showcase, con servidor local de producción disponible
npm test
npm run build
node tooling/verify-browser.mjs
node tooling/verify-lifecycle.mjs
node tooling/verify-documentation.mjs
node tooling/verify-native-alignment.mjs
node tooling/verify-showcase-shell.mjs
node tooling/measure-angular-consumer.mjs
```

No ejecutar benchmarks concurrentemente con builds/campañas browser. Los recibos señalan inputs/builds/hash/scope exactos; las rutas históricas y las candidatas son independientes.

Pendientes humanos: aprobación visual y VoiceOver/Safari, NVDA/Firefox manuales. Pendientes de presupuesto: excesos B/C y evaluación del nuevo coste de distribución. No se declara FREEZE formal ni release approval. No se cambia licencia/visibilidad, no push/tag/release/npm publish/deploy, no cambios en Native/Neural UI/iCloud. Los únicos commits nuevos son locales y se registran en `artifacts/five-point-closure/git-state.json` después de cerrar los commits de implementación.
