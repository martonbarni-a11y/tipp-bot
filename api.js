const axios = require('axios');

const API_BASE = 'https://v3.football.api-sports.io';

// FIFA World Cup league ID on API-Football
const WORLD_CUP_LEAGUE_ID = 1;
const WORLD_CUP_SEASON = 2026;

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'x-apisports-key': process.env.API_FOOTBALL_KEY,
  },
  timeout: 10000,
});

/**
 * Fetches all World Cup 2026 fixtures for a given date.
 * @param {string} date - Date string in YYYY-MM-DD format.
 * @returns {Promise<Array>} Array of fixture objects from API-Football.
 */
async function getMatchesForDate(date) {
  try {
    const response = await apiClient.get('/fixtures', {
      params: {
        league: WORLD_CUP_LEAGUE_ID,
        season: WORLD_CUP_SEASON,
        date,
      },
    });

    const { errors, results, response: fixtures } = response.data;

    if (errors && Object.keys(errors).length > 0) {
      console.error('API-Football returned errors:', JSON.stringify(errors));
      return [];
    }

    console.log(`API-Football: ${results} fixture(s) found for ${date}`);
    return fixtures || [];
  } catch (error) {
    if (error.response) {
      console.error(`API-Football HTTP ${error.response.status}:`, error.response.data);
    } else {
      console.error('API-Football request failed:', error.message);
    }
    return [];
  }
}

module.exports = { getMatchesForDate };
