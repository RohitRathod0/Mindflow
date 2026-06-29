const cron = require('node-cron');
const User = require('../models/User.model');
const Task = require('../models/Task.model');
const { callGemini } = require('./gemini.service');
const { sendNotification } = require('./notification.service');
const DailyDebrief = require('../models/DailyDebrief.model');
const webpush = require('web-push');

// Configure webpush VAPID for direct use in crons (also configured in notification.service.js)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:test@flowmind.ai',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

/**
 * initScheduler()
 * Registers 3 cron jobs for FlowMind AI push notifications.
 * Call once after mongoose connects.
 */
function initScheduler() {
  // --- CRON 1: Morning Planning — every day at 7:00 AM ---
  cron.schedule('0 7 * * *', async () => {
    console.log('[Scheduler] Morning cron fired');
    try {
      const users = await User.find({ push_subscription: { $ne: null } });
      for (const user of users) {
        try {
          const tasks = await Task.find({ user_id: user._id, status: 'pending' }).limit(5);
          if (!tasks.length) continue;

          const prompt = `You are FlowMind AI. Generate a short morning planning message (max 2 sentences) for a ${user.persona} with coaching style ${user.profile.coaching_style}. Today's top tasks: ${tasks.map(t => t.title).join(', ')}. Language: ${user.profile.language}. Return ONLY the message string, no JSON.`;
          const message = await callGemini(prompt, false);
          await sendNotification(user.push_subscription, 'Good Morning! 🌅', message);
        } catch (err) {
          console.error(`[Scheduler] Morning cron error for user ${user._id}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[Scheduler] Morning cron global error:', err.message);
    }
  });

  // --- CRON 2: Evening Check-in — every day at 9:00 PM ---
  cron.schedule('0 21 * * *', async () => {
    console.log('[Scheduler] Evening cron fired');
    try {
      const users = await User.find({ push_subscription: { $ne: null } });
      for (const user of users) {
        try {
          const pending = await Task.countDocuments({ user_id: user._id, status: 'pending' });
          const completed = await Task.countDocuments({ user_id: user._id, status: 'completed' });

          const prompt = `You are FlowMind AI. Generate a short evening check-in message (max 2 sentences) for a ${user.persona} with coaching style ${user.profile.coaching_style}. Completed: ${completed} tasks, Pending: ${pending} tasks. Language: ${user.profile.language}. Return ONLY the message string, no JSON.`;
          const message = await callGemini(prompt, false);
          await sendNotification(user.push_subscription, 'Evening Check-in 🌙', message);
        } catch (err) {
          console.error(`[Scheduler] Evening cron error for user ${user._id}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[Scheduler] Evening cron global error:', err.message);
    }
  });

  // --- CRON 3: Deadline Warnings — every hour, tasks due in 2 hours ---
  cron.schedule('0 * * * *', async () => {
    console.log('[Scheduler] Deadline warning cron fired');
    try {
      const now = new Date();
      const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      const tasks = await Task.find({
        status: 'pending',
        deadline: { $gte: now, $lte: twoHoursLater },
      }).populate('user_id');

      for (const task of tasks) {
        try {
          const user = task.user_id;
          if (!user?.push_subscription) continue;

          const prompt = `You are FlowMind AI. Generate a short deadline warning (1 sentence) for a ${user.persona} about task '${task.title}' due in 2 hours. Coaching style: ${user.profile.coaching_style}. Language: ${user.profile.language}. Return ONLY the sentence, no JSON.`;
          const message = await callGemini(prompt, false);
          await sendNotification(user.push_subscription, `⏰ 2hr Warning: ${task.title}`, message);
        } catch (err) {
          console.error(`[Scheduler] Deadline cron error for task ${task._id}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[Scheduler] Deadline cron global error:', err.message);
    }
  });

  console.log('[Scheduler] All 3 cron jobs registered (7AM morning, 9PM evening, hourly deadline)');

  // --- CRON 4: Debrief Generation — every day at 10:00 PM ---
  cron.schedule('0 22 * * *', async () => {
    console.log('[Scheduler] Debrief cron fired');
    const users = await User.find({ push_subscription: { $ne: null } });
    const today = new Date().toISOString().split('T')[0];
    for (const user of users) {
      try {
        const dayStart = new Date(today + 'T00:00:00.000Z');
        const dayEnd = new Date(today + 'T23:59:59.999Z');
        const completed = await Task.find({ user_id: user._id, status: 'completed', completed_at: { $gte: dayStart, $lte: dayEnd } });
        const missed = await Task.find({ user_id: user._id, status: { $in: ['skipped', 'pending'] }, deadline: { $gte: dayStart, $lte: dayEnd } });
        const xpEarned = completed.reduce((sum, t) => sum + (t.xp_value || 0), 0);
        const { buildDebriefPrompt } = require('../prompts/debrief.prompt');
        const userProfile = { name: user.name, persona: user.persona || 'student', profile: user.profile || {} };
        const prompt = buildDebriefPrompt(completed, missed, userProfile, xpEarned);
        const result = await callGemini(prompt, true);
        await DailyDebrief.findOneAndUpdate(
          { user_id: user._id, date: dayStart },
          {
            completed_tasks: completed.map(t => t._id),
            missed_tasks: missed.map(t => t._id),
            xp_earned: xpEarned,
            gemini_tip: result.gemini_tip || '',
            productivity_score: result.productivity_score || 0
          },
          { upsert: true }
        );
        await sendNotification(user.push_subscription, '📊 Daily Debrief Ready', result.motivational_line || 'Your debrief is ready!');
      } catch (e) {
        console.error('Debrief cron error for user', user._id, e.message);
      }
    }
  });

  // --- CRON 5: Night Check-in — every day at 9:30 PM ---
  cron.schedule('30 21 * * *', async () => {
    console.log('[Scheduler] Night check-in cron fired');
    const users = await User.find({ push_subscription: { $ne: null } });
    for (const user of users) {
      const pending = await Task.find({ user_id: user._id, status: 'pending' }).sort({ ai_priority_score: -1 }).limit(1);
      if (!pending.length) continue;
      const topTask = pending[0];
      // Send notification with action buttons payload
      const payload = JSON.stringify({
        title: '⏰ Night Check-in',
        body: `Still pending: ${topTask.title}. Quick action?`,
        data: {
          task_id: topTask._id.toString(),
          user_id: user._id.toString(),
          actions: ['done', 'skip']
        }
      });
      try {
        await webpush.sendNotification(user.push_subscription, payload);
      } catch (e) {
        console.error('Night check-in push error:', e.message);
      }
    }
  });

  console.log('[Scheduler] All 5 cron jobs registered (7AM morning, 9PM evening, hourly deadline, 10PM debrief, 9:30PM night check-in)');
}

module.exports = { initScheduler };
