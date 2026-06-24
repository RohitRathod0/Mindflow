const express = require('express');
const router = express.Router();
const Habit = require('../models/Habit.model');

// GET /api/habits?user_id=...
// Returns all habit docs for a user
router.get('/', async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ error: 'user_id query param required' });
    }

    const habits = await Habit.find({ user_id });
    res.json({ habits });
  } catch (err) {
    console.error('Get habits error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
