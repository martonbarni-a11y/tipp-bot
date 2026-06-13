const cron = require('node-cron');
const { DateTime } = require('luxon');
const { getMatchesForDate } = require('./api');

const TIMEZONE = process.env.TIMEZONE || 'Europe/Budapest';
const POST_TIME = process.env.POST_TIME || '0 8 * * *';
const POST_NO_MATCHES = process.env.POST_NO_MATCHES === 'true';

const POLL_MIN_HOURS = 1;
const POLL_MAX_HOURS = 32;

// Team name → flag emoji for all FIFA World Cup 2026 participants (48 teams).
// Names match what API-Football returns for international fixtures.
// Subdivision flags (England, Scotland, Wales) use Unicode tag sequences.
const TEAM_FLAGS = {
  // CONMEBOL
  'Argentina':        '🇦🇷',
  'Brazil':           '🇧🇷',
  'Colombia':         '🇨🇴',
  'Uruguay':          '🇺🇾',
  'Ecuador':          '🇪🇨',
  'Venezuela':        '🇻🇪',
  'Paraguay':         '🇵🇾',
  'Chile':            '🇨🇱',
  'Peru':             '🇵🇪',
  'Bolivia':          '🇧🇴',

  // CONCACAF
  'United States':    '🇺🇸',
  'USA':              '🇺🇸',  // API-Football alias
  'Canada':           '🇨🇦',
  'Mexico':           '🇲🇽',
  'Panama':           '🇵🇦',
  'Honduras':         '🇭🇳',
  'Costa Rica':       '🇨🇷',
  'Jamaica':          '🇯🇲',
  'El Salvador':      '🇸🇻',
  'Guatemala':        '🇬🇹',
  'Haiti':            '🇭🇹',
  'Trinidad & Tobago':'🇹🇹',
  'Trinidad and Tobago':'🇹🇹',

  // UEFA
  'France':           '🇫🇷',
  'Germany':          '🇩🇪',
  'Spain':            '🇪🇸',
  'England':          '🏴󠁧󠁢󠁥󠁮󠁧󁿢',
  'Portugal':         '🇵🇹',
  'Netherlands':      '🇳🇱',
  'Belgium':          '🇧🇪',
  'Italy':            '🇮🇹',
  'Switzerland':      '🇨🇭',
  'Croatia':          '🇭🇷',
  'Denmark':          '🇩🇰',
  'Poland':           '🇵🇱',
  'Serbia':           '🇷🇸',
  'Austria':          '🇦🇹',
  'Scotland':         '🏴󠁧󠁢󠁳󠁣󠁴󁿢',
  'Wales':            '🏴󠁧󠁢󠁷󠁬󠁳󁿢',
  'Sweden':           '🇸🇪',
  'Norway':           '🇳🇴',
  'Czech Republic':   '🇨🇿',
  'Czechia':          '🇨🇿',
  'Hungary':          '🇭🇺',
  'Romania':          '🇷🇴',
  'Slovakia':         '🇸🇰',
  'Slovenia':         '🇸🇮',
  'Ukraine':          '🇺🇦',
  'Turkey':           '🇹🇷',
  'Türkiye':          '🇹🇷',
  'Greece':           '🇬🇷',
  'Albania':          '🇦🇱',
  'Iceland':          '🇮🇸',
  'Ireland':          '🇮🇪',
  'Finland':          '🇫🇮',
  'North Macedonia':  '🇲🇰',
  'Bosnia':           '🇧🇦',
  'Bosnia and Herzegovina': '🇧🇦',
  'Kosovo':           '🇽🇰',
  'Montenegro':       '🇲🇪',
  'Georgia':          '🇬🇪',

  // CAF
  'Morocco':          '🇲🇦',
  'Senegal':          '🇸🇳',
  'Nigeria':          '🇳🇬',
  'Cameroon':         '🇨🇲',
  'Egypt':            '🇪🇬',
  'Ghana':            '🇬🇭',
  "Côte d'Ivoire":    '🇨🇮',
  "Cote d'Ivoire":    '🇨🇮',
  'Ivory Coast':      '🇨🇮',
  'South Africa':     '🇿🇦',
  'DR Congo':         '🇨🇩',
  'Congo DR':         '🇨🇩',
  'Algeria':          '🇩🇿',
  'Tunisia':          '🇹🇳',
  'Mali':             '🇲🇱',
  'Zambia':           '🇿🇲',
  'Uganda':           '🇺🇬',
  'Tanzania':         '🇹🇿',
  'Zimbabwe':         '🇿🇼',
  'Cape Verde':       '🇨🇻',
  'Burkina Faso':     '🇧🇫',
  'Guinea':           '🇬🇳',
  'Mozambique':       '🇲🇿',
  'Angola':           '🇦🇴',
  'Comoros':          '🇰🇲',

  // AFC
  'Japan':            '🇯🇵',
  'South Korea':      '🇰🇷',
  'Korea Republic':   '🇰🇷',  // API-Football alias
  'Australia':        '🇦🇺',
  'Saudi Arabia':     '🇸🇦',
  'Iran':             '🇮🇷',
  'Qatar':            '🇶🇦',
  'Indonesia':        '🇮🇩',
  'Jordan':           '🇯🇴',
  'Uzbekistan':       '🇺🇿',
  'Iraq':             '🇮🇶',
  'China':            '🇨🇳',
  'China PR':         '🇨🇳',
  'Oman':             '🇴🇲',
  'Bahrain':          '🇧🇭',
  'United Arab Emirates': '🇦🇪',
  'UAE':              '🇦🇪',
  'Palestine':        '🇵🇸',
  'Kyrgyzstan':       '🇰🇬',
  'Tajikistan':       '🇹🇯',

  // OFC
  'New Zealand':      '🇳🇿',
  'Fiji':             '🇫🇯',
  'Papua New Guinea': '🇵🇬',
  'Solomon Islands':  '🇸🇧',
  'Vanuatu':          '🇻🇺',
  'Tahiti':           '🇵🇫',
};

/**
 * Looks up a flag emoji for a team name.
 * Falls back to 🏳️ and logs a warning for unmapped teams.
 */
function getTeamFlag(teamName) {
  const flag = TEAM_FLAGS[teamName];
  if (!flag) {
    console.warn(`  ⚠ No flag mapping for team: "${teamName}" — using fallback 🏳️`);
    return '🏳️';
  }
  return flag;
}

function getTodayString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Converts a UTC ISO kickoff timestamp to HH:MM in the configured timezone
 * (Europe/Budapest by default). luxon uses the full IANA tz database, so
 * CEST (UTC+2) vs CET (UTC+1) is handled automatically.
 */
function formatKickoffTime(fixtureDate) {
  return DateTime.fromISO(fixtureDate, { zone: 'UTC' })
    .setZone(TIMEZONE)
    .toFormat('HH:mm');
}

/**
 * Calculates poll duration in hours (rounded to nearest hour) so the poll
 * closes as close as possible to kickoff. Warns if kickoff is beyond the
 * 32-hour Discord cap and the poll will remain open past kick-off.
 */
function getPollDurationHours(fixtureDate, matchLabel) {
  const msUntilKickoff = new Date(fixtureDate) - Date.now();
  const hoursExact = msUntilKickoff / (1000 * 60 * 60);
  const hours = Math.round(hoursExact);

  if (hours > POLL_MAX_HOURS) {
    console.warn(
      `  ⚠ "${matchLabel}" kicks off in ~${hours}h — poll capped at ${POLL_MAX_HOURS}h and will stay open past kickoff.`
    );
    return POLL_MAX_HOURS;
  }

  return Math.max(hours, POLL_MIN_HOURS);
}

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
    const matchLabel = `${homeTeam} vs ${awayTeam}`;
    const duration = getPollDurationHours(kickoffDate, matchLabel);

    const question = `${homeTeam} vs ${awayTeam} (${kickoffTime} CET)`.slice(0, 300);

    try {
      await channel.send({
        poll: {
          question: { text: question },
          answers: [
            { text: homeTeam.slice(0, 55) },
            { text: awayTeam.slice(0, 55) },
            { text: 'X ❌' },
          ],
          duration,
          allowMultiselect: false,
        },
      });
      console.log(`  ✓ Poll created: ${question} — ${duration}h`);
    } catch (err) {
      console.error(`  ✗ Failed to create poll for ${matchLabel}:`, err.message);
    }

    // Brief pause between posts to respect Discord rate limits
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

function schedulePolls(client) {
  if (!cron.validate(POST_TIME)) {
    console.error(`Invalid POST_TIME cron expression: "${POST_TIME}". Falling back to "0 8 * * *".`);
    process.env.POST_TIME = '0 8 * * *';
  }

  console.log(`Polls scheduled — cron: "${POST_TIME}", timezone: "${TIMEZONE}"`);

  cron.schedule(
    POST_TIME,
    () => {
      console.log("Cron triggered — creating today's polls...");
      createTodaysPolls(client).catch((err) =>
        console.error('Unexpected error in createTodaysPolls:', err)
      );
    },
    { timezone: TIMEZONE }
  );
}

module.exports = { schedulePolls };
