const CONFIG = require("./config");
const { safeUnlink } = require('./utils');

const sessions = new Map();
let sweepTimer = null;

function touch(session) {
  session.lastActivity = Date.now();
}

function createSession(channelId, userId) {
  const session = {
    channelId,
    userId,
    targetPath: null,
    sourcePaths: [],
    createdAt: Date.now(),
    lastActivity: Date.now()
  };
  sessions.set(channelId, session);
  return session;
}

function getSession(channelId) {
  return sessions.get(channelId);
}

function hasSession(channelId) {
  return sessions.has(channelId);
}

async function destroySession(channelId) {
  const session = sessions.get(channelId);
  if (!session) return;
  await safeUnlink(session.targetPath);
  if (Array.isArray(session.sourcePaths)) {
    for (const p of session.sourcePaths) await safeUnlink(p);
  }
  sessions.delete(channelId);
}

function startSweeper(client) {
  if (sweepTimer) return;
  sweepTimer = setInterval(async () => {
    const now = Date.now();
    for (const [channelId, session] of sessions.entries()) {
      if (now - session.lastActivity > CONFIG.composeSessionTtlMs) {
        await destroySession(channelId);
        try {
          const channel = await client.channels.fetch(channelId);
          if (channel?.isTextBased()) {
            await channel.send("Compose session timed out from inactivity and was cancelled.");
          }
        } catch (_) {}
      }
    }
  }, CONFIG.composeSweepIntervalMs);
  sweepTimer.unref?.();
}

module.exports = { createSession, getSession, hasSession, destroySession, touch, startSweeper };
