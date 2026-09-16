const CONFIG = require("./config");

const widths = new Map();

function getWidth(channelId) {
  return widths.get(channelId) || CONFIG.defaultAsciiWidth;
}

function setWidth(channelId, width) {
  widths.set(channelId, width);
}

module.exports = { getWidth, setWidth };
