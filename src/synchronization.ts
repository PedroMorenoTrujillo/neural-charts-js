import type { ChartPointId } from './types.js';
export interface ChartActivePoint { readonly id: ChartPointId; readonly key: string; }
export interface ChartSyncChannel { emit(value: ChartActivePoint | undefined): void; leave(): void; }
export interface ChartSynchronization { join(receive: (value: ChartActivePoint | undefined) => void): ChartSyncChannel; }
export interface ChartSyncGroup extends ChartSynchronization { readonly size: number; destroy(): void; }
/** An explicitly owned group. Never registers charts globally or retains departed owners. */
export function createChartSyncGroup(): ChartSyncGroup {
  const members = new Map<object, (value: ChartActivePoint | undefined) => void>(); let closed = false;
  return {
    get size() { return members.size; },
    join(receive) {
      const token = {}; if (!closed) members.set(token, receive);
      return { emit(value) { if (!closed && members.has(token)) for (const [key, listener] of [...members]) if (key !== token && members.has(key)) listener(value); }, leave() { members.delete(token); } };
    },
    destroy() { closed = true; members.clear(); },
  };
}
