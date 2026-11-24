# Integración Core 0.1.1

Se consume el archivo oficial npm0.1.1 fijado en docs/core-candidate.json. SHA256 3a9ae02cd29a2538acfb979b13766c9f6fc6492ab3774224ed22bdba3f59bd1d. Core check completo y417 archivos idénticos al snapshot validado. Cero dependencias runtime, Core independiente del renderer.

Los discriminadores públicos usan type, incluido el contexto de tick expuesto por Web. No se introduce compatibilidad kind en runtime. Los archivos de referencia Native/financial JSON siguen intactos; el generador migra las claves para producir604 recetas válidas con el contrato actual.

85 pruebas Web PASS; dos nuevas combinan Core drilldown y planificación Web con cero, identidades originales, categorías repetidas, vuelta/restauración y generaciones inválidas.604 variantes en3 navegadores,100 ciclos de recursos por engine y pruebas avanzadas PASS.354 PNG idénticos al HEAD previo exacto4ef1663.

El entrypoint opcional @neural-charts/core/drilldown proporciona navegación pura; el host posee la acción explícita y los controles. La integración no añade un segundo motor ni retiene drilldown en los imports ordinarios.

Informe y recibos de las tres capas: ../neural-charts-showcase/docs/CORE-0.1.1-AND-V2-STRUCTURE-2026-11-05.md y su JSON. Conserva las limitaciones de presupuestos, aprobación visual y lectores de pantalla manuales. Sin push/publicación/despliegue.
