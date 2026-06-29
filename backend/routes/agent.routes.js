const express = require('express');
const router = express.Router();
const Task = require('../models/Task.model');
const User = require('../models/User.model');
const { callGemini } = require('../services/gemini.service');
const { buildPrioritizePrompt } = require('../prompts/prioritize.prompt');
const { buildReschedulePrompt } = require('../prompts/reschedule.prompt');
const { buildOverloadPrompt } = require('../prompts/overload.prompt');
const { getCalendarEvents, calculateFreeSlots } = require('../services/calendar.service');
const Conversation = require('../models/Conversation.model');
const { buildChatPrompt } = require('../prompts/chat.prompt');
const DailyDebrief = require('../models/DailyDebrief.model');
const { buildDebriefPrompt } = require('../prompts/debrief.prompt');

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

// POST /api/agent/chat
router.post('/chat', async (req, res) => {
  try {
    const { message, conversation_history = [], voice_mode, user_id } = req.body;
    if (!user_id || !message) {
      return res.status(400).json({ error: 'user_id and message are required' });
    }

    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const todaySchedule = await Task.find({ user_id, status: 'pending' });

    const userProfile = {
      name: user.name,
      persona: user.persona || 'student',
      profile: user.profile || {},
    };

    const prompt = buildChatPrompt(message, userProfile, todaySchedule, conversation_history);
    const result = await callGemini(prompt, true); // jsonMode true

    let actions_executed = [];

    if (result.intent === 'SKIP_TASK' && result.task_affected) {
      // Find the task by title match (case-insensitive)
      const taskToSkip = await Task.findOne({
        user_id: user._id,
        title: { $regex: result.task_affected, $options: 'i' },
        status: 'pending'
      });
      if (taskToSkip) {
        taskToSkip.status = 'skipped';
        taskToSkip.skip_reason = result.intent === 'EMERGENCY' ? 'emergency' : 'choice';
        await taskToSkip.save();
        actions_executed.push(`Skipped task: ${taskToSkip.title}`);
        // Set flag for frontend to call /api/agent/reschedule
        result.calendar_update_needed = true;
      }
    }

    if (result.intent === 'COMPLETE_TASK' && result.task_affected) {
      const taskToComplete = await Task.findOne({
        user_id: user._id,
        title: { $regex: result.task_affected, $options: 'i' },
        status: 'pending'
      });
      if (taskToComplete) {
        taskToComplete.status = 'completed';
        taskToComplete.completed_at = new Date();
        await taskToComplete.save();
        // XP update — same logic as PATCH /tasks/:id/complete
        await User.findByIdAndUpdate(user._id, { $inc: { xp: taskToComplete.xp_value } });
        actions_executed.push(`Completed task: ${taskToComplete.title} (+${taskToComplete.xp_value} XP)`);
      }
    }

    if (result.intent === 'ADD_TASK' && result.task_affected) {
      // Gemini should have included task details in action_taken
      // Parse a basic task from action_taken string — create with defaults
      const newTask = new Task({
        user_id: user._id,
        title: result.task_affected,
        category: 'personal',
        status: 'pending',
        xp_value: 10
      });
      await newTask.save();
      actions_executed.push(`Added task: ${newTask.title}`);
    }

    if (result.intent === 'QUERY_SCHEDULE') {
      // No DB change — Gemini already responded with schedule in reply
      actions_executed.push('Schedule query answered');
    }

    // Override action_taken with what was actually executed
    result.action_taken = actions_executed.join(', ') || result.action_taken;

    const todayStr = new Date().toISOString().split('T')[0];
    const session_id = `${user_id}_${todayStr}`;
    
    let conversation = await Conversation.findOne({ user_id, session_id });
    if (!conversation) {
      conversation = new Conversation({ user_id, session_id, messages: [] });
    }

    conversation.messages.push({ role: 'user', text: message, intent: null });
    conversation.messages.push({
      role: 'agent',
      text: result.reply,
      intent: result.intent,
      actions_taken: result.action_taken && result.action_taken !== 'null' ? [result.action_taken] : []
    });

    await conversation.save();

    res.json({
      reply: result.reply,
      intent: result.intent,
      task_affected: result.task_affected,
      action_taken: result.action_taken,
      calendar_update_needed: result.calendar_update_needed,
      tts_text: result.tts_text
    });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/conversation
// Query: user_id, date (YYYY-MM-DD)
router.get('/conversation', async (req, res) => {
  try {
    const { user_id, date } = req.query;
    if (!user_id || !date) {
      return res.status(400).json({ error: 'user_id and date are required' });
    }

    const session_id = `${user_id}_${date}`;
    const conversation = await Conversation.findOne({ user_id, session_id });
    
    if (!conversation) {
      return res.json({ messages: [] });
    }

    res.json({ messages: conversation.messages });
  } catch (err) {
    console.error('Conversation fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/fast-help
router.post('/fast-help', async (req, res) => {
  try {
    const { persona, context, deadline_hours_left, user_id } = req.body;
    
    if (!user_id || !context) {
      return res.status(400).json({ error: 'user_id and context are required' });
    }

    let prompt;
    if (persona === 'student') {
      prompt = `You are a helpful academic tutor. The student needs help with: "${context}". Deadline in ${deadline_hours_left} hours. Give a clear, structured explanation or study plan. Max 150 words. Plain text, no markdown headers.`;
    } else if (persona === 'gym' || persona === 'fitness') {
      prompt = `You are an energetic fitness coach. Generate a motivational workout cue list for: "${context}". Include 4-5 specific actionable cues. Keep it punchy and energetic. Max 100 words. Plain text.`;
    } else if (persona === 'professional') {
      prompt = `You are a professional writing assistant. Draft a concise email or task breakdown for: "${context}". Professional tone, max 120 words. Plain text, no markdown.`;
    } else {
      prompt = `You are FlowMind AI. Help the user with: "${context}". Max 150 words. Plain text.`;
    }

    // Call Gemini in text mode (jsonMode false)
    const helpText = await callGemini(prompt, false);

    // Determine type
    const typeMap = { student: 'qa', gym: 'workout', fitness: 'workout', professional: 'email' };
    const type = typeMap[persona] || 'qa';

    return res.json({ help_content: helpText, type });
  } catch (err) {
    console.error('Fast help error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/debrief
// Body: { date, user_id }
router.post('/debrief', async (req, res) => {
  try {
    const { date, user_id } = req.body;
    if (!date || !user_id) {
      return res.status(400).json({ error: 'date and user_id are required' });
    }

    const dayStart = new Date(date + 'T00:00:00.000Z');
    const dayEnd = new Date(date + 'T23:59:59.999Z');

    const completedTasks = await Task.find({
      user_id,
      status: 'completed',
      completed_at: { $gte: dayStart, $lte: dayEnd }
    });

    const missedTasks = await Task.find({
      user_id,
      status: { $in: ['skipped', 'pending'] },
      deadline: { $gte: dayStart, $lte: dayEnd }
    });

    const xpEarned = completedTasks.reduce((sum, t) => sum + (t.xp_value || 0), 0);

    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const userProfile = {
      name: user.name,
      persona: user.persona || 'student',
      profile: user.profile || {}
    };

    const prompt = buildDebriefPrompt(completedTasks, missedTasks, userProfile, xpEarned);
    const result = await callGemini(prompt, true);

    const { productivity_score, gemini_tip, motivational_line } = result;

    await DailyDebrief.findOneAndUpdate(
      { user_id, date: dayStart },
      {
        completed_tasks: completedTasks.map(t => t._id),
        missed_tasks: missedTasks.map(t => t._id),
        xp_earned: xpEarned,
        gemini_tip: gemini_tip || '',
        productivity_score: productivity_score || 0
      },
      { upsert: true, new: true }
    );

    res.json({
      completed: completedTasks,
      missed: missedTasks,
      tip: gemini_tip,
      motivational_line,
      xp_summary: { xp_earned: xpEarned, productivity_score: productivity_score || 0 }
    });
  } catch (err) {
    console.error('Debrief error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
