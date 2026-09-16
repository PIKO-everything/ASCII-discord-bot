const { loadImage, createCanvas } = require('canvas');
const CONFIG = require("./config");
const { measureMonospaceFont } = require("./metrics");

const {
  aspect: CHAR_ASPECT,
  fontSpec: MONO_FONT_SPEC,
  charWidth: MONO_CHAR_WIDTH_PX,
  charHeight: MONO_CHAR_HEIGHT_PX
} = measureMonospaceFont(CONFIG.fontSizePx, CONFIG.fontFamily);

function buildCharset() {
  const arr = [];
  for (let i = 33; i <= 126; i++) arr.push(String.fromCharCode(i));
  for (let i = 0x2500; i <= 0x257F; i++) arr.push(String.fromCharCode(i));
  for (let i = 0x2580; i <= 0x259F; i++) arr.push(String.fromCharCode(i));
  for (let i = 0x2000; i <= 0x206F; i++) arr.push(String.fromCharCode(i));
  return Array.from(new Set(arr)).filter(c => c && c.trim().length > 0);
}

const CHARSET = buildCharset();

function getCharForLevel(levelIndex) {
  const clamped = Math.min(CHARSET.length - 1, Math.max(0, levelIndex));
  return CHARSET[clamped];
}

function rgbToAnsiCode(r, g, b) {
  return `\x1b[38;2;${r};${g};${b}m`;
}

function computeAsciiHeight(width, imageAspect) {
  return Math.max(2, Math.round(width * imageAspect * CHAR_ASPECT));
}

function quantizeBrightness(brightness, levels) {
  const maxLevel = levels - 1;
  const levelIndices = new Int32Array(brightness.length);
  for (let i = 0; i < brightness.length; i++) {
    const clamped = Math.min(1, Math.max(0, brightness[i]));
    levelIndices[i] = Math.round(clamped * maxLevel);
  }
  return levelIndices;
}

function ditherFloydSteinberg(brightness, width, height, levels) {
  const maxLevel = levels - 1;
  const levelIndices = new Int32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldValue = Math.min(1, Math.max(0, brightness[idx]));
      const levelIndex = Math.round(oldValue * maxLevel);
      const newValue = levelIndex / maxLevel;
      const error = oldValue - newValue;
      levelIndices[idx] = levelIndex;

      if (x + 1 < width) brightness[idx + 1] += error * (7 / 16);
      if (y + 1 < height) {
        if (x - 1 >= 0) brightness[idx + width - 1] += error * (3 / 16);
        brightness[idx + width] += error * (5 / 16);
        if (x + 1 < width) brightness[idx + width + 1] += error * (1 / 16);
      }
    }
  }

  return levelIndices;
}

async function imageToAsciiString(imagePathOrBuffer, width = CONFIG.defaultAsciiWidth, options = {}) {
  const { colorize = false, dither = true } = options;

  const img = await loadImage(imagePathOrBuffer);
  const imageAspect = img.height / img.width;
  const height = computeAsciiHeight(width, imageAspect);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  const brightness = new Float64Array(width * height);
  const colors = colorize ? new Uint8ClampedArray(width * height * 3) : null;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    brightness[p] = 1 - (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (colorize) {
      colors[p * 3] = r;
      colors[p * 3 + 1] = g;
      colors[p * 3 + 2] = b;
    }
  }

  const levelIndices = dither
    ? ditherFloydSteinberg(brightness, width, height, CHARSET.length)
    : quantizeBrightness(brightness, CHARSET.length);

  let out = '';
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const ch = getCharForLevel(levelIndices[p]);
      if (colorize) {
        const r = colors[p * 3], g = colors[p * 3 + 1], b = colors[p * 3 + 2];
        out += `${rgbToAnsiCode(r, g, b)}${ch}\x1b[0m`;
      } else {
        out += ch;
      }
    }
    out += "\r\n";
  }

  return { text: out, width, height };
}

module.exports = {
  imageToAsciiString,
  computeAsciiHeight,
  MONO_FONT_SPEC,
  MONO_CHAR_WIDTH_PX,
  MONO_CHAR_HEIGHT_PX
};
