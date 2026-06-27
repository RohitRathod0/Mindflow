const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  session_id: { type: String, required: true }, // new session each day: userId_YYYY-MM-DD
  messages: [{
    role: { type: String, enum: ['user', 'agent'], required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    intent: { type: String, default: null },
    actions_taken: { type: Array, default: [] }
  }],
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Conversation', ConversationSchema);
