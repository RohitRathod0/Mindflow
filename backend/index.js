require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    process.env.FRONTEND_URL
  ],
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'FlowMind AI' });
});

// Routes
app.use('/api/user', require('./routes/user.routes'));
app.use('/api/tasks', require('./routes/tasks.routes'));
app.use('/api/agent', require('./routes/agent.routes'));
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/calendar', require('./routes/calendar.routes'));
app.use('/api/notifications', require('./routes/notifications.routes'));
app.use('/api/habits', require('./routes/habits.routes'));

// MongoDB connection
const { initScheduler } = require('./services/scheduler.service');

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    initScheduler();
    console.log('Scheduler initialized');
    app.listen(PORT, () => {
      console.log(`FlowMind AI backend running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
