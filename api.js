const axios = require('axios');
const { DateTime } = require('luxon');

const SCHEDULE_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

// Module-level cache for the duration of a single process run.
let _cache = null;

async function fetchSchedule() {
  if (_cache) return _cache;
  const response = await axios.get(SCHEDULE_URL, { timeout: 10000 });
  _cache = response.data;
  return _cache;
}

/**
 * Parses an openfootball time string into a UTC ISO timestamp using luxon.
 *
 * Format: "HH:MM UTC±N"  e.g. "13:00 UTC-6", "20:00 UTC+2", "18:00 UTC"
 *
 * The UTC offset in the openfootball JSON is already DST-adjusted for each
 * host city (e.g. UTC-5 for CDT cities, UTC-6 for MDT cities and Mexico City
 * which abolished DST in 2023). Luxon's FixedOffsetZone preserves that
 * intent exactly, then .toUTC() gives us the unambiguous UTC instant.
 *
 * Returns null for TBD or unrecognised formats.
 */
function parseKickoffUTC(date, timeStr) {
  if (!timeStr || /tbd/i.test(timeStr.trim())) return null;

  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*UTC([+-]\d+)?$/i);
  if (!m) {
    console.warn(`  ⚠ Unparseable time string: "${timeStr}"`);
    return null;
  }

  const hh = m[1].padStart(2, '0');
  const mm = m[2];
  // luxon accepts "UTC-6", "UTC+2", "UTC" as fixed-offset zone names
  const zone = m[3] ? `UTC${m[3]}` : 'UTC';

  const dt = DateTime.fromISO(`${date}T${hh}:${mm}:00`, { zone });

  if (!dt.isValid) {
    console.warn(`  ⚠ luxon could not parse "${timeStr}": ${dt.invalidExplanation}`);
    return null;
  }

  return dt.toUTC().toISO();
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
