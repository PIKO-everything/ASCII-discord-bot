const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const CONFIG = require('../src/config');
const { setWidth } = require("../src/channel-width");

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setwidth')
    .setDescription("Set the ASCII width used for conversions in this channel")
    .addIntegerOption(opt =>
      opt.setName("width")
        .setDescription(`Between ${CONFIG.minAsciiWidth} and ${CONFIG.maxAsciiWidth}`)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "You need the Manage Server permission to change this.", ephemeral: true });
      return;
    }

    const width = interaction.options.getInteger("width", true);
    if (width < CONFIG.minAsciiWidth || width > CONFIG.maxAsciiWidth) {
      await interaction.reply({
        content: `Width must be between ${CONFIG.minAsciiWidth} and ${CONFIG.maxAsciiWidth}.`,
        ephemeral: true
      });
      return;
    }

    setWidth(interaction.channelId, width);
    await interaction.reply(`ASCII width for this channel set to ${width}.`);
  }
};
