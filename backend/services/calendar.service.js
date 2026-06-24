const { google } = require('googleapis');

/**
 * Build an authenticated Google OAuth2 client from user's stored token
 */
function buildOAuthClient(calendarToken) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    process.env.BACKEND_URL + '/api/auth/google-callback'
  );
  oauth2Client.setCredentials({
    access_token: calendarToken.access_token,
    refresh_token: calendarToken.refresh_token,
  });
  return oauth2Client;
}

/**
 * getCalendarEvents(user, dateStr)
 * dateStr: 'YYYY-MM-DD'
 * Returns raw events array from Google Calendar for the given date (IST timezone)
 */
async function getCalendarEvents(user, dateStr) {
  if (!user.google_calendar_token || !user.google_calendar_token.access_token) {
    return [];
  }

  try {
    const oauth2Client = buildOAuthClient(user.google_calendar_token);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Build IST start/end for the date
    const timeMin = new Date(`${dateStr}T00:00:00+05:30`).toISOString();
    const timeMax = new Date(`${dateStr}T23:59:59+05:30`).toISOString();

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items || [];
  } catch (err) {
    if (
      err.message?.includes('invalid_grant') ||
      err.message?.includes('Token has been expired') ||
      err.code === 401
    ) {
      const tokenError = new Error('CALENDAR_TOKEN_EXPIRED');
      throw tokenError;
    }
    console.error('getCalendarEvents error:', err.message);
    throw err;
  }
}

/**
 * parseTimeToMinutes(timeStr)
 * Converts 'HH:MM' string to minutes since midnight
 */
function parseTimeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * calculateFreeSlots(events, userProfile, dateStr)
 * Returns array of free slots: [{ start: 'HH:MM', end: 'HH:MM', duration_mins: number }]
 * Max 8 slots returned, minimum 30 minutes each
 */
function calculateFreeSlots(events, userProfile, dateStr) {
  const profile = userProfile.profile || {};
  const wakeTime = profile.wake_time || '07:00';
  const sleepTime = profile.sleep_time || '23:00';

  const wakeMin = parseTimeToMinutes(wakeTime);
  const sleepMin = parseTimeToMinutes(sleepTime);

  // Build blocked ranges in minutes-since-midnight
  const blocked = [];

  // Add calendar events
  for (const event of events) {
    const start = event.start?.dateTime || event.start?.date;
    const end = event.end?.dateTime || event.end?.date;
    if (!start || !end) continue;

    const startDate = new Date(start);
    const endDate = new Date(end);
    const startMin = startDate.getHours() * 60 + startDate.getMinutes();
    const endMin = endDate.getHours() * 60 + endDate.getMinutes();
    blocked.push({ start: startMin, end: endMin });
  }

  // Add fixed blocks from profile matching today's day
  const dayOfWeek = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const fixedBlocks = profile.fixed_blocks || [];
  for (const block of fixedBlocks) {
    const days = (block.days || []).map((d) => d.toLowerCase());
    if (days.includes(dayOfWeek) || days.includes('all')) {
      const startMin = parseTimeToMinutes(block.start || '00:00');
      const endMin = parseTimeToMinutes(block.end || '00:00');
      blocked.push({ start: startMin, end: endMin });
    }
  }

  // Sort blocked ranges by start time
  blocked.sort((a, b) => a.start - b.start);

  // Find free gaps in wake window
  const freeSlots = [];
  let cursor = wakeMin;

  for (const block of blocked) {
    if (block.start > cursor) {
      const gapDuration = block.start - cursor;
      if (gapDuration >= 30) {
        freeSlots.push({
          start: minutesToTime(cursor),
          end: minutesToTime(block.start),
          duration_mins: gapDuration,
        });
      }
    }
    cursor = Math.max(cursor, block.end);
    if (freeSlots.length >= 8) break;
  }

  // Check gap after last blocked event to sleep time
  if (cursor < sleepMin && freeSlots.length < 8) {
    const gapDuration = sleepMin - cursor;
    if (gapDuration >= 30) {
      freeSlots.push({
        start: minutesToTime(cursor),
        end: minutesToTime(sleepMin),
        duration_mins: gapDuration,
      });
    }
  }

  return freeSlots.slice(0, 8);
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

module.exports = { getCalendarEvents, calculateFreeSlots, buildOAuthClient };
