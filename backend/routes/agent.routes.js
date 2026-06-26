const express = require('express');
const router = express.Router();
const Task = require('../models/Task.model');
const User = require('../models/User.model');
const { callGemini } = require('../services/gemini.service');
const { buildPrioritizePrompt } = require('../prompts/prioritize.prompt');
const { buildReschedulePrompt } = require('../prompts/reschedule.prompt');
const { buildOverloadPrompt } = require('../prompts/overload.prompt');
const { getCalendarEvents, calculateFreeSlots } = require('../services/calendar.service');

// POST /api/agent/prioritize
// Body: { tasks[], user_profile }
router.post('/prioritize', async (req, res) => {
  try {
    const { tasks, user_profile } = req.body;

    if (!tasks || tasks.length === 0) {
      return res.json({ tasks_with_priority_scores: [] });
    }

    const prompt = buildPrioritizePrompt(tasks, user_profile);
    const scoredResults = await callGemini(prompt, true);

    // scoredResults: [{ task_id, priority_score, reason }]
    const scoreMap = {};
    if (Array.isArray(scoredResults)) {
      scoredResults.forEach((item) => {
        scoreMap[item.task_id] = {
          score: item.priority_score,
          reason: item.reason,
        };
      });
    }

    // Update ai_priority_score in DB for each task
    const updatePromises = tasks.map(async (task) => {
      const taskId = task._id || task.id;
      const scoreData = scoreMap[taskId];
      if (scoreData !== undefined) {
        await Task.findByIdAndUpdate(taskId, {
          ai_priority_score: scoreData.score,
        });
      }
      return {
        ...task,
        ai_priority_score: scoreData?.score ?? null,
        priority_reason: scoreData?.reason ?? null,
      };
    });

    const tasksWithScores = await Promise.all(updatePromises);

    res.json({ tasks_with_priority_scores: tasksWithScores });
  } catch (err) {
    console.error('Prioritize error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/reschedule
// Body: { task_id, reason: 'emergency'|'choice'|'forgot', user_id }
// Returns a suggestion only — does NOT update DB (user must confirm)
router.post('/reschedule', async (req, res) => {
  try {
    const { task_id, reason, user_id } = req.body;

    if (!task_id || !user_id) {
      return res.status(400).json({ error: 'task_id and user_id are required' });
    }

    const task = await Task.findById(task_id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Build today / tomorrow date strings (YYYY-MM-DD)
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

    // Fetch free slots for both days (gracefully handle no calendar)
    let freeSlotsToday = [];
    let freeSlotsTomorrow = [];
    try {
      freeSlotsToday = calculateFreeSlots(await getCalendarEvents(user, todayStr), user, todayStr);
      freeSlotsTomorrow = calculateFreeSlots(await getCalendarEvents(user, tomorrowStr), user, tomorrowStr);
    } catch (calErr) {
      console.warn('Calendar fetch skipped in reschedule:', calErr.message);
    }

    const userProfile = {
      persona: user.persona || 'student',
      profile: user.profile || {},
    };

    const prompt = buildReschedulePrompt(task, reason, freeSlotsToday, freeSlotsTomorrow, userProfile);
    const result = await callGemini(prompt, true);

    const { best_slot, slot_start, slot_date, reason: slotReason, streak_impact, user_message } = result;

    res.json({
      suggestion: { best_slot, slot_start, slot_date, reason: slotReason, streak_impact, user_message },
      task_id,
    });
  } catch (err) {
    console.error('Reschedule error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/overload-check
// Body: { user_id }
// Returns { overloaded: false } or { overloaded: true, must_do, can_defer, damage_control_msg, sprint_mode }
router.post('/overload-check', async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const todayStr = new Date().toISOString().split('T')[0];

    // Get free slots for today
    let freeSlotsToday = [];
    try {
      freeSlotsToday = calculateFreeSlots(await getCalendarEvents(user, todayStr), user, todayStr);
    } catch (calErr) {
      console.warn('Calendar fetch skipped in overload-check:', calErr.message);
    }

    // Fetch all pending tasks for user today
    const pendingTasks = await Task.find({ user_id, status: 'pending' });

    const totalFreeTime = freeSlotsToday.reduce((sum, s) => sum + s.duration_mins, 0);
    const totalTaskTime = pendingTasks.reduce((sum, t) => sum + (t.duration_mins || 0), 0);

    if (totalFreeTime >= totalTaskTime) {
      return res.json({ overloaded: false });
    }

    const userProfile = {
      persona: user.persona || 'student',
      profile: user.profile || {},
    };

    const prompt = buildOverloadPrompt(pendingTasks, freeSlotsToday, userProfile);
    const result = await callGemini(prompt, true);

    const { must_do, can_defer, damage_control_msg, sprint_mode } = result;

    res.json({ overloaded: true, must_do, can_defer, damage_control_msg, sprint_mode });
  } catch (err) {
    console.error('Overload check error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
