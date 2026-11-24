import type { PlanSpec, PlanOptions, PlanFrame, PlanObservation, PlanViewportValue } from '@neural-charts/core';

export type ChartType = PlanSpec['family'];
type Source = PlanSpec;
export type RootLayoutKey = 'parameters' | 'orientation' | 'groupGap' | 'barGap' | 'maxBarWidth' | 'holeRatio' | 'bandwidth' | 'resolution' | 'normalization' | 'gapRatio' | 'rowPadding' | 'coordinates' | 'stacking' | 'innerRadiusRatio' | 'opacity' | 'padding' | 'minFontSize' | 'maxFontSize' | 'rotations' | 'seed' | 'maxWords' | 'startAngle' | 'nodePadding' | 'nodeWidth' | 'reversed' | 'nodeRadius' | 'linkWidth' | 'pointPadding' | 'grouping' | 'labelPosition' | 'labelMaxWidth' | 'markerRadius' | 'splitSeries' | 'minRadiusRatio' | 'radiusScale' | 'columns' | 'whiskerWidth' | 'capWidth' | 'binCount' | 'intervals' | 'standardDeviations' | 'neckWidth' | 'neckHeight' | 'preset' | 'tileShape';
type Value<S, K extends PropertyKey> = S extends unknown ? K extends keyof S ? S[K] : never : never;
type RootLayout = { readonly [K in RootLayoutKey]?: Value<PlanSpec, K> };
type Pictorial = NonNullable<Extract<PlanSpec, { family: 'pictorial' }>['pictorial']>;
type Contour = Extract<PlanSpec, { family: 'contour' }>['contour'];
export type ChartLayoutOptions = RootLayout & Partial<Omit<NonNullable<PlanOptions['circular']>, 'gaugeStyle'>> & Readonly<{
  style?: 'solid' | 'needle';
  stackGroups?: PlanOptions['stackGroups'];
  bands?: Extract<PlanSpec, { family: 'bullet' }>['bands'];
  shape?: Pictorial['shape']; gap?: number; background?: boolean;
  levels?: Contour['levels']; segmentBudget?: number;
}>;
type Point<P> = P extends readonly (infer V)[] ? readonly Point<V>[] : P extends object ? { readonly [K in keyof P as K extends 'color' | 'datum' | 'markers' | 'dash' ? never : K]: Point<P[K]> } & { readonly color?: never; readonly datum?: never } : P;
type Series<S> = S extends { readonly data: readonly (infer P)[] } ? Omit<S, 'color' | 'markers' | 'dash' | 'data'> & { readonly data: readonly Point<P>[]; readonly color?: never; readonly markers?: never; readonly dash?: never } : S;
type Axis<A> = A extends object ? Omit<A, 'title' | 'grid' | 'labels'> & { readonly title?: never; readonly grid?: never; readonly labels?: never } : A;
type Data<S> = S extends Source ? { readonly [K in keyof S as K extends RootLayoutKey | 'title' | 'description' | 'color' | 'unit' | 'pictorial' | 'colorAxis' | 'contour' | 'centerName' | 'centerColor' | (S['family'] extends 'bullet' ? 'bands' : never) ? never : K extends 'family' ? 'type' : K]:
  K extends 'axes' ? { readonly [A in keyof S[K]]: Axis<S[K][A]> } : K extends 'series' ? S[K] extends readonly (infer R)[] ? readonly Series<R>[] : S[K] : Point<S[K]>
} & { readonly family?: never; readonly title?: never; readonly description?: never } : never;
/** Numeric data and stable identities. Presentation belongs to options. */
export type ChartData = Data<Source>;
export type ChartPointId = Readonly<{ seriesId: string; pointId: string }>;
export interface ChartNumberFormat {
  readonly style?: 'decimal' | 'percent' | 'currency' | 'unit'; readonly currency?: string;
  readonly currencyDisplay?: 'symbol' | 'narrowSymbol' | 'code' | 'name';
  readonly currencySign?: 'standard' | 'accounting';
  readonly unit?: string; readonly unitDisplay?: 'short' | 'narrow' | 'long';
  readonly prefix?:string; readonly suffix?:string;
  readonly notation?: 'standard' | 'scientific' | 'engineering' | 'compact';
  readonly minimumFractionDigits?: number; readonly maximumFractionDigits?: number;
  readonly useGrouping?: boolean; readonly signDisplay?: 'auto' | 'never' | 'always' | 'exceptZero';
}
export interface ChartSeriesStyle {
  readonly id: string; readonly color?: string;
  readonly dash?: 'solid' | 'dashed' | 'dotted';
  readonly marker?: 'circle' | 'square' | 'diamond' | 'triangle';
  readonly markerRadius?: number; readonly fillOpacity?: number;
  readonly markerFill?: string;
  readonly markerStroke?: string;
  readonly markerStrokeWidth?: number;
  readonly pattern?: 'none' | 'diagonal' | 'dots' | 'crosshatch';
}
export interface ChartPointStyle extends ChartPointId {
  readonly color: string;
}
export interface ChartReferenceBandStyle {
  readonly id: string;
  readonly label?: string;
  readonly color?: string;
  readonly opacity?: number;
}
export type ChartLabelLayout = 'auto' | 'all' | 'truncate';
export interface ChartTextStyle {
  readonly align?: 'left' | 'center' | 'right';
  readonly color?: string;
  readonly fontSize?: number;
  readonly fontWeight?: 400 | 500 | 600 | 700;
}
export interface ChartWaterfallStyle {
  readonly positiveColor?: string;
  readonly negativeColor?: string;
  readonly totalColor?: string;
  readonly connectorColor?: string;
}
export interface ChartAxisOptions {
  readonly visible?: boolean; readonly title?: string;
  readonly titleStyle?: ChartTextStyle;
  readonly numberFormat?: ChartNumberFormat;
  readonly labels?: Readonly<{maxLines?: 1 | 2 | 3; maxCharacters?: number; rotation?: number; layout?: ChartLabelLayout; style?: Omit<ChartTextStyle, 'align'>}>;
}
export interface ChartReferenceStyle {
  readonly id:string; readonly color?:string;
  readonly dash?:'solid'|'dashed'|'dotted'; readonly width?:number;
}
export interface ChartDateFormat {
  readonly timeZone?: string;
  readonly year?: 'numeric' | '2-digit'; readonly month?: 'numeric' | '2-digit' | 'short' | 'long' | 'narrow';
  readonly day?: 'numeric' | '2-digit'; readonly hour?: 'numeric' | '2-digit';
  readonly minute?: 'numeric' | '2-digit'; readonly second?: 'numeric' | '2-digit';
  readonly weekday?: 'short' | 'long' | 'narrow'; readonly hourCycle?: 'h11' | 'h12' | 'h23' | 'h24';
}
/** Presentation rules resolve against the owning container, in declaration order. */
export interface ChartResponsiveRule {
  readonly minWidth?: number; readonly maxWidth?: number;
  readonly options: Pick<ChartOptions, 'height' | 'legend' | 'axes' | 'appearance' | 'tooltip'>;
}
export interface ChartAccessibilityOptions {
  readonly description?: string;
  readonly keyboard?: boolean;
  readonly announceDataChanges?: boolean;
  readonly seriesDescriptions?: readonly Readonly<{id: string; description: string}>[];
  readonly pointDescriptions?: readonly Readonly<{id: ChartPointId; description: string}>[];
}
export enum ChartDownloadFormat {
  Csv = 'csv',
  Png = 'png',
  Svg = 'svg',
}

export enum ChartDownloadMenuPosition {
  Top = 'top',
  Bottom = 'bottom',
}

export enum ChartToolbarAction {
  Csv = 'download-csv',
  Png = 'download-png',
  Svg = 'download-svg',
  Zoom = 'zoom',
  /** @deprecated Use Zoom to place all three zoom controls together. */
  ZoomIn = 'zoom-in',
  /** @deprecated Use Zoom to place all three zoom controls together. */
  ZoomOut = 'zoom-out',
  /** @deprecated Use Zoom to place all three zoom controls together. */
  ResetZoom = 'reset',
}

export {ChartDownloadMenuPosition as ChartToolbarPosition};

export enum ChartZoomPosition {
  Toolbar = 'toolbar',
  Below = 'below',
}

/** Settings for the optional zoom increment slider. */
export interface ChartZoomOptions {
  /** Show the slider before the three zoom buttons. Defaults to false. */
  readonly showSlider?: boolean;
  /** Keep the controls in the main toolbar or place them on a separate row below the chart. Defaults to Toolbar. */
  readonly position?: ChartZoomPosition;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly increment?: number;
  readonly label?: string;
}

export interface ChartOptions<T extends ChartType = ChartType> {
  readonly title?: string; readonly description?: string;
  readonly animation?: Readonly<{ enabled?: boolean; duration?: number; revision?: number }>;
  readonly capacity?: PlanOptions['capacity'];
  readonly scales?: PlanOptions['scales'];
  readonly hierarchy?: PlanOptions['hierarchy'];
  readonly referenceBands?: PlanOptions['referenceBands'];
  readonly referenceBandStyles?: readonly ChartReferenceBandStyle[];
  readonly referenceLabels?: readonly Readonly<{ id: string; text: string }>[];
  readonly referenceStyles?: readonly ChartReferenceStyle[];
  readonly annotations?: readonly Readonly<{ id: string; point: ChartPointId; text: string; dx?: number; dy?: number }>[];
  readonly unit?: string;
  readonly theme?: 'light' | 'dark'; readonly direction?: 'ltr' | 'rtl';
  readonly themeTokens?: import('./theme.js').ChartTheme;
  readonly locale?: 'en' | 'es';
  readonly width?: number; readonly height?: number;
  readonly responsive?: readonly ChartResponsiveRule[];
  readonly accessibility?: ChartAccessibilityOptions;
  readonly formatting?: Readonly<{locale?: string; number?: ChartNumberFormat; date?: ChartDateFormat}>;
  readonly layout?: ChartLayoutOptions;
  readonly appearance?: Readonly<{ colors?: readonly string[]; series?: readonly ChartSeriesStyle[]; points?: readonly ChartPointStyle[]; bandColors?: readonly string[]; risingColor?: string; fallingColor?: string; lineWidth?: number; markers?: boolean; markerRadius?: number; dataLabels?: boolean; stackLabels?: boolean; centerName?: string; labelLimit?: number; dataLabelLayout?: ChartLabelLayout;
    titleStyle?: ChartTextStyle; descriptionStyle?: ChartTextStyle;
    /** Minimum width of the data area. Narrower hosts scroll the SVG. */
    minPlotWidth?: number;
    waterfall?: 'waterfall' extends T ? ChartWaterfallStyle : never;
  }>;
  readonly colorAxis?: T extends 'heatmap' | 'tilemap' ? Extract<PlanSpec, { family: 'tilemap' }>['colorAxis'] : never;
  readonly axes?: Readonly<{ grid?: boolean; x?: ChartAxisOptions; y?: ChartAxisOptions; secondaryY?: ChartAxisOptions }>;
  readonly legend?: Readonly<{ visible?: boolean; position?: 'top' | 'bottom' | 'left' | 'right'; interactive?: boolean; reverse?: boolean; maxLabelCharacters?: number; itemSpacing?: number; maxHeight?: number }>;
  readonly tooltip?: Readonly<{ enabled?: boolean; content?: 'point' | 'shared'; placement?: 'auto' | 'docked' | 'below'; crosshair?: boolean; pinnable?: boolean; background?: string; foreground?: string; maxWidth?: number; maxHeight?: number }>;
  /** Built-in download buttons in display order. Omit or pass [] to hide them. */
  readonly downloadMenu?: readonly `${ChartDownloadFormat}`[];
  /** Places the download toolbar above or below the chart and its legend. Defaults to Bottom. */
  readonly downloadMenuPosition?: `${ChartDownloadMenuPosition}`;
  /** When supplied, replaces the download menu and the default zoom buttons. */
  readonly toolbar?: Readonly<{actions: readonly ChartToolbarAction[]; position?: ChartDownloadMenuPosition}>;
  readonly viewport?: Readonly<{ axes: 'x' | 'y' | 'xy'; value?: PlanViewportValue; controls?: boolean; zoom?: Readonly<ChartZoomOptions>; pan?: boolean; pinch?: boolean; wheel?: false | 'ctrl' | 'always' }>;
  readonly hiddenSeriesIds?: readonly string[];
  readonly selectedPoints?: readonly ChartPointId[];
  readonly references?: PlanOptions['references'];
}
/** Real renderer measurements; Core remains responsible for word sizing and packing. */
export interface ChartPlanningPorts { readonly measureWords?: (requests: readonly import('@neural-charts/core').PlanWordCloudMeasurementRequest[]) => readonly import('@neural-charts/core').PlanWordCloudMeasurement[]; readonly fontKey?: string; }
export type ChartDiagnostic = Readonly<{ code: string; reason: string; path: string; message: string }>;
export type ChartResult<T> = Readonly<{ status: 'ok'; value: T }> | Readonly<{ status: 'invalid'; diagnostic: ChartDiagnostic }>;
export interface ChartMountOptions {
  readonly instanceId: string;
  readonly content?: import('./content.js').ChartContentPorts;
  readonly onPointActivate?: (event: Readonly<{ id: ChartPointId; observation: PlanObservation; source: 'pointer' | 'keyboard'; revision: number }>) => void;
  readonly onHiddenSeriesChange?: (ids: readonly string[]) => void;
  readonly onSelectionChange?: (ids: readonly ChartPointId[]) => void;
  readonly onViewportChange?: (value: PlanViewportValue) => void;
  readonly onDiagnostic?: (diagnostic: ChartDiagnostic) => void;
  readonly synchronization?: import('./synchronization.js').ChartSynchronization;
}
export interface ChartController {
  update(data: ChartData, options?: ChartOptions, content?:import('./content.js').ChartContentPorts): ChartResult<number>;
  /** Apply presentation/interaction options to the last owned data without replacing it. */
  updateOptions(options: ChartOptions, content?:import('./content.js').ChartContentPorts): ChartResult<number>;
  /** Apply presentation capabilities without changing data, viewport or selection ownership. */
  updateContent(content?:import('./content.js').ChartContentPorts):ChartResult<number>;
  getFrame(): PlanFrame;
  getSelection(): readonly ChartPointId[];
  getHiddenSeriesIds(): readonly string[];
  setViewport(value: PlanViewportValue): ChartResult<PlanViewportValue>;
  zoomBy(factor: number): ChartResult<PlanViewportValue>;
  resetViewport(): ChartResult<PlanViewportValue>;
  exportSvg(options?: import('./export-layout.js').SvgExportOptions): string;
  exportCsv(options?: import('./export.js').CsvExportOptions): ChartResult<string>;
  exportPng(options?: import('./export.js').PngExportOptions): Promise<Blob>;
  destroy(): void;
}
export type { PlanFrame, PlanObservation };
