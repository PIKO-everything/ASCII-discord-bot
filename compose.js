const { loadImage, createCanvas } = require('canvas');
const CONFIG = require("./config");

function colorDistanceSq(a, b) {
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

async function composePhotomosaic(targetPath, sourcePaths, options = {}) {
  const { tileSize = CONFIG.composeTileSize, maxSources = CONFIG.maxComposeSources } = options;

  const targetImg = await loadImage(targetPath);
  const tW = targetImg.width;
  const tH = targetImg.height;
  const cols = Math.ceil(tW / tileSize);
  const rows = Math.ceil(tH / tileSize);
  const outCanvas = createCanvas(tW, tH);
  const outCtx = outCanvas.getContext("2d");
  outCtx.fillStyle = "#000";
  outCtx.fillRect(0, 0, tW, tH);

  const sources = [];
  const usableSourcePaths = sourcePaths.slice(0, maxSources);
  for (const sourcePath of usableSourcePaths) {
    try {
      const img = await loadImage(sourcePath);
      const s = Math.min(img.width, img.height);
      const thumbCanvas = createCanvas(tileSize, tileSize);
      const ctx = thumbCanvas.getContext("2d");
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, tileSize, tileSize);

      const { data } = ctx.getImageData(0, 0, tileSize, tileSize);
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let j = 0; j < data.length; j += 4) {
        rSum += data[j];
        gSum += data[j + 1];
        bSum += data[j + 2];
        count++;
      }
      sources.push({ img, avg: { r: rSum / count, g: gSum / count, b: bSum / count } });
    } catch (_) {
      // skip unreadable source image
    }
  }

  if (sources.length === 0) {
    const fallback = createCanvas(tW, tH);
    fallback.getContext("2d").drawImage(targetImg, 0, 0, tW, tH);
    return fallback.toBuffer("image/png");
  }

  const tmpCanvas = createCanvas(tileSize, tileSize);
  const tmpCtx = tmpCanvas.getContext("2d");

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * tileSize;
      const y = row * tileSize;
      const w = Math.min(tileSize, tW - x);
      const h = Math.min(tileSize, tH - y);

      tmpCtx.clearRect(0, 0, tileSize, tileSize);
      tmpCtx.drawImage(targetImg, x, y, w, h, 0, 0, tileSize, tileSize);
      const { data } = tmpCtx.getImageData(0, 0, tileSize, tileSize);
      let rSum = 0, gSum = 0, bSum = 0, cnt = 0;
      for (let p = 0; p < data.length; p += 4) {
        rSum += data[p];
        gSum += data[p + 1];
        bSum += data[p + 2];
        cnt++;
      }
      const avgTarget = { r: rSum / cnt, g: gSum / cnt, b: bSum / cnt };

      let best = sources[0];
      let bestDist = colorDistanceSq(avgTarget, sources[0].avg);
      for (let s = 1; s < sources.length; s++) {
        const d = colorDistanceSq(avgTarget, sources[s].avg);
        if (d < bestDist) {
          best = sources[s];
          bestDist = d;
        }
      }

      const cropSize = Math.min(best.img.width, best.img.height);
      const cropX = (best.img.width - cropSize) / 2;
      const cropY = (best.img.height - cropSize) / 2;
      outCtx.drawImage(best.img, cropX, cropY, cropSize, cropSize, x, y, w, h);
    }
  }

  return outCanvas.toBuffer("image/png");
}

module.exports = { composePhotomosaic };
