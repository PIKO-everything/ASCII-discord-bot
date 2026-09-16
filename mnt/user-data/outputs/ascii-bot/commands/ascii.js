const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const CONFIG = require('../src/config');
const { uniqueId, safeUnlink, downloadToFile } = require("../src/utils");
const { imageToAsciiString } = require('../src/ascii');
const { getWidth } = require("../src/channel-width");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ascii")
    .setDescription("Convert an image to ASCII text")
    .addAttachmentOption(opt => opt.setName("image").setDescription('Image to convert'))
    .addStringOption(opt => opt.setName("url").setDescription("Image URL to convert"))
    .addBooleanOption(opt => opt.setName('color').setDescription("Output ANSI-colored text")),
  async execute(interaction) {
    const attachment = interaction.options.getAttachment("image");
    const url = interaction.options.getString("url");
    const colorize = interaction.options.getBoolean('color') || false;

    if (!attachment && !url) {
      await interaction.reply({ content: "Attach an image or provide a URL.", ephemeral: true });
      return;
    }
    if (attachment && attachment.contentType && !attachment.contentType.startsWith("image/")) {
      await interaction.reply({ content: 'That attachment is not an image.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const sourceUrl = attachment ? attachment.url : url;
    const extHint = attachment
      ? (path.extname(attachment.name) || ".png")
      : (path.extname(sourceUrl.split("?")[0]) || ".png");
    const width = getWidth(interaction.channelId);

    const tmpFile = path.join(CONFIG.tmpDir, `ascii-${uniqueId()}${extHint}`);
    const outPath = path.join(CONFIG.tmpDir, `ascii-out-${uniqueId()}.txt`);
    try {
      await downloadToFile(sourceUrl, tmpFile, CONFIG.maxImageBytes);
      const { text } = await imageToAsciiString(tmpFile, width, { colorize });
      await fsp.writeFile(outPath, text, 'utf8');
      await interaction.editReply({
        content: `Converted at width ${width}${colorize ? ', colorized' : ''}:`,
        files: [new AttachmentBuilder(outPath)],
      });
    } catch (err) {
      await interaction.editReply(`Conversion failed: ${err.message}`);
    } finally {
      await safeUnlink(tmpFile);
      await safeUnlink(outPath);
    }
  }
};
