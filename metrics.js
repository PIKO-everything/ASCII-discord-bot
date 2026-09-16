const { createCanvas } = require('canvas');

function measureMonospaceFont(fontSizePx, fontFamily) {
  const fontSpec = `${fontSizePx}px ${fontFamily}`;
  const probe = createCanvas(fontSizePx * 4, fontSizePx * 4);
  const ctx = probe.getContext("2d");
  ctx.font = fontSpec;

  const metrics = ctx.measureText('M');
  const charWidth = metrics.width || fontSizePx * 0.6;
  const ascent = metrics.actualBoundingBoxAscent || fontSizePx * 0.8;
  const descent = metrics.actualBoundingBoxDescent || fontSizePx * 0.2;
  const charHeight = (ascent + descent) || fontSizePx;

  return {
    fontSpec,
    charWidth,
    charHeight,
    aspect: charWidth / charHeight
  };
}

module.exports = { measureMonospaceFont };
