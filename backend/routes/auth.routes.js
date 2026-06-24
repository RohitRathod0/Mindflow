const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const User = require('../models/User.model');

// GET /api/auth/google-calendar
// Query: user_id
// Returns OAuth URL for Google Calendar authorization
router.get('/google-calendar', async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ error: 'user_id query param required' });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CALENDAR_CLIENT_ID,
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      process.env.BACKEND_URL + '/api/auth/google-callback'
    );

    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: user_id,
      prompt: 'consent',
    });

    res.json({ oauth_url: authUrl });
  } catch (err) {
    console.error('Google Calendar auth error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/google-callback
// Body: { code, state } — state = user_id
// Exchanges OAuth code for tokens and saves to User doc
router.post('/google-callback', async (req, res) => {
  try {
    const { code, state } = req.body;
    const user_id = state;

    if (!code || !user_id) {
      return res.status(400).json({ error: 'code and state (user_id) required' });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CALENDAR_CLIENT_ID,
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      process.env.BACKEND_URL + '/api/auth/google-callback'
    );

    const { tokens } = await oauth2Client.getToken(code);

    await User.findByIdAndUpdate(user_id, {
      'google_calendar_token.access_token': tokens.access_token,
      'google_calendar_token.refresh_token': tokens.refresh_token,
      'google_calendar_token.expiry': tokens.expiry_date,
    });

    res.json({ calendar_token: 'connected' });
  } catch (err) {
    console.error('Google callback error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
