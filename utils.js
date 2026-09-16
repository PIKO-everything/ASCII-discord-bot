const fs = require("fs");
const fsp = fs.promises;
const crypto = require("crypto");
const { pipeline } = require("stream/promises");
const { Transform } = require('stream');
const fetch = require("node-fetch");

function uniqueId() {
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'unknown size';
  const units = ["B", 'KB', 'MB', "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)}${units[unitIndex]}`;
}

async function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) await fsp.unlink(filePath);
  } catch (_) {}
}

async function safeRmdir(dirPath) {
  try {
    if (dirPath && fs.existsSync(dirPath)) await fsp.rm(dirPath, { recursive: true, force: true });
  } catch (_) {}
}

function sizeLimiter(maxBytes) {
  let total = 0;
  return new Transform({
    transform(chunk, _enc, callback) {
      total += chunk.length;
      if (total > maxBytes) {
        callback(new Error(`Download exceeded the ${formatBytes(maxBytes)} size limit.`));
        return;
      }
      callback(null, chunk);
    }
  });
}

async function downloadToFile(url, outPath, maxBytes) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);

  const contentLengthHeader = res.headers.get("content-length");
  if (contentLengthHeader) {
    const declaredSize = Number(contentLengthHeader);
    if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
      throw new Error(`File is too large (${formatBytes(declaredSize)}, limit is ${formatBytes(maxBytes)}).`);
    }
  }

  const writeStream = fs.createWriteStream(outPath);
  try {
    await pipeline(res.body, sizeLimiter(maxBytes), writeStream);
  } catch (err) {
    await safeUnlink(outPath);
    throw err;
  }
  return outPath;
}

module.exports = { uniqueId, formatBytes, safeUnlink, safeRmdir, downloadToFile };
