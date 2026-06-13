# FIFA World Cup 2026 Poll Bot

A Discord bot that automatically posts a native poll for every World Cup 2026 match on the day it's played.

**No API key required.** Match data is fetched from the public [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json) dataset — no sign-up, no rate limits.

---

## Features

- Runs a configurable daily cron job (default 8:00 AM) to fetch that day's matches
- Creates one native Discord poll per match with **Home / Away / Draw** options
- Poll duration is set to the hours remaining until kickoff (capped at 32 h)
- Displays kickoff time in CET (Europe/Budapest timezone by default)
- Skips days with no matches (or optionally posts a "no matches" message)

---

## Prerequisites

- Node.js 18+
- A Discord bot token

---

## Setup

### 1. Create a Discord Application & Bot

1. Go to [https://discord.com/developers/applications](https://discord.com/developers/applications) and click **New Application**.
2. Navigate to **Bot** → click **Add Bot**.
3. Under **Token**, click **Reset Token** and copy it — this is your `DISCORD_BOT_TOKEN`.
4. Under **Privileged Gateway Intents**, no privileged intents are required for this bot.
5. Under **Bot Permissions**, grant at minimum:
   - `Send Messages`
   - `View Channels`

### 2. Invite the Bot to Your Server

1. Go to **OAuth2 → URL Generator**.
2. Select scopes: `bot`.
3. Select bot permissions: `Send Messages`, `View Channels`.
4. Copy and open the generated URL, then select your server.

### 3. Get the Target Channel ID

1. In Discord, go to **User Settings → Advanced** and enable **Developer Mode**.
2. Right-click the channel where polls should be posted → **Copy Channel ID**.

### 4. Install & Configure

```bash
# Clone or download this project, then:
cd worldcup-poll-bot
npm install

# Copy the example env file and fill in your values
cp .env.example .env
```

Edit `.env`:

```env
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_CHANNEL_ID=your_channel_id_here
POST_TIME=0 8 * * *        # cron expression — default is 8:00 AM every day
TIMEZONE=Europe/Budapest   # timezone for scheduling and kickoff time display
POST_NO_MATCHES=false      # set to "true" to post a message on days with no matches
```

### 5. Run the Bot

```bash
node index.js
```

The bot will log in, print a confirmation, and wait for the next scheduled run. Keep it running with a process manager such as [PM2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
pm2 start index.js --name worldcup-poll-bot
pm2 save
pm2 startup
```

---

## Project Structure

```
worldcup-poll-bot/
├── index.js        — Discord client setup, login, startup
├── scheduler.js    — Cron job: fetches matches and posts polls
├── api.js          — openfootball schedule fetcher
├── .env            — Your secrets (not committed)
├── .env.example    — Template for .env
└── package.json
```

---

## Configuration Reference

| Variable            | Default             | Description                                                |
|---------------------|---------------------|------------------------------------------------------------|
| `DISCORD_BOT_TOKEN` | *(required)*        | Bot token from Discord Developer Portal                    |
| `DISCORD_CHANNEL_ID`| *(required)*        | ID of the channel to post polls in                         |
| `POST_TIME`         | `0 8 * * *`         | Cron expression for daily run time                         |
| `TIMEZONE`          | `Europe/Budapest`   | Timezone for scheduling and kickoff display                |
| `POST_NO_MATCHES`   | `false`             | Post a message on days with no scheduled World Cup matches |

---

## Notes

- Discord native polls require **discord.js v14.6+**.
- Poll duration is clamped to **1–32 hours**. If the cron runs after kickoff, the poll will default to 1 hour.
- Match data source: `https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json`
- The schedule JSON is fetched once per day and cached in memory for that run.
