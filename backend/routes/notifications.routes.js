const express = require('express');
const router = express.Router();
const User = require('../models/User.model');
const { sendNotification } = require('../services/notification.service');

// POST /api/notifications/subscribe
// Body: { push_subscription_object, user_id }
router.post('/subscribe', async (req, res) => {
  try {
    const { push_subscription_object, user_id } = req.body;
    if (!user_id || !push_subscription_object) {
      return res.status(400).json({ error: 'push_subscription_object and user_id required' });
    }

    await User.findByIdAndUpdate(user_id, {
      push_subscription: push_subscription_object,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Subscribe error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/send
// Body: { user_id, title, body, action_buttons: [] }
router.post('/send', async (req, res) => {
  try {
    const { user_id, title, body, action_buttons } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.push_subscription) {
      return res.json({ sent: false, reason: 'no_subscription' });
    }

    await sendNotification(user.push_subscription, title || 'FlowMind AI', body || 'You have a task update', {
      action_buttons: action_buttons || [],
    });

    res.json({ sent: true });
  } catch (err) {
    console.error('Send notification error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/respond
// Body: { notification_id, action: 'done'|'snooze'|'skip', user_id, task_id }
router.patch('/respond', async (req, res) => {
  try {
    const { notification_id, action, user_id, task_id } = req.body;

    if (action === 'done' && task_id) {
      // Import and call complete logic directly
      const Task = require('../models/Task.model');
      const Habit = require('../models/Habit.model');
      const User = require('../models/User.model');

      const task = await Task.findByIdAndUpdate(
        task_id,
        { status: 'completed', completed_at: new Date() },
        { new: true }
      );

      if (task) {
        const xp_earned = task.xp_value || 10;
        const user = await User.findById(user_id || task.user_id);
        if (user) {
          const newXp = (user.xp || 0) + xp_earned;
          const levelUp = newXp >= 100;
          await User.findByIdAndUpdate(user._id, {
            xp: levelUp ? newXp % 100 : newXp,
            level: levelUp ? (user.level || 1) + 1 : user.level,
          });
        }
      }

      return res.json({ task_updated: true });
    }

    if (action === 'skip' && task_id) {
      const Task = require('../models/Task.model');
      await Task.findByIdAndUpdate(task_id, { status: 'skipped', skip_reason: 'choice' });
      return res.json({ task_updated: true, action: 'skipped' });
    }

    if (action === 'snooze' && task_id) {
      const Task = require('../models/Task.model');
      // Snooze = set scheduled_time to 30 mins from now
      const snoozedTo = new Date(Date.now() + 30 * 60 * 1000);
      await Task.findByIdAndUpdate(task_id, { scheduled_time: snoozedTo });
      return res.json({ task_updated: true, action: 'snoozed', snoozed_to: snoozedTo });
    }

    res.json({ task_updated: false });
  } catch (err) {
    console.error('Notification respond error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
