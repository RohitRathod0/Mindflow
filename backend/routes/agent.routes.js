const express = require('express');
const router = express.Router();
const Task = require('../models/Task.model');
const { callGemini } = require('../services/gemini.service');
const { buildPrioritizePrompt } = require('../prompts/prioritize.prompt');

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

module.exports = router;
