const activeChannels = new Set();

function isChannelBusy(channelId) {
  return activeChannels.has(channelId);
}

async function withChannelLock(channelId, fn) {
  if (activeChannels.has(channelId)) {
    throw new Error("Another conversion is already running in this channel. Wait for it to finish.");
  }
  activeChannels.add(channelId);
  try {
    return await fn();
  } finally {
    activeChannels.delete(channelId);
  }
}

module.exports = { isChannelBusy, withChannelLock };
