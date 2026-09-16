const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const GIFEncoder = require('gifencoder');
const { createCanvas, loadImage } = require('canvas');

const CONFIG = require("./config");
const { uniqueId, safeUnlink, safeRmdir, downloadToFile } = require('./utils');
const {
  imageToAsciiString,
  computeAsciiHeight,
  MONO_FONT_SPEC,
  MONO_CHAR_WIDTH_PX,
  MONO_CHAR_HEIGHT_PX
} = require("./ascii");

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

class DurationExceededError extends Error {}

function probeDuration(target) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(target, (err, data) => {
      if (err) return reject(err);
      resolve(data.format?.duration || 0);
    });
  });
}

async function videoToAsciiGifFromUrl(videoUrl, options = {}) {
  const {
    width = CONFIG.defaultAsciiWidth,
    maxSeconds = CONFIG.maxVideoSeconds,
    fps = CONFIG.videoFPS,
    maxBytes = CONFIG.maxVideoBytes,
    onProgress = () => {}
  } = options;

  const id = uniqueId();
  const tmpVideo = path.join(CONFIG.tmpDir, `video-${id}.mp4`);
  const framesDir = path.join(CONFIG.tmpDir, `frames-${id}`);
  let gifPath = null;

  try {
    onProgress("probing");
    try {
      const remoteDuration = await probeDuration(videoUrl);
      if (remoteDuration > maxSeconds) {
        throw new DurationExceededError(`Video is longer than ${maxSeconds}s (${remoteDuration.toFixed(1)}s).`);
      }
    } catch (probeErr) {
      if (probeErr instanceof DurationExceededError) throw probeErr;
      // remote probing unsupported for this url or protocol, fall back to a post-download check
    }

    onProgress("downloading");
    await downloadToFile(videoUrl, tmpVideo, maxBytes);

    const localDuration = await probeDuration(tmpVideo);
    if (localDuration > maxSeconds) {
      throw new Error(`Video is longer than ${maxSeconds}s (${localDuration.toFixed(1)}s).`);
    }

    onProgress('extracting');
    await fsp.mkdir(framesDir, { recursive: true });
    const framePattern = path.join(framesDir, 'frame-%05d.png');
    await new Promise((resolve, reject) => {
      ffmpeg(tmpVideo)
        .outputOptions([`-vf fps=${fps}`, `-t ${maxSeconds}`])
        .output(framePattern)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    const files = (await fsp.readdir(framesDir)).filter(f => f.endsWith(".png")).sort();
    if (files.length === 0) throw new Error('No frames extracted from video.');

    onProgress('rendering');
    const firstImg = await loadImage(path.join(framesDir, files[0]));
    const imageAspect = firstImg.height / firstImg.width;
    const asciiHeight = computeAsciiHeight(width, imageAspect);

    const cellW = Math.ceil(MONO_CHAR_WIDTH_PX);
    const cellH = Math.ceil(MONO_CHAR_HEIGHT_PX);
    const canvasWidth = width * cellW;
    const canvasHeight = asciiHeight * cellH;

    const encoder = new GIFEncoder(canvasWidth, canvasHeight);
    gifPath = path.join(CONFIG.tmpDir, `ascii-${id}.gif`);
    const writeStream = fs.createWriteStream(gifPath);
    encoder.createReadStream().pipe(writeStream);
    encoder.start();
    encoder.setRepeat(0);
    encoder.setDelay(Math.round(1000 / fps));
    encoder.setQuality(10);

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext("2d");
    ctx.font = MONO_FONT_SPEC;
    ctx.textBaseline = "top";

    for (const file of files) {
      const { text } = await imageToAsciiString(path.join(framesDir, file), width, { colorize: false, dither: true });
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.fillStyle = 'white';
      const lines = text.split(/\r?\n/);
      for (let y = 0; y < lines.length; y++) {
        ctx.fillText(lines[y], 0, y * cellH);
      }
      encoder.addFrame(ctx);
    }

    encoder.finish();
    await new Promise(resolve => writeStream.on('finish', resolve));
    onProgress('done');

    return gifPath;
  } catch (err) {
    await safeUnlink(gifPath);
    throw err;
  } finally {
    await safeRmdir(framesDir);
    await safeUnlink(tmpVideo);
  }
}

module.exports = { videoToAsciiGifFromUrl };
