const express = require('express');
const router = express.Router();
const Task = require('../models/Task.model');

// GET /api/tasks/today
// Query: user_id
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

    // Return pending tasks for today (scheduled_time within today, or null scheduled_time tasks)
    const tasks = await Task.find({
      user_id,
      status: 'pending',
      $or: [
        { scheduled_time: { $gte: startOfDay, $lte: endOfDay } },
        { scheduled_time: null },
      ],
    }).sort({ scheduled_time: 1 });

    res.json({ tasks, free_slots: [] });
  } catch (err) {
    console.error('Get today tasks error:', err.message);
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

    res.status(201).json({ task, ai_priority_score: null });
  } catch (err) {
    console.error('Create task error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tasks/:id/complete
// Body: { completed_at }
router.patch('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { completed_at } = req.body;

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

    res.json({ xp_earned: task.xp_value, streak_update: null });
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
