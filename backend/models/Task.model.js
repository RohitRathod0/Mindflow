const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ['study', 'gym', 'work', 'personal'],
  },
  deadline: {
    type: Date,
  },
  duration_mins: {
    type: Number,
  },
  energy_level: {
    type: String,
    enum: ['high', 'medium', 'low'],
  },
  is_recurring: {
    type: Boolean,
    default: false,
  },
  recurrence: {
    type: String,
    enum: ['daily', 'weekly', null],
    default: null,
  },
  scheduled_time: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'skipped', 'rescheduled'],
    default: 'pending',
  },
  skip_reason: {
    type: String,
    enum: ['emergency', 'choice', 'forgot', null],
    default: null,
  },
  ai_priority_score: {
    type: Number,
    default: null,
  },
  calendar_event_id: {
    type: String,
    default: null,
  },
  xp_value: {
    type: Number,
    default: 10,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  completed_at: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model('Task', taskSchema);
