const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firebase_uid: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  persona: {
    type: String,
    enum: ['student', 'gym', 'professional', 'mixed'],
  },
  profile: {
    age_group: { type: String },
    priority_weights: {
      academics: { type: Number, default: 0 },
      health:    { type: Number, default: 0 },
      career:    { type: Number, default: 0 },
      social:    { type: Number, default: 0 },
    },
    fixed_blocks: [
      {
        name:  { type: String },
        days:  { type: [String] },
        start: { type: String },
        end:   { type: String },
      },
    ],
    wake_time:        { type: String },
    sleep_time:       { type: String },
    productive_hours: { type: String },
    coaching_style:   { type: String },
    language: {
      type: String,
      default: 'en',
    },
    google_calendar_token: {
      access_token:  { type: String, default: null },
      refresh_token: { type: String, default: null },
      expiry:        { type: String, default: null },
    },
  },
  xp:         { type: Number, default: 0 },
  level:      { type: Number, default: 1 },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);
