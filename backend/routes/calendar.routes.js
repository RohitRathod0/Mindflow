const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const User = require('../models/User.model');
const Task = require('../models/Task.model');
const { getCalendarEvents, calculateFreeSlots, buildOAuthClient } = require('../services/calendar.service');

// GET /api/calendar/events?date=YYYY-MM-DD&user_id=...
router.get('/events', async (req, res) => {
  try {
    const { date, user_id } = req.query;
    if (!user_id || !date) {
      return res.status(400).json({ error: 'user_id and date query params required' });
    }

    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let events = [];
    let freeSlots = [];

    try {
      events = await getCalendarEvents(user, date);
      freeSlots = calculateFreeSlots(events, user, date);
    } catch (err) {
      if (err.message === 'CALENDAR_TOKEN_EXPIRED') {
        return res.json({ events: [], free_slots: [], reconnect_required: true });
      }
      throw err;
    }

    res.json({ events, free_slots: freeSlots });
  } catch (err) {
    console.error('Get calendar events error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/calendar/block
// Body: { title, start, end, task_id, user_id }
router.post('/block', async (req, res) => {
  try {
    const { title, start, end, task_id, user_id } = req.body;
    if (!user_id || !title || !start || !end) {
      return res.status(400).json({ error: 'user_id, title, start, end required' });
    }

    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.google_calendar_token?.access_token) {
      return res.status(400).json({ error: 'Calendar not connected' });
    }

    const oauth2Client = buildOAuthClient(user.google_calendar_token);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: {
        summary: title,
        start: { dateTime: start },
        end: { dateTime: end },
      },
    });

    const eventId = response.data.id;

    // Save calendar_event_id to Task doc if task_id provided
    if (task_id) {
      await Task.findByIdAndUpdate(task_id, { calendar_event_id: eventId });
    }

    res.json({ calendar_event_id: eventId });
  } catch (err) {
    console.error('Calendar block create error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/calendar/block/:event_id
// Query: user_id
router.delete('/block/:event_id', async (req, res) => {
  try {
    const { event_id } = req.params;
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id query param required' });

    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.google_calendar_token?.access_token) {
      return res.status(400).json({ error: 'Calendar not connected' });
    }

    const oauth2Client = buildOAuthClient(user.google_calendar_token);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: event_id,
    });

    // Clear calendar_event_id on any Task with this event
    await Task.updateMany({ calendar_event_id: event_id }, { calendar_event_id: null });

    res.json({ success: true });
  } catch (err) {
    console.error('Calendar block delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/calendar/block/:event_id
// Body: { new_start, new_end, user_id }
router.patch('/block/:event_id', async (req, res) => {
  try {
    const { event_id } = req.params;
    const { new_start, new_end, user_id } = req.body;
    if (!user_id || !new_start || !new_end) {
      return res.status(400).json({ error: 'user_id, new_start, new_end required' });
    }

    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.google_calendar_token?.access_token) {
      return res.status(400).json({ error: 'Calendar not connected' });
    }

    const oauth2Client = buildOAuthClient(user.google_calendar_token);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const response = await calendar.events.patch({
      calendarId: 'primary',
      eventId: event_id,
      resource: {
        start: { dateTime: new_start },
        end: { dateTime: new_end },
      },
    });

    res.json({ updated_event: response.data });
  } catch (err) {
    console.error('Calendar block update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
