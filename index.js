require('dotenv').config();

const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Partials, Collection, AttachmentBuilder } = require('discord.js');

const CONFIG = require('./src/config');
const { uniqueId, safeUnlink, downloadToFile } = require('./src/utils');
const { imageToAsciiString } = require("./src/ascii");
const { videoToAsciiGifFromUrl } = require("./src/video");
const { getWidth } = require("./src/channel-width");
const { hasSession, getSession, touch, startSweeper } = require('./src/sessions');
const { isChannelBusy, withChannelLock } = require("./src/locks");
const commands = require("./commands");

if (!fs.existsSync(CONFIG.tmpDir)) fs.mkdirSync(CONFIG.tmpDir, { recursive: true });

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || '';
if (!DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN is not set. Set it as an environment variable before starting the bot.");
  process.exit(1);
}

const MENTION_REGEX = /<@!?\d+>/;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

client.commands = new Collection();
for (const command of commands) {
  client.commands.set(command.data.name, command);
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  startSweeper(client);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Command ${interaction.commandName} failed:`, err);
    const payload = { content: `An error occurred: ${err.message || 'unknown'}`, ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  const content = (msg.content || '').trim();
  const isMention = MENTION_REGEX.test(content) && msg.mentions.users.has(client.user.id);

  try {
    if (isMention && msg.attachments.size > 0) {
      await handleMentionConvert(msg);
      return;
    }

    if (hasSession(msg.channel.id) && msg.attachments.size > 0) {
      await handleComposeUpload(msg);
    }
  } catch (err) {
    console.error('Message handler error:', err);
    try { await msg.reply(`An error occurred: ${err.message || 'unknown'}`); } catch (_) {}
  }
});

async function handleMentionConvert(msg) {
  const att = msg.attachments.first();
  const mime = att.contentType || '';
  const width = getWidth(msg.channel.id);

  if (mime.startsWith("image/")) {
    const tmpFile = path.join(CONFIG.tmpDir, `mention-${uniqueId()}${path.extname(att.name) || '.png'}`);
    const outPath = path.join(CONFIG.tmpDir, `ascii-${uniqueId()}.txt`);
    try {
      await downloadToFile(att.url, tmpFile, CONFIG.maxImageBytes);
      const { text } = await imageToAsciiString(tmpFile, width, { colorize: false });
      await fs.promises.writeFile(outPath, text, 'utf8');
      await msg.reply({ files: [new AttachmentBuilder(outPath)] });
    } catch (err) {
      await msg.reply(`Conversion failed: ${err.message}`);
    } finally {
      await safeUnlink(tmpFile);
      await safeUnlink(outPath);
    }
    return;
  }

  if (mime.startsWith('video/')) {
    if (isChannelBusy(msg.channel.id)) {
      await msg.reply('Another conversion is already running in this channel. Try again shortly.');
      return;
    }
    let gifPath = null;
    try {
      await withChannelLock(msg.channel.id, async () => {
        gifPath = await videoToAsciiGifFromUrl(att.url, {
          width,
          maxSeconds: CONFIG.maxVideoSeconds,
          fps: CONFIG.videoFPS,
          maxBytes: CONFIG.maxVideoBytes,
        });
      });
      await msg.reply({ files: [new AttachmentBuilder(gifPath)] });
    } catch (err) {
      await msg.reply(`Video conversion failed: ${err.message}`);
    } finally {
      await safeUnlink(gifPath);
    }
  }
}

async function handleComposeUpload(msg) {
  const session = getSession(msg.channel.id);
  if (!session || msg.author.id !== session.userId) return;

  for (const att of msg.attachments.values()) {
    const isImage = (att.contentType || '').startsWith("image/");
    if (!isImage) continue;

    const tmpPath = path.join(CONFIG.tmpDir, `compose-${uniqueId()}${path.extname(att.name) || '.png'}`);
    try {
      await downloadToFile(att.url, tmpPath, CONFIG.maxImageBytes);
    } catch (err) {
      await msg.reply(`Skipped an attachment: ${err.message}`);
      continue;
    }

    touch(session);
    if (!session.targetPath) {
      session.targetPath = tmpPath;
      await msg.reply('Target image saved. Now upload source images.');
    } else if (session.sourcePaths.length >= CONFIG.maxComposeSources) {
      await msg.reply(`Reached maximum number of source images (${CONFIG.maxComposeSources}).`);
      await safeUnlink(tmpPath);
    } else {
      session.sourcePaths.push(tmpPath);
      await msg.reply(`Source image added (${session.sourcePaths.length}/${CONFIG.maxComposeSources}).`);
    }
  }
}

client.login(DISCORD_TOKEN).catch(err => console.error('Login failed:', err));
