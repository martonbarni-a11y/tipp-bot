const axios = require('axios');

const SCHEDULE_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

// Module-level cache for the duration of a single process run.
// Keyed by date string so the same fetch is reused if called multiple times.
let _cache = null;

async function fetchSchedule() {
  if (_cache) return _cache;
  const response = await axios.get(SCHEDULE_URL, { timeout: 10000 });
  _cache = response.data;
  return _cache;
}

/**
 * Parses an openfootball time string into a UTC ISO timestamp.
 *
 * Format: "HH:MM UTC±N"  e.g. "13:00 UTC-6", "20:00 UTC+2", "18:00 UTC"
 * Returns null for TBD or unrecognised formats.
 */
function parseKickoffUTC(date, timeStr) {
  if (!timeStr || /tbd/i.test(timeStr.trim())) return null;

  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*UTC([+-]\d+)?$/i);
  if (!m) {
    console.warn(`  ⚠ Unparseable time string: "${timeStr}"`);
    return null;
  }

  const localH = parseInt(m[1], 10);
  const localM = parseInt(m[2], 10);
  const offsetH = m[3] ? parseInt(m[3], 10) : 0;

  // UTC = local − offset  (e.g. "13:00 UTC-6" → 13 − (−6) = 19:00 UTC)
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCHours(localH - offsetH, localM, 0, 0);
  return d.toISOString();
}

/**
 * Returns all World Cup 2026 fixtures for a given date, shaped for scheduler.js.
 * @param {string} date - YYYY-MM-DD in the bot's configured timezone.
 * @returns {Promise<Array>}
 */
async function getMatchesForDate(date) {
  let data;
  try {
    data = await fetchSchedule();
  } catch (err) {
    console.error('Failed to fetch openfootball schedule:', err.message);
    return [];
  }

  if (!Array.isArray(data?.matches)) {
    console.error('Unexpected openfootball response shape — "matches" array missing.');
    return [];
  }

  const todays = data.matches.filter((m) => m.date === date);
  console.log(`openfootball: ${todays.length} fixture(s) on ${date}`);

  return todays.map((m) => {
    const kickoffISO = parseKickoffUTC(m.date, m.time);
    if (!kickoffISO) {
      console.warn(`  ⚠ ${m.team1} vs ${m.team2}: no parseable kickoff time — using noon UTC as fallback`);
    }

    return {
      teams: {
        home: { name: m.team1 },
        away: { name: m.team2 },
      },
      fixture: {
        date: kickoffISO ?? `${m.date}T12:00:00.000Z`,
      },
    };
  });
}

module.exports = { getMatchesForDate };
