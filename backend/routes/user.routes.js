const express = require('express');
const router = express.Router();
const User = require('../models/User.model');

// POST /api/user/onboarding
// Body: { firebase_uid, name, email, persona, priority_weights, fixed_blocks,
//         wake_time, sleep_time, productive_hours, coaching_style, language }
router.post('/onboarding', async (req, res) => {
  try {
    const {
      firebase_uid,
      name,
      email,
      persona,
      priority_weights,
      fixed_blocks,
      wake_time,
      sleep_time,
      productive_hours,
      coaching_style,
      language,
      age_group,
    } = req.body;

    const user = new User({
      firebase_uid,
      name,
      email,
      persona,
      profile: {
        age_group,
        priority_weights: priority_weights || {},
        fixed_blocks: fixed_blocks || [],
        wake_time,
        sleep_time,
        productive_hours,
        coaching_style,
        language: language || 'en',
      },
    });

    await user.save();

    res.status(201).json({ user_profile: user });
  } catch (err) {
    console.error('Onboarding error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/user/profile
// Header: Authorization: Bearer <firebase_uid>
router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const firebase_uid = authHeader.replace('Bearer ', '').trim();

    if (!firebase_uid) {
      return res.status(400).json({ error: 'firebase_uid required in Authorization header' });
    }

    const user = await User.findOne({ firebase_uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user_profile: user });
  } catch (err) {
    console.error('Profile fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
