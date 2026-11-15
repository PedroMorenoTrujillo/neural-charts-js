type Plot = Readonly<{left: number; right: number; top: number; bottom: number}>;

/** Keep the whole tooltip in the visible plot, leaving room around its datum. */
export function detailPosition(x: number, y: number, width: number, height: number, plot: Plot, preferBelow = false) {
  const {left, right, top, bottom} = plot;
  x = Math.max(left, Math.min(right, x));
  y = Math.max(top, Math.min(bottom, y));
  const gap = 8;
  const centeredLeft = Math.max(left, Math.min(right - width, x - width / 2));
  const above = y - gap - top, below = bottom - y - gap;
  if (above >= height || below >= height) {
    const useBelow = below >= height && (preferBelow || above < height);
    return {left: centeredLeft, top: useBelow ? y + gap : y - gap - height, height};
  }
  const centeredTop = Math.max(top, Math.min(bottom - height, y - height / 2));
  if (x + gap + width <= right) return {left: x + gap, top: centeredTop, height};
  if (x - gap - width >= left) return {left: x - gap - width, top: centeredTop, height};
  if (Math.max(above, below) >= 40) {
    const useAbove = above >= below;
    return {left: centeredLeft, top: useAbove ? top : y + gap, height: useAbove ? above : below};
  }
  return {left: centeredLeft, top: centeredTop, height};
}
