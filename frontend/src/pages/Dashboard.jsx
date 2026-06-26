import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { registerPush } from '../utils/pushNotifications';

const CATEGORY_STYLES = {
  study:    { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40', dot: 'bg-blue-400', label: 'Study' },
  gym:      { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/40', dot: 'bg-green-400', label: 'Gym' },
  work:     { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/40', dot: 'bg-purple-400', label: 'Work' },
  personal: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40', dot: 'bg-yellow-400', label: 'Personal' },
};

const PRIORITY_BADGE = (score) => {
  if (score === null || score === undefined) return null;
  if (score >= 80) return { label: 'URGENT', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40' };
  if (score >= 50) return { label: 'HIGH', bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/40' };
  if (score >= 20) return { label: 'MEDIUM', bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40' };
  return { label: 'LOW', bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/40' };
};

const formatScheduledTime = (dt) => {
  if (!dt) return null;
  const d = new Date(dt);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getTodayLabel = () => {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
};

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [error, setError] = useState('');
  const [freeSlots, setFreeSlots] = useState([]);
  const [calendarConnected, setCalendarConnected] = useState(
    !!localStorage.getItem('calendar_connected')
  );

  // --- Day 3: Skip flow state ---
  const [skippingTaskId, setSkippingTaskId] = useState(null);
  const [rescheduleModal, setRescheduleModal] = useState(null); // { task, suggestion } | null

  // --- Day 3: Overload state ---
  const [overloadData, setOverloadData] = useState(null); // { must_do[], can_defer[], damage_control_msg, sprint_mode } | null

  // --- Day 3: Remove goal prompt state ---
  const [removeGoalPrompt, setRemoveGoalPrompt] = useState(false);
  const [removeGoalCategory, setRemoveGoalCategory] = useState('');
  const [removeGoalTaskIds, setRemoveGoalTaskIds] = useState([]);

  const userId = localStorage.getItem('user_id');
  const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
  const userName = userProfile?.name || 'User';

  // Load XP from localStorage (updated on complete)
  useEffect(() => {
    const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
    setXp(profile?.xp ?? 0);
    setLevel(profile?.level ?? 1);
  }, []);

  // Register push notifications once (silent — no test button)
  useEffect(() => {
    if (!localStorage.getItem('push_registered') && userId) {
      registerPush(userId)
        .then(() => localStorage.setItem('push_registered', 'true'))
        .catch((err) => console.warn('Push registration failed:', err.message));
    }
  }, [userId]);

  const fetchAndScore = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get('/api/tasks/today', { params: { user_id: userId } });
      let taskList = data.tasks || [];
      setTasks(taskList);

      // Handle free slots
      if (data.free_slots && Array.isArray(data.free_slots)) {
        setFreeSlots(data.free_slots);
      }

      // Handle calendar reconnect required
      if (data.reconnect_required) {
        localStorage.removeItem('calendar_connected');
        setCalendarConnected(false);
      }

      setLoading(false);

      if (taskList.length > 0) {
        setScoring(true);
        try {
          const { data: scored } = await axios.post('/api/agent/prioritize', {
            tasks: taskList,
            user_profile: userProfile,
          });
          const withScores = scored.tasks_with_priority_scores || [];
          const merged = taskList.map((t) => {
            const match = withScores.find(
              (s) => (s._id || s.id) === (t._id || t.id)
            );
            return match ? { ...t, ai_priority_score: match.ai_priority_score } : t;
          });
          merged.sort((a, b) => {
            if (a.scheduled_time && b.scheduled_time) {
              return new Date(a.scheduled_time) - new Date(b.scheduled_time);
            }
            if (a.scheduled_time) return -1;
            if (b.scheduled_time) return 1;
            return (b.ai_priority_score ?? -1) - (a.ai_priority_score ?? -1);
          });
          setTasks(merged);
        } catch {
          // Scoring failed silently
        } finally {
          setScoring(false);
        }
      }

      // --- Day 3: Overload check after tasks are scored ---
      try {
        const overloadRes = await axios.post('/api/agent/overload-check', { user_id: userId });
        if (overloadRes.data.overloaded) {
          setOverloadData(overloadRes.data);
        } else {
          setOverloadData(null);
        }
      } catch (overloadErr) {
        console.warn('Overload check skipped:', overloadErr.message);
      }
    } catch (err) {
      setError('Failed to load tasks.');
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAndScore();
  }, [fetchAndScore]);

  const handleCalendarConnect = async () => {
    try {
      const { data } = await axios.get('/api/auth/google-calendar', {
        params: { user_id: userId },
      });
      if (data.oauth_url) {
        window.open(data.oauth_url, '_blank');
        // After 3 seconds, assume connection is being processed
        setTimeout(() => {
          localStorage.setItem('calendar_connected', 'true');
          setCalendarConnected(true);
          fetchAndScore();
        }, 3000);
      }
    } catch (err) {
      console.error('Calendar connect error:', err.message);
    }
  };

  const handleComplete = async (taskId, xpValue) => {
    try {
      const { data } = await axios.patch(`/api/tasks/${taskId}/complete`, {
        completed_at: new Date().toISOString(),
        user_id: userId,
      });
      const earned = data.xp_earned || xpValue || 10;

      // Update XP in localStorage
      const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
      profile.xp = (data.new_xp !== null && data.new_xp !== undefined) ? data.new_xp : ((profile.xp || 0) + earned);
      if (data.new_level) profile.level = data.new_level;
      if (profile.xp >= 100) {
        profile.xp = profile.xp % 100;
        profile.level = (profile.level || 1) + 1;
      }
      localStorage.setItem('user_profile', JSON.stringify(profile));
      setXp(profile.xp);
      setLevel(profile.level);

      await fetchAndScore();
    } catch {
      setError('Failed to complete task.');
    }
  };

  // --- Day 3: Skip flow handlers ---

  const handleSkipClick = (task) => {
    setSkippingTaskId(task._id || task.id);
  };

  const handleSkipWithReason = async (task, reason) => {
    const taskId = task._id || task.id;
    setSkippingTaskId(null);

    try {
      // 1. PATCH skip — applies streak logic
      const skipRes = await axios.patch(`/api/tasks/${taskId}/skip`, {
        reason,
        user_id: userId,
      });

      // 2. Handle remove_goal_prompt
      if (skipRes.data.remove_goal_prompt) {
        const pendingInCategory = tasks
          .filter((t) => t.category === task.category && t.status === 'pending')
          .map((t) => t._id || t.id);
        setRemoveGoalCategory(task.category);
        setRemoveGoalTaskIds(pendingInCategory);
        setRemoveGoalPrompt(true);
      }

      // 3. POST reschedule — get Gemini suggestion
      const rescheduleRes = await axios.post('/api/agent/reschedule', {
        task_id: taskId,
        reason,
        user_id: userId,
      });

      setRescheduleModal({ task, suggestion: rescheduleRes.data.suggestion });
    } catch (err) {
      console.error('Skip flow error:', err.message);
      await fetchAndScore();
    }
  };

  // --- Day 3: Confirm reschedule — Session 5 ---
  const handleConfirmReschedule = async ({ task, suggestion }) => {
    try {
      // Step 1: Calculate new slot datetime
      const today = new Date();
      const targetDate = suggestion.slot_date === 'tomorrow'
        ? new Date(today.getTime() + 24 * 60 * 60 * 1000)
        : today;
      const [hours, minutes] = suggestion.slot_start.split(':').map(Number);
      const newStart = new Date(targetDate);
      newStart.setHours(hours, minutes, 0, 0);
      const newEnd = new Date(newStart.getTime() + (task.duration_mins || 30) * 60 * 1000);

      const taskId = task._id || task.id;

      // Step 2: Update task scheduled_time in DB
      await axios.patch(`/api/tasks/${taskId}/reschedule`, {
        scheduled_time: newStart.toISOString(),
        user_id: userId,
      });

      // Step 3: Update or create Google Calendar event
      if (task.calendar_event_id) {
        await axios.patch(`/api/calendar/block/${task.calendar_event_id}`, {
          new_start: newStart.toISOString(),
          new_end: newEnd.toISOString(),
          user_id: userId,
        });
      } else {
        await axios.post('/api/calendar/block', {
          title: task.title,
          start: newStart.toISOString(),
          end: newEnd.toISOString(),
          task_id: taskId,
          user_id: userId,
        });
      }

      // Step 4: Close modal + refresh
      setRescheduleModal(null);
      await fetchAndScore();
    } catch (err) {
      console.error('Confirm reschedule error:', err.message);
      setRescheduleModal(null);
      await fetchAndScore();
    }
  };

  // --- Day 3: Remove goal handler ---
  const handleRemoveGoal = async () => {
    try {
      await Promise.all(removeGoalTaskIds.map((id) => axios.delete(`/api/tasks/${id}`)));
    } catch (err) {
      console.error('Remove goal error:', err.message);
    } finally {
      setRemoveGoalPrompt(false);
      setRemoveGoalCategory('');
      setRemoveGoalTaskIds([]);
      await fetchAndScore();
    }
  };

  const goToTasks = () => {
    localStorage.setItem('page', 'tasks');
    window.location.reload();
  };

  const goToStats = () => {
    localStorage.setItem('page', 'stats');
    window.location.reload();
  };

  const completedToday = tasks.filter((t) => t.status === 'completed').length;
  const totalToday = tasks.length;

  return (
    <div className="min-h-screen bg-[#0f0f1a] pb-28">
      {/* Background glows */}
      <div className="fixed top-0 left-0 w-[500px] h-[300px] bg-[radial-gradient(ellipse,rgba(90,117,244,0.12)_0%,transparent_70%)] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-[radial-gradient(ellipse,rgba(122,90,248,0.08)_0%,transparent_70%)] pointer-events-none" />

      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-[#0f0f1a]/90 backdrop-blur-md border-b border-[rgba(90,117,244,0.1)]">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5a75f4] to-[#7a5af8] flex items-center justify-center shadow-[0_0_15px_rgba(90,117,244,0.4)]">
                <span className="text-white font-bold text-sm">F</span>
              </div>
              <span className="text-white font-bold text-lg tracking-tight">FlowMind AI</span>
            </div>

            {/* User + AI scoring indicator + notification status */}
            <div className="flex items-center gap-3">
              {scoring && (
                <div className="flex items-center gap-1.5 text-xs text-[#5a75f4]">
                  <span className="w-3 h-3 border-2 border-[#5a75f4]/30 border-t-[#5a75f4] rounded-full animate-spin" />
                  AI scoring
                </div>
              )}
              <div className="flex items-center gap-2">
                {/* Day 3: Notification status indicator */}
                {localStorage.getItem('push_registered') === 'true' ? (
                  <span className="text-xs text-green-500/70" title="Push notifications active">🔔</span>
                ) : (
                  <button
                    onClick={() =>
                      registerPush(userId).then(() => {
                        localStorage.setItem('push_registered', 'true');
                        window.location.reload();
                      })
                    }
                    className="text-xs text-slate-500 underline"
                  >
                    Enable Notifications
                  </button>
                )}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5a75f4] to-[#7a5af8] flex items-center justify-center text-white font-semibold text-sm">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-slate-300 hidden sm:block">{userName}</span>
              </div>
            </div>
          </div>

          {/* XP Bar */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full bg-[#5a75f4]/20 border border-[#5a75f4]/40 flex items-center justify-center text-xs text-[#5a75f4] font-bold">
                {level}
              </span>
              <span className="text-xs text-slate-500">Lv</span>
            </div>
            <div className="flex-1 h-2 bg-[#1e1e38] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#5a75f4] to-[#7a5af8] rounded-full transition-all duration-700"
                style={{ width: `${Math.min(xp, 100)}%` }}
              />
            </div>
            <span className="text-xs text-slate-500">{xp}/100 XP</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* Date + Summary */}
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{getTodayLabel()}</h1>
          <p className="text-slate-500 text-sm">
            {loading
              ? 'Loading your tasks…'
              : `${totalToday} task${totalToday !== 1 ? 's' : ''} today`}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-red-900/30 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Day 3: Remove Goal Prompt — persistent yellow warning */}
        {removeGoalPrompt && (
          <div className="rounded-xl bg-[#1a1a0a] border border-yellow-500/30 p-3 flex items-center justify-between">
            <p className="text-yellow-400 text-xs">
              You've skipped <span className="font-semibold capitalize">{removeGoalCategory}</span> 3 times. Remove this goal?
            </p>
            <div className="flex gap-2 ml-3 flex-shrink-0">
              <button onClick={handleRemoveGoal} className="text-xs text-red-400 underline">
                Remove
              </button>
              <button onClick={() => setRemoveGoalPrompt(false)} className="text-xs text-slate-500">
                Keep
              </button>
            </div>
          </div>
        )}

        {/* Day 3: Overload Banner */}
        {overloadData && (
          <div className="rounded-2xl bg-[#1a0a0a] border border-red-500/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-red-400 font-bold text-sm">⚠️ Overload Detected</span>
              {overloadData.sprint_mode && (
                <span className="px-2 py-0.5 rounded-full bg-orange-900/40 text-orange-400 text-xs">
                  Sprint Mode
                </span>
              )}
            </div>
            <p className="text-slate-300 text-sm">{overloadData.damage_control_msg}</p>
            {overloadData.must_do && overloadData.must_do.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Must Do Today</p>
                {overloadData.must_do.map((t) => (
                  <div key={t.task_id} className="flex items-center gap-2 py-1">
                    <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                    <span className="text-slate-300 text-sm">{t.title}</span>
                    <span className="ml-auto text-xs text-slate-500">{t.min_duration_mins}m min</span>
                  </div>
                ))}
              </div>
            )}
            {overloadData.can_defer && overloadData.can_defer.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Defer to Tomorrow</p>
                {overloadData.can_defer.map((t) => (
                  <div key={t.task_id} className="flex items-center gap-2 py-1">
                    <span className="w-2 h-2 rounded-full bg-slate-600 flex-shrink-0" />
                    <span className="text-slate-500 text-sm line-through">{t.title}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setOverloadData(null)}
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Calendar Connect Banner — show only if not connected */}
        {!calendarConnected && (
          <div className="p-3 rounded-xl bg-[#1e1e38] border border-[rgba(90,117,244,0.2)] flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-300 font-medium">📅 Connect Google Calendar</p>
              <p className="text-xs text-slate-500">Let FlowMind read your schedule and find free slots</p>
            </div>
            <button
              onClick={handleCalendarConnect}
              id="calendar-connect-btn"
              className="px-3 py-1.5 rounded-lg bg-[#5a75f4] text-white text-xs font-semibold hover:bg-[#4a65e4] transition-all"
            >
              Connect
            </button>
          </div>
        )}

        {/* Stats row */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total', value: totalToday, icon: '📋', color: 'text-slate-300' },
              { label: 'Completed', value: completedToday, icon: '✅', color: 'text-green-400' },
              { label: 'Pending', value: totalToday - completedToday, icon: '⏳', color: 'text-[#5a75f4]' },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-2xl p-3 text-center">
                <div className="text-xl mb-1">{stat.icon}</div>
                <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Free Slots Section */}
        {freeSlots.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wider">Free Slots Today</h2>
            <div className="flex gap-2 flex-wrap">
              {freeSlots.map((slot, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 rounded-xl bg-[#1e1e38] border border-[rgba(90,117,244,0.2)] text-xs text-slate-300"
                >
                  {slot.start} – {slot.end} <span className="text-slate-500">({slot.duration_mins}m)</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">
            Timeline
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-2xl bg-[#1e1e38] animate-pulse" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center">
              <div className="text-5xl mb-3">🎉</div>
              <p className="text-slate-300 font-semibold">All clear!</p>
              <p className="text-slate-500 text-sm mt-1">Add tasks to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task, idx) => {
                const cat = CATEGORY_STYLES[task.category] || CATEGORY_STYLES.personal;
                const priority = PRIORITY_BADGE(task.ai_priority_score);
                const timeLabel = formatScheduledTime(task.scheduled_time);
                const taskId = task._id || task.id;
                const isPending = task.status === 'pending';

                return (
                  <div key={taskId} className="flex gap-3">
                    {/* Time column */}
                    <div className="w-14 flex-shrink-0 flex flex-col items-center pt-4">
                      <span className="text-xs text-slate-500 font-mono text-center leading-tight">
                        {timeLabel || '—'}
                      </span>
                      {idx < tasks.length - 1 && (
                        <div className="w-px flex-1 bg-[rgba(90,117,244,0.15)] mt-2" />
                      )}
                    </div>

                    {/* Task card */}
                    <div className="flex-1 glass rounded-2xl p-4 hover:border-[rgba(90,117,244,0.3)] transition-all">
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${cat.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-white text-sm">{task.title}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs border ${cat.bg} ${cat.text} ${cat.border}`}>
                              {cat.label}
                            </span>
                            {priority && (
                              <span className={`px-2 py-0.5 rounded-full text-xs border font-semibold ${priority.bg} ${priority.text} ${priority.border}`}>
                                {priority.label}
                              </span>
                            )}
                            {task.calendar_event_id && (
                              <span className="px-2 py-0.5 rounded-full text-xs border bg-blue-500/10 text-blue-400 border-blue-500/30">
                                📅 Cal
                              </span>
                            )}
                            {task.status === 'rescheduled' && (
                              <span className="px-2 py-0.5 rounded-full text-xs border bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
                                🔄 Rescheduled
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            {task.duration_mins && (
                              <span className="text-xs text-slate-500">⏱ {task.duration_mins}m</span>
                            )}
                            {task.energy_level && (
                              <span className="text-xs text-slate-500 capitalize">
                                {task.energy_level === 'high' ? '🔥' : task.energy_level === 'medium' ? '⚡' : '🧘'} {task.energy_level}
                              </span>
                            )}
                            {task.ai_priority_score !== null && task.ai_priority_score !== undefined && (
                              <span className="text-xs text-slate-600">Score: {task.ai_priority_score}</span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons — only for pending */}
                        {isPending && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Skip button */}
                            <button
                              onClick={() => handleSkipClick(task)}
                              className="px-3 py-1 rounded-lg bg-[#1e1e38] border border-[rgba(255,100,100,0.2)] text-red-400 text-xs font-semibold hover:bg-red-900/20 transition-all"
                            >
                              Skip
                            </button>
                            {/* Complete button */}
                            <button
                              onClick={() => handleComplete(taskId, task.xp_value)}
                              className="w-8 h-8 rounded-xl bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30 hover:scale-110 transition-all flex items-center justify-center text-sm"
                              title="Complete task"
                            >
                              ✓
                            </button>
                          </div>
                        )}
                        {task.status === 'completed' && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 flex items-center justify-center text-sm">
                            ✓
                          </div>
                        )}
                      </div>

                      {/* Day 3: Inline reason picker — shown when this task is being skipped */}
                      {skippingTaskId === taskId && (
                        <div className="flex gap-2 mt-3 flex-wrap">
                          {['emergency', 'choice', 'forgot'].map((reason) => (
                            <button
                              key={reason}
                              onClick={() => handleSkipWithReason(task, reason)}
                              className="px-3 py-1 rounded-lg bg-[#1e1e38] border border-[rgba(90,117,244,0.2)] text-slate-300 text-xs capitalize hover:border-[rgba(90,117,244,0.5)] transition-all"
                            >
                              {reason === 'emergency' ? '🚨 Emergency' : reason === 'choice' ? '🎬 My Choice' : '😅 Forgot'}
                            </button>
                          ))}
                          <button
                            onClick={() => setSkippingTaskId(null)}
                            className="text-slate-600 text-xs hover:text-slate-400 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Task FAB + Stats link */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <button
          onClick={goToTasks}
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#5a75f4] to-[#7a5af8] text-white font-semibold shadow-[0_8px_25px_rgba(90,117,244,0.5)] hover:shadow-[0_8px_35px_rgba(90,117,244,0.7)] hover:scale-105 transition-all flex items-center gap-2"
        >
          <span className="text-lg">+</span> Add Task
        </button>
        <button
          onClick={goToStats}
          id="view-stats-btn"
          className="text-xs text-slate-500 hover:text-slate-300 underline transition-colors"
        >
          View Stats &amp; Streaks
        </button>
      </div>

      {/* Floating mic button — disabled, Day 4 */}
      <div className="fixed bottom-6 right-6 group">
        <div className="relative">
          <button
            disabled
            className="w-14 h-14 rounded-full bg-[#1e1e38] border-2 border-[rgba(90,117,244,0.2)] text-slate-600 cursor-not-allowed flex items-center justify-center shadow-lg"
            title="Voice Agent — Day 4"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          {/* Tooltip */}
          <div className="absolute bottom-16 right-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="bg-[#1e1e38] border border-[rgba(90,117,244,0.2)] text-slate-400 text-xs px-3 py-1.5 rounded-xl whitespace-nowrap shadow-lg">
              🎙️ Voice Agent — Day 4
            </div>
          </div>
        </div>
      </div>

      {/* Day 3: Reschedule Suggestion Card — bottom sheet overlay */}
      {rescheduleModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setRescheduleModal(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-[#1a1a2e] border border-[rgba(90,117,244,0.3)] p-5 space-y-4 shadow-[0_-8px_40px_rgba(0,0,0,0.5)]">
            <p className="text-white font-semibold text-base">📅 Reschedule Suggestion</p>
            <p className="text-slate-300 text-sm">{rescheduleModal.suggestion.user_message}</p>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#0f0f1a] border border-[rgba(90,117,244,0.15)]">
              <span className="text-[#5a75f4] font-bold text-lg">{rescheduleModal.suggestion.slot_start}</span>
              <span className="text-slate-500 text-xs capitalize">{rescheduleModal.suggestion.slot_date}</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[#1e1e38] text-slate-400 capitalize">
                {rescheduleModal.suggestion.streak_impact}
              </span>
            </div>
            {rescheduleModal.suggestion.reason && (
              <p className="text-slate-500 text-xs">{rescheduleModal.suggestion.reason}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => handleConfirmReschedule(rescheduleModal)}
                className="flex-1 py-2.5 rounded-xl bg-[#5a75f4] text-white text-sm font-semibold hover:bg-[#4a65e4] transition-all"
              >
                Confirm
              </button>
              <button
                onClick={() => setRescheduleModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#1e1e38] text-slate-400 text-sm hover:bg-[#252540] transition-all"
              >
                Skip Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
