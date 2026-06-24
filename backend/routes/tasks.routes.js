const express = require('express');
const router = express.Router();
const Task = require('../models/Task.model');
const User = require('../models/User.model');
const Habit = require('../models/Habit.model');
const { getCalendarEvents, calculateFreeSlots, buildOAuthClient } = require('../services/calendar.service');
const { google } = require('googleapis');

// GET /api/tasks/today
// Query: user_id
// Returns tasks + real free_slots from Google Calendar
router.get('/today', async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ error: 'user_id query param required' });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const tasks = await Task.find({
      user_id,
      status: 'pending',
      $or: [
        { scheduled_time: { $gte: startOfDay, $lte: endOfDay } },
        { scheduled_time: null },
      ],
    }).sort({ scheduled_time: 1 });

    // Attempt to get free slots from calendar
    let freeSlots = [];
    try {
      const user = await User.findById(user_id);
      if (user) {
        const todayStr = new Date().toISOString().split('T')[0];
        const events = await getCalendarEvents(user, todayStr);
        freeSlots = calculateFreeSlots(events, user, todayStr);
      }
    } catch (calErr) {
      // Calendar not connected or token expired — free_slots stays empty
      console.log('Calendar fetch for today skipped:', calErr.message);
    }

    res.json({ tasks, free_slots: freeSlots });
  } catch (err) {
    console.error('Get today tasks error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/schedule?date=YYYY-MM-DD&user_id=...
// Returns scheduled tasks + free slots for any date
router.get('/schedule', async (req, res) => {
  try {
    const { date, user_id } = req.query;
    if (!user_id || !date) {
      return res.status(400).json({ error: 'user_id and date query params required' });
    }

    const startOfDay = new Date(`${date}T00:00:00+05:30`);
    const endOfDay = new Date(`${date}T23:59:59+05:30`);

    const scheduledTasks = await Task.find({
      user_id,
      scheduled_time: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ scheduled_time: 1 });

    let freeSlots = [];
    try {
      const user = await User.findById(user_id);
      if (user) {
        const events = await getCalendarEvents(user, date);
        freeSlots = calculateFreeSlots(events, user, date);
      }
    } catch (calErr) {
      console.log('Calendar fetch for schedule skipped:', calErr.message);
    }

    res.json({ scheduled_tasks: scheduledTasks, free_slots: freeSlots });
  } catch (err) {
    console.error('Get schedule error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks
// Body: { user_id, title, category, deadline, duration_mins, energy_level, is_recurring, recurrence, scheduled_time }
router.post('/', async (req, res) => {
  try {
    const {
      user_id,
      title,
      category,
      deadline,
      duration_mins,
      energy_level,
      is_recurring,
      recurrence,
      scheduled_time,
    } = req.body;

    const task = new Task({
      user_id,
      title,
      category,
      deadline,
      duration_mins,
      energy_level,
      is_recurring: is_recurring || false,
      recurrence: recurrence || null,
      scheduled_time: scheduled_time || null,
    });

    await task.save();

    // Attempt to write to Google Calendar (non-blocking)
    if (deadline && duration_mins) {
      try {
        const user = await User.findById(user_id);
        if (user && user.google_calendar_token?.access_token) {
          const deadlineDate = new Date(deadline);
          const startDate = new Date(deadlineDate.getTime() - duration_mins * 60 * 1000);

          const oauth2Client = buildOAuthClient(user.google_calendar_token);
          const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

          const calResponse = await calendar.events.insert({
            calendarId: 'primary',
            resource: {
              summary: title,
              start: { dateTime: startDate.toISOString() },
              end: { dateTime: deadlineDate.toISOString() },
            },
          });

          task.calendar_event_id = calResponse.data.id;
          await task.save();
        }
      } catch (calErr) {
        // Calendar write failed — non-blocking, log and continue
        console.error('Calendar write failed (non-blocking):', calErr.message);
      }
    }

    res.status(201).json({ task, ai_priority_score: null });
  } catch (err) {
    console.error('Create task error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tasks/:id/complete
// Body: { completed_at, user_id }
// Real XP + streak logic
router.patch('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { completed_at, user_id } = req.body;

    // 1. Find and update task
    const task = await Task.findByIdAndUpdate(
      id,
      {
        status: 'completed',
        completed_at: completed_at || new Date(),
      },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // 2. Calculate XP
    const xp_earned = task.xp_value || 10;
    const taskUserId = user_id || task.user_id;

    // 3. Update user XP + level
    let updatedUser = null;
    try {
      const user = await User.findById(taskUserId);
      if (user) {
        const newXp = (user.xp || 0) + xp_earned;
        const levelUp = newXp >= 100;
        updatedUser = await User.findByIdAndUpdate(
          taskUserId,
          {
            xp: levelUp ? newXp % 100 : newXp,
            level: levelUp ? (user.level || 1) + 1 : user.level,
          },
          { new: true }
        );
      }
    } catch (xpErr) {
      console.error('XP update error:', xpErr.message);
    }

    // 4. Upsert Habit streak for this task's category
    let habitUpdate = null;
    if (task.category) {
      try {
        let habit = await Habit.findOne({ user_id: taskUserId, task_category: task.category });
        if (!habit) {
          habit = new Habit({ user_id: taskUserId, task_category: task.category });
        }

        // Check streak logic
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (habit.last_completed) {
          const lastDate = new Date(habit.last_completed);
          lastDate.setHours(0, 0, 0, 0);

          const lastTime = lastDate.getTime();
          const todayTime = today.getTime();
          const yesterdayTime = yesterday.getTime();

          if (lastTime === yesterdayTime) {
            // Completed yesterday → extend streak
            habit.current_streak = (habit.current_streak || 0) + 1;
          } else if (lastTime === todayTime) {
            // Already completed today → no streak change
          } else {
            // Streak broken → reset to 1
            habit.current_streak = 1;
          }
        } else {
          habit.current_streak = 1;
        }

        // Update longest streak
        if (habit.current_streak > (habit.longest_streak || 0)) {
          habit.longest_streak = habit.current_streak;
        }

        // Increment this_week_count and set last_completed
        habit.this_week_count = (habit.this_week_count || 0) + 1;
        habit.last_completed = new Date();

        await habit.save();

        habitUpdate = {
          category: task.category,
          current_streak: habit.current_streak,
          this_week_count: habit.this_week_count,
        };
      } catch (habitErr) {
        console.error('Habit update error:', habitErr.message);
      }
    }

    res.json({
      xp_earned,
      new_xp: updatedUser?.xp ?? null,
      new_level: updatedUser?.level ?? null,
      streak_update: habitUpdate,
    });
  } catch (err) {
    console.error('Complete task error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tasks/:id/skip
// Body: { reason }
router.patch('/:id/skip', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const task = await Task.findByIdAndUpdate(
      id,
      {
        status: 'skipped',
        skip_reason: reason || null,
      },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ reschedule_suggestion: null });
  } catch (err) {
    console.error('Skip task error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findByIdAndDelete(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete task error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
