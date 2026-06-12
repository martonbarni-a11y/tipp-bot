const cron = require('node-cron');
const { getMatchesForDate } = require('./api');

const TIMEZONE = process.env.TIMEZONE || 'Europe/Budapest';
const POST_TIME = process.env.POST_TIME || '0 8 * * *';
const POST_NO_MATCHES = process.env.POST_NO_MATCHES === 'true';

// Discord poll: min 1 hour, max 168 hours (7 days). Cap at 32 per spec.
const POLL_MIN_HOURS = 1;
const POLL_MAX_HOURS = 32;

/**
 * Returns today's date as YYYY-MM-DD in the configured timezone.
 */
function getTodayString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Formats a UTC fixture date to HH:MM in CET/CEST (Europe/Budapest).
 */
function formatKickoffTime(fixtureDate) {
  return new Date(fixtureDate).toLocaleTimeString('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Calculates poll duration in hours from now until kickoff, clamped to valid range.
 */
function getPollDurationHours(fixtureDate) {
  const msUntilKickoff = new Date(fixtureDate) - Date.now();
  const hours = Math.floor(msUntilKickoff / (1000 * 60 * 60));
  return Math.min(Math.max(hours, POLL_MIN_HOURS), POLL_MAX_HOURS);
}

/**
 * Fetches today's matches and posts a native Discord poll for each one.
 */
async function createTodaysPolls(client) {
  const channelId = process.env.DISCORD_CHANNEL_ID;

  let channel;
  try {
    channel = await client.channels.fetch(channelId);
  } catch (err) {
    console.error(`Failed to fetch channel ${channelId}:`, err.message);
    return;
  }

  if (!channel?.isTextBased()) {
    console.error(`Channel ${channelId} is not a text channel.`);
    return;
  }

  const today = getTodayString();
  console.log(`[${new Date().toISOString()}] Checking World Cup matches for ${today}...`);

  const matches = await getMatchesForDate(today);

  if (matches.length === 0) {
    console.log('No matches today — skipping.');
    if (POST_NO_MATCHES) {
      await channel
        .send('No FIFA World Cup 2026 matches scheduled for today.')
        .catch((err) => console.error('Failed to send no-matches message:', err.message));
    }
    return;
  }

  console.log(`Creating polls for ${matches.length} match(es)...`);

  for (const match of matches) {
    const homeTeam = match.teams.home.name;
    const awayTeam = match.teams.away.name;
    const kickoffDate = match.fixture.date;
    const kickoffTime = formatKickoffTime(kickoffDate);
    const duration = getPollDurationHours(kickoffDate);

    // Truncate team names to fit Discord's 55-char poll question limit
    const question = `Who wins? ${homeTeam} vs ${awayTeam} (${kickoffTime} CET)`.slice(0, 300);

    try {
      await channel.send({
        poll: {
          question: { text: question },
          answers: [
            { text: homeTeam.slice(0, 55), emoji: { name: '🏠' } },
            { text: awayTeam.slice(0, 55), emoji: { name: '✈️' } },
            { text: 'Draw', emoji: { name: '🤝' } },
          ],
          duration,
          allowMultiselect: false,
        },
      });
      console.log(`  ✓ Poll created: ${homeTeam} vs ${awayTeam} (${kickoffTime} CET) — ${duration}h duration`);
    } catch (err) {
      console.error(`  ✗ Failed to create poll for ${homeTeam} vs ${awayTeam}:`, err.message);
    }

    // Brief pause between posts to respect Discord rate limits
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

/**
 * Registers the cron job and attaches it to the Discord client.
 */
function schedulePolls(client) {
  if (!cron.validate(POST_TIME)) {
    console.error(`Invalid POST_TIME cron expression: "${POST_TIME}". Falling back to "0 8 * * *".`);
    process.env.POST_TIME = '0 8 * * *';
  }

  console.log(`Polls scheduled — cron: "${POST_TIME}", timezone: "${TIMEZONE}"`);

  cron.schedule(
    POST_TIME,
    () => {
      console.log('Cron triggered — creating today\'s polls...');
      createTodaysPolls(client).catch((err) =>
        console.error('Unexpected error in createTodaysPolls:', err)
      );
    },
    { timezone: TIMEZONE }
  );
}

module.exports = { schedulePolls };
