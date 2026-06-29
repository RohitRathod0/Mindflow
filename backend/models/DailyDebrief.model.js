const mongoose = require('mongoose');

const DailyDebriefSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  completed_tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  missed_tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  xp_earned: { type: Number, default: 0 },
  gemini_tip: { type: String, default: '' },
  productivity_score: { type: Number, default: 0 }
});

module.exports = mongoose.model('DailyDebrief', DailyDebriefSchema);
