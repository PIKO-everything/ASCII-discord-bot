const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const CONFIG = require('../src/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription('List available commands'),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('ASCII Bot - Commands')
      .setDescription("Mention the bot with an image or video attached to auto-convert it.")
      .addFields(
        { name: '/ascii', value: "Convert an image to ASCII text. Attach an image or provide a URL." },
        { name: '/video', value: `Convert a video (max ${CONFIG.maxVideoSeconds}s) to an ASCII GIF.` },
        { name: "/compose start", value: 'Begin a photomosaic session in this channel.' },
        { name: '/compose finish', value: "Process the uploaded images into a photomosaic." },
        { name: "/compose cancel", value: "Cancel the active compose session." },
        { name: '/setwidth', value: `Set the ASCII width for this channel (${CONFIG.minAsciiWidth}-${CONFIG.maxAsciiWidth}). Requires Manage Server.` }
      );
    await interaction.reply({ embeds: [embed] });
  }
};
