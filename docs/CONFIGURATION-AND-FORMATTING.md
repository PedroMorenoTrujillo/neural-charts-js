# Explicit configuration and value formatting

All examples below use public `ChartOptions` from `@neural-charts/web` (also exported by the Angular adapter). Presentation never changes original data, converts currencies or converts physical units. Full tooltip/title/label/legend templates remain a publication requirement; this document does not claim that feature is implemented.

## Ownership and precedence

| Decision | Rule |
| --- | --- |
| Update | `update(data, options)` and `updateOptions(options)` apply a complete next options object. They do not deep-merge the previous options. Keep application state and spread groups explicitly. |
| Default formatting | Without `formatting.number`, plain display uses up to12 significant digits, without modifying raw values. An explicit empty number object selects Intl defaults. |
| Locale | `formatting.locale` selects number/date formatting. Fallback is UI `locale`, then English; an unsupported requested locale never implicitly selects the server's machine language. |
| Value axis | Explicit `axes.y.numberFormat` replaces the global number format. It is a complete formatter, not a patch of global currency/unit fields. Secondary value axes use `axes.secondaryY.numberFormat`, otherwise global formatting. |
| Data labels and tooltip | Ordinary observations use their value-axis formatter. On percentage stacks, primary observations retain global original-value formatting; normalized tick formatting is separate. Numeric independent X is not automatically given the Y currency/unit. |
| Responsive | Inclusive `minWidth`/`maxWidth`, evaluated against the owning container, in declaration order. Later matching fields win; nested groups merge and arrays replace. Base options are restored when widening. |
| Responsive number patch | Within the same effective style, fields inherit from that axis. Explicitly switching style replaces its formatter; omitted base style means decimal. Patches are shape-checked, then the effective full options are validated before applying. An invalid update retains the last valid chart. |
| Series color | Explicit `appearance.series[{id}].color` wins over palette position; palette wins over Core's suggested color. Series IDs preserve intent through hide/update. |
| Reference | `references` defines domain position. `referenceLabels` and `referenceStyles` match its ID and affect presentation only. An out-of-domain reference is not painted. |

## Currency

```ts
import type {ChartOptions} from '@neural-charts/web';
const options: ChartOptions = {
  locale: 'es', // UI language
  formatting: {
    locale: 'en-US', // display conventions, independent of UI
    number: {
      style: 'currency', currency: 'USD',
      currencyDisplay: 'code', currencySign: 'accounting',
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    },
  },
};
```

`currency` is required with currency style, using uppercase three-letter currency-code syntax. Use ISO4217 codes for standard currencies; validation checks syntax and does not fetch a live currency registry. No currency is silently chosen. `currencyDisplay` defaults to `symbol` and also accepts `narrowSymbol`, `code`, `name`; `currencySign` defaults to `standard` and also accepts `accounting`. Parentheses in accounting depend on locale. Fraction defaults depend on currency, e.g. currencies do not all have two minor-unit digits; set both fraction bounds for a fixed display. These rules follow [Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat).

## Measurements and percentages

```ts
const options: ChartOptions = {
  formatting: {
    locale: 'es-ES',
    number: {style:'unit', unit:'kilometer-per-hour', unitDisplay:'short', maximumFractionDigits:1},
  },
};
```

Unit style requires an Intl-supported unit such as `celsius`, `liter`, `meter` or `kilometer-per-hour`. `unitDisplay` defaults to `short`, with `narrow` and `long` alternatives. Unsupported units and conflicting currency fields are rejected. `options.unit` is descriptive frame metadata; use `axes.y.title` for a visible axis caption and the number formatter for visible value units. `style:'percent'` formats a fraction:0.125 displays12.5%; do not pre-multiply the same value again. Dates retain explicit UTC by default.

For business units, `prefix` and `suffix` are literal text, empty by default, with a128-character limit each. Whitespace is explicit. They wrap the formatted number in this order:prefix + Intl result + suffix. They are escaped text, never HTML or a template, and never enter original CSV values.

```ts
const options: ChartOptions = {
  formatting:{locale:'es-ES',number:{maximumFractionDigits:0,prefix:'≈ ',suffix:' visitas'}},
};
```

Percentage stacks represent a primary axis domain0–100, not a fraction domain0–1. That axis does not inherit global money/measurement formatting. To customize those ticks use e.g. `axes.y.numberFormat:{maximumFractionDigits:0,suffix:' %'}`; the tooltip/data labels keep global formatting for original values. A secondary raw-value axis retains its independent formatter. References always use the represented domain:0–100 on a percentage stack, not an original monetary mean.

Financial OHLC prices use their price formatter. Volume in the detail is a separate quantity: it keeps plain numeric formatting, including zero and an absent-value marker, rather than inheriting the price currency or unit.

## Chart language

`options.locale` selects built-in chart controls/help/table/status messages in `en` or `es`. Update the options at runtime to switch. Titles, series/category names, custom reference labels and literal affixes belong to the application's translation system; preserve IDs when translating data. `formatting.locale` independently chooses regional number/date formatting. Neither setting performs automatic translation of business data or currency/unit conversion.

## Fixed target or calculated mean

```ts
const options: ChartOptions = {
  references: [{id:'target', axis:'y', value:50}],
  referenceStyles: [{id:'target', color:'#875310', dash:'dashed', width:1.5}],
  referenceLabels: [{id:'target', text:'Target: 50'}],
};
```

Reference defaults remain theme muted color,1 SVG unit width and dashed5/4 pattern. `dash` accepts `solid`, `dashed`, `dotted`; explicit width is0.5–8 SVG units. Colors are validated HEX values, with unique stable style IDs. Custom colors need their own contrast review. Color/dash/width changes do not change geometry. Reference values use domain coordinates, not pixels; this mirrors the domain-position concept in [the comparison baseline plot lines](https://api.the comparison baseline.com/the comparison baseline/yAxis.plotLines), without adopting its option hierarchy.

Long reference labels use up to two visible lines clipped to the plot, retaining the full accessible label and SVG title. Vertical references choose the side with more available space near an edge. A background-colored text outline retains legibility when references cross series ink. Formatted value axes reserve space for their title separately from tick labels.

A mean is a business calculation supplied as `reference.value`, not an implicit average of bar pixels or already-stacked totals. The live showcase lab lets users choose all series or visible series, weights every finite original value equally, includes zero, omits gaps, updates on data/visibility changes and does not change with zoom. With no valid values, the mean/reference is absent rather than invented as zero. See the executable guide at `/guide/axes#section-3`; it supports JavaScript and Angular, separate regional format, currency/measurement, palette color, fixed target and mean. Its code panel shows the complete input data/options snapshot, including responsive rules; the renderer resolves matching rules against the current container.

## Responsive scope

The renderer observes its container. Rules can change `height`, `legend`, `axes`, `appearance`, `tooltip`; they cannot rewrite domain data, selection or viewport ownership. Mobile detail can dock below the plot, and labels retain full accessible text even when density limits their visible representation. SSR uses explicit width or640px; the browser resolves the actual container. Documentation's interactive lab loads only on request, keeping ordinary guides lightweight.

Human visual and VoiceOver/NVDA review, bundle acceptance and full custom templates remain separate publication gates. Browser automation is evidence of tested cases, with results limited to those cases.
