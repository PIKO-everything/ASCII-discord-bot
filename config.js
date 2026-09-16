const path = require("path");
const fs = require("fs");
const yaml = require("js-yaml");

const configPath = path.join(__dirname, "config.yaml");
let fileConfig = {};

if (fs.existsSync(configPath)) {
  fileConfig = yaml.load(fs.readFileSync(configPath, "utf8")) || {};
}

const CONFIG = {
  discordToken: fileConfig.discordToken || "",
  discordClientId: fileConfig.discordClientId || "",
  discordGuildId: fileConfig.discordGuildId || "",

  defaultAsciiWidth: 80,
  minAsciiWidth: 10,
  maxAsciiWidth: 300,

  maxVideoSeconds: 10,
  videoFPS: 30,

  maxComposeSources: 12,
  composeTileSize: 24,

  maxImageBytes: 20 * 1024 * 1024,
  maxVideoBytes: 60 * 1024 * 1024,

  composeSessionTtlMs: 10 * 60 * 1000,
  composeSweepIntervalMs: 60 * 1000,

  fontFamily: 'monospace',
  fontSizePx: 12,

  tmpDir: path.join(__dirname, "..", "tmp")
};

module.exports = CONFIG;
