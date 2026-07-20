

export const CHAR_W10 = [
  2.930,3.228,4.893,6.416,6.416,9.370,7.231,3.086,3.936,3.936,4.834,6.416,3.086,4.834,3.086,3.164,
  6.416,4.756,6.152,6.387,6.553,6.299,6.484,5.811,6.504,6.484,3.086,3.086,6.416,6.416,6.416,5.244,
  9.297,6.855,6.689,7.275,7.383,6.074,5.840,7.583,7.539,2.793,5.498,6.704,5.796,8.857,7.539,7.832,
  6.470,7.832,6.650,6.489,6.455,7.490,6.855,9.795,6.904,6.670,6.733,3.936,3.164,3.936,6.416,5.952,
  5.117,5.635,6.260,5.713,6.260,5.830,3.735,6.211,6.001,2.588,2.583,5.547,2.646,8.818,5.952,6.025,
  6.221,6.211,3.926,5.352,3.750,5.952,5.537,7.861,5.361,5.547,5.508,3.936,2.705,3.936,6.416,
];

export function advance10(text) {
  let w10 = 0;
  for (const ch of (text ?? '')) {
    const cp = ch.codePointAt(0);
    if (cp === 0x1F511) w10 += 13.0;
    else if (cp >= 32 && cp <= 126) w10 += CHAR_W10[cp - 32];
    else w10 += 6.0;
  }
  return w10;
}

export function fontSizeOf(font) {
  const m = /\b(\d+(?:\.\d+)?)px\b/.exec(String(font || ''));
  return m ? parseFloat(m[1]) : 12;
}

export function measureTextWidth(text, font) {
  return advance10(text) * fontSizeOf(font) / 10;
}

export function measureTextMetrics(text, font) {
  const fs = fontSizeOf(font);
  return {
    width: advance10(text) * fs / 10,
    actualBoundingBoxAscent: fs * 0.7,
    actualBoundingBoxDescent: fs * 0.2,
  };
}
