const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  task_category: {
    type: String,
    required: true,
  },
  goal_frequency: {
    type: Number,
    default: 5,
  },
  current_streak: {
    type: Number,
    default: 0,
  },
  longest_streak: {
    type: Number,
    default: 0,
  },
  this_week_count: {
    type: Number,
    default: 0,
  },
  emergency_skips_used: {
    type: Number,
    default: 0,
  },
  last_completed: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model('Habit', habitSchema);
