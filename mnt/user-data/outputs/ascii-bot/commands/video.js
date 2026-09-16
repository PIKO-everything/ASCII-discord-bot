const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const CONFIG = require('../src/config');
const { videoToAsciiGifFromUrl } = require("../src/video");
const { safeUnlink } = require("../src/utils");
const { getWidth } = require("../src/channel-width");
const { withChannelLock, isChannelBusy } = require("../src/locks");

const PROGRESS_LABELS = {
  probing: "Checking video length...",
  downloading: 'Downloading video...',
  extracting: 'Extracting frames...',
  rendering: "Rendering ASCII GIF...",
  done: "Done.",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('video')
    .setDescription('Convert a video to an ASCII GIF')
    .addAttachmentOption(opt => opt.setName('video').setDescription('Video to convert'))
    .addStringOption(opt => opt.setName("url").setDescription("Video URL to convert")),
  async execute(interaction) {
    const attachment = interaction.options.getAttachment('video');
    const url = interaction.options.getString("url");

    if (!attachment && !url) {
      await interaction.reply({ content: 'Attach a video or provide a URL.', ephemeral: true });
      return;
    }
    if (attachment && attachment.contentType && !attachment.contentType.startsWith('video/')) {
      await interaction.reply({ content: "That attachment is not a video.", ephemeral: true });
      return;
    }
    if (isChannelBusy(interaction.channelId)) {
      await interaction.reply({
        content: 'Another conversion is already running in this channel. Try again shortly.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();
    const sourceUrl = attachment ? attachment.url : url;
    const width = getWidth(interaction.channelId);

    let gifPath = null;
    try {
      await withChannelLock(interaction.channelId, async () => {
        gifPath = await videoToAsciiGifFromUrl(sourceUrl, {
          width,
          maxSeconds: CONFIG.maxVideoSeconds,
          fps: CONFIG.videoFPS,
          maxBytes: CONFIG.maxVideoBytes,
          onProgress: (stage) => {
            const label = PROGRESS_LABELS[stage];
            if (label) interaction.editReply(label).catch(() => {});
          }
        });
      });
      await interaction.editReply({
        content: `ASCII GIF (${CONFIG.videoFPS} FPS):`,
        files: [new AttachmentBuilder(gifPath)],
      });
    } catch (err) {
      await interaction.editReply(`Video conversion failed: ${err.message}`);
    } finally {
      await safeUnlink(gifPath);
    }
  }
};
