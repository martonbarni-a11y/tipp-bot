require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { schedulePolls } = require('./scheduler');

const requiredEnvVars = ['DISCORD_BOT_TOKEN', 'API_FOOTBALL_KEY', 'DISCORD_CHANNEL_ID'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

client.once('ready', () => {
  console.log(`Bot ready — logged in as ${client.user.tag}`);
  schedulePolls(client);
});

client.on('error', (error) => {
  console.error('Discord client error:', error.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

client.login(process.env.DISCORD_BOT_TOKEN).catch((err) => {
  console.error('Failed to log in to Discord:', err.message);
  process.exit(1);
});
