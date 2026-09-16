const { REST, Routes } = require('discord.js');
const CONFIG = require("./config");
const commands = require("./commands");

const token = CONFIG.discordToken;
const clientId = CONFIG.discordClientId;
const guildId = CONFIG.discordGuildId;

if (!token || !clientId) {
  console.error("discordToken and discordClientId must be set in config.yaml.");
  process.exit(1);
}

const body = commands.map(c => c.data.toJSON());
const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    const route = guildId
      ? Routes.applicationGuildCommands(clientId, guildId)
      : Routes.applicationCommands(clientId);
    await rest.put(route, { body });
    console.log(`Registered ${body.length} command(s)${guildId ? ` to guild ${guildId}` : ' globally'}.`);
  } catch (err) {
    console.error("Failed to register commands:", err);
    process.exit(1);
  }
})();
