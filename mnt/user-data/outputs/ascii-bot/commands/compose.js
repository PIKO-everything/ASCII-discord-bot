const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const CONFIG = require('../src/config');
const { createSession, getSession, hasSession, destroySession, touch } = require('../src/sessions');
const { composePhotomosaic } = require('../src/compose');
const { uniqueId, safeUnlink } = require("../src/utils");
const { withChannelLock, isChannelBusy } = require("../src/locks");

module.exports = {
  data: new SlashCommandBuilder()
    .setName('compose')
    .setDescription('Build a photomosaic from uploaded images')
    .addSubcommand(sub => sub.setName('start').setDescription("Start a compose session in this channel"))
    .addSubcommand(sub => sub.setName('finish').setDescription("Process the uploaded images into a photomosaic"))
    .addSubcommand(sub => sub.setName('cancel').setDescription("Cancel the active compose session")),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      if (hasSession(interaction.channelId)) {
        await interaction.reply('A compose session is already active in this channel. Upload images or run `/compose finish` when ready.');
        return;
      }
      createSession(interaction.channelId, interaction.user.id);
      const embed = new EmbedBuilder()
        .setTitle("Compose - Photomosaic")
        .setDescription(
          'Upload the target image first (the image you want the bot to recreate). ' +
          "Then upload one or more source images (the building-block images) as normal message attachments. " +
          "When ready, run `/compose finish`. Only the user who started the session can finish or cancel it. " +
          `The session expires automatically after ${Math.round(CONFIG.composeSessionTtlMs / 60000)} minutes of inactivity.`
        )
        .setColor(0x00AE86);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === 'cancel') {
      const session = getSession(interaction.channelId);
      if (!session) {
        await interaction.reply({ content: "No active compose session in this channel.", ephemeral: true });
        return;
      }
      if (session.userId !== interaction.user.id) {
        await interaction.reply({ content: "Only the session owner can cancel it.", ephemeral: true });
        return;
      }
      await destroySession(interaction.channelId);
      await interaction.reply('Compose session cancelled.');
      return;
    }

    if (sub === 'finish') {
      const session = getSession(interaction.channelId);
      if (!session) {
        await interaction.reply({ content: "No active compose session in this channel. Run `/compose start` first.", ephemeral: true });
        return;
      }
      if (session.userId !== interaction.user.id) {
        await interaction.reply({ content: "Only the session owner can finish it.", ephemeral: true });
        return;
      }
      if (!session.targetPath) {
        await interaction.reply({ content: 'No target image uploaded yet.', ephemeral: true });
        return;
      }
      if (!session.sourcePaths || session.sourcePaths.length === 0) {
        await interaction.reply({ content: "No source images uploaded yet.", ephemeral: true });
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
      touch(session);
      try {
        await withChannelLock(interaction.channelId, async () => {
          const outBuffer = await composePhotomosaic(session.targetPath, session.sourcePaths, {
            tileSize: CONFIG.composeTileSize,
            maxSources: CONFIG.maxComposeSources
          });
          const outPath = path.join(CONFIG.tmpDir, `compose-out-${uniqueId()}.png`);
          try {
            await fsp.writeFile(outPath, outBuffer);
            await interaction.editReply({ content: "Composed image:", files: [new AttachmentBuilder(outPath)] });
          } finally {
            await safeUnlink(outPath);
          }
        });
      } catch (err) {
        await interaction.editReply(`Compose failed: ${err.message}`);
      } finally {
        await destroySession(interaction.channelId);
      }
      return;
    }
  }
};
