type Rgb = readonly [number, number, number];

export function hexChannels(color: string): Rgb {
  const hex = color.length === 4 ? Array.from(color.slice(1), digit => digit.repeat(2)).join('') : color.slice(1);
  const channel = (index: number) => parseInt(hex.slice(index, index + 2), 16);
  return [channel(0), channel(2), channel(4)];
}

function channels(color: string): Rgb {
  const [red, green, blue] = hexChannels(color);
  return [red / 255, green / 255, blue / 255];
}

function composite(color: string, surface: Rgb, opacity = 1): Rgb {
  const rgb = channels(color);
  const alpha = (color.length === 9 ? parseInt(color.slice(7, 9), 16) / 255 : 1) * opacity;
  if (alpha === 1) return rgb;
  const blend = (index: 0 | 1 | 2) => rgb[index] * alpha + surface[index] * (1 - alpha);
  return [blend(0), blend(1), blend(2)];
}

function backgroundChannels(background: string, dark: boolean): Rgb {
  return composite(background, dark ? [0, 0, 0] : [1, 1, 1]);
}

/** Select black or white against the final composite cell color. */
export function cellTextOnSurface(color: string, opacity: number, background: string, dark: boolean): string {
  return luminance(composite(color, backgroundChannels(background, dark), opacity)) > 0.179 ? '#000000' : '#ffffff';
}

function luminance(rgb: Rgb): number {
  const linear = (channel: number) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return linear(rgb[0]) * 0.2126 + linear(rgb[1]) * 0.7152 + linear(rgb[2]) * 0.0722;
}

/** Keep readable series ink, or blend it towards the stronger neutral at 4.5:1. */
export function textColorOnSurface(color: string, background: string, dark: boolean): string {
  const surface = backgroundChannels(background, dark);
  const brightness = luminance(surface) + 0.05;
  const readable = (ink: string) => {
    const foreground = luminance(composite(ink, surface)) + 0.05;
    return Math.max(foreground, brightness) / Math.min(foreground, brightness) >= 4.5;
  };
  if (readable(color)) return color;

  const target = brightness > 0.229 ? 0 : 1;
  const rgb = channels(color);
  for (let step = 1; step < 10; step++) {
    const adjusted = '#' + rgb.map(channel =>
      Math.round((channel + (target - channel) * step / 10) * 255).toString(16).padStart(2, '0'),
    ).join('');
    if (readable(adjusted)) return adjusted;
  }
  return target === 0 ? '#000000' : '#ffffff';
}

export const hexPaint = /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i;
