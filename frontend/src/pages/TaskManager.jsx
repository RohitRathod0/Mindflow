import { useState, useEffect, useCallback } from 'react';
import { api as axios } from '../utils/api';
import SkeletonCard from '../components/SkeletonCard';

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

const getDeadlineCountdown = (deadline) => {
  if (!deadline) return null;
  const diff = new Date(deadline) - new Date();
  if (diff < 0) return { label: 'Overdue', color: 'text-red-400' };
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours < 1) return { label: `${mins}m left`, color: 'text-red-400' };
  if (hours < 24) return { label: `${hours}h left`, color: hours < 4 ? 'text-orange-400' : 'text-yellow-400' };
  const days = Math.floor(hours / 24);
  return { label: `${days}d left`, color: 'text-slate-400' };
};

const INITIAL_FORM = {
  title: '',
  category: 'study',
  deadline: '',
  duration_mins: '',
  energy_level: 'medium',
  is_recurring: false,
};

export default function TaskManager() {
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [calendarToast, setCalendarToast] = useState(false);

  const userId = localStorage.getItem('user_id');
  const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');

  const fetchAndScore = useCallback(async () => {
    setLoadingTasks(true);
    setError('');
    try {
      const { data } = await axios.get('/api/tasks/today', { params: { user_id: userId } });
      let taskList = data.tasks || [];
      setTasks(taskList);
      setLoadingTasks(false);

      // Score with Gemini
      if (taskList.length > 0) {
        setScoring(true);
        try {
          const { data: scored } = await axios.post('/api/agent/prioritize', {
            tasks: taskList,
            user_profile: userProfile,
          });
          const withScores = scored.tasks_with_priority_scores || [];
          // Merge scores into task list and sort by priority desc
          const merged = taskList.map((t) => {
            const match = withScores.find(
              (s) => (s._id || s.id) === (t._id || t.id)
            );
            return match ? { ...t, ai_priority_score: match.ai_priority_score } : t;
          });
          merged.sort((a, b) => (b.ai_priority_score ?? -1) - (a.ai_priority_score ?? -1));
          setTasks(merged);
        } catch {
          // Scoring failed — keep tasks without scores
        } finally {
          setScoring(false);
        }
      }
    } catch (err) {
      setError('Failed to load tasks: ' + (err.response?.data?.error || err.message));
      setLoadingTasks(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAndScore();
  }, [fetchAndScore]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const { data } = await axios.post('/api/tasks', {
        user_id: userId,
        title: form.title,
        category: form.category,
        deadline: form.deadline || undefined,
        duration_mins: form.duration_mins ? Number(form.duration_mins) : undefined,
        energy_level: form.energy_level,
        is_recurring: form.is_recurring,
      });
      setForm(INITIAL_FORM);
      // Show calendar toast if event was created
      if (data.task?.calendar_event_id) {
        setCalendarToast(true);
        setTimeout(() => setCalendarToast(false), 2000);
      }
      await fetchAndScore();
    } catch (err) {
      setError('Failed to add task: ' + (err.response?.data?.error || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (id) => {
    try {
      await axios.patch(`/api/tasks/${id}/complete`, { completed_at: new Date().toISOString() });
      await fetchAndScore();
    } catch (err) {
      setError('Failed to complete task.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/tasks/${id}`);
      setTasks((prev) => prev.filter((t) => (t._id || t.id) !== id));
    } catch (err) {
      setError('Failed to delete task.');
    }
  };

  const goBack = () => {
    localStorage.setItem('page', 'dashboard');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] pb-20">
      {/* Fixed background glow */}
      <div className="fixed top-0 right-0 w-[400px] h-[400px] bg-[radial-gradient(ellipse,rgba(90,117,244,0.08)_0%,transparent_70%)] pointer-events-none" />

      {/* Calendar Toast */}
      {calendarToast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-xl bg-green-900/80 border border-green-500/40 text-green-300 text-sm animate-fade-in">
          📅 Added to Google Calendar
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0f0f1a]/90 backdrop-blur-md border-b border-[rgba(90,117,244,0.1)]">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-xl bg-[#1e1e38] border border-[rgba(90,117,244,0.2)] flex items-center justify-center text-slate-400 hover:text-white transition-all"
          >
            ←
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">Task Manager</h1>
            <p className="text-xs text-slate-500">Manage today's tasks</p>
          </div>
          {scoring && (
            <div className="flex items-center gap-2 text-xs text-[#5a75f4]">
              <span className="w-3 h-3 border-2 border-[#5a75f4]/30 border-t-[#5a75f4] rounded-full animate-spin" />
              AI scoring…
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-red-900/30 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Add Task Form */}
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Add New Task</h2>
          <form onSubmit={handleAddTask} className="space-y-3">
            <input
              type="text"
              placeholder="Task title..."
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-[#12122a] border border-[rgba(90,117,244,0.25)] text-white placeholder-slate-500 focus:outline-none focus:border-[#5a75f4] transition-all text-sm"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#12122a] border border-[rgba(90,117,244,0.25)] text-white focus:outline-none focus:border-[#5a75f4] text-sm"
                >
                  <option value="study">📚 Study</option>
                  <option value="gym">💪 Gym</option>
                  <option value="work">💼 Work</option>
                  <option value="personal">✨ Personal</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">Energy Level</label>
                <select
                  value={form.energy_level}
                  onChange={(e) => setForm((p) => ({ ...p, energy_level: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#12122a] border border-[rgba(90,117,244,0.25)] text-white focus:outline-none focus:border-[#5a75f4] text-sm"
                >
                  <option value="high">🔥 High</option>
                  <option value="medium">⚡ Medium</option>
                  <option value="low">🧘 Low</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">Deadline</label>
                <input
                  type="datetime-local"
                  value={form.deadline}
                  onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#12122a] border border-[rgba(90,117,244,0.25)] text-white focus:outline-none focus:border-[#5a75f4] text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">Duration (mins)</label>
                <input
                  type="number"
                  placeholder="e.g. 45"
                  value={form.duration_mins}
                  onChange={(e) => setForm((p) => ({ ...p, duration_mins: e.target.value }))}
                  min="1"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#12122a] border border-[rgba(90,117,244,0.25)] text-white placeholder-slate-500 focus:outline-none focus:border-[#5a75f4] text-sm"
                />
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setForm((p) => ({ ...p, is_recurring: !p.is_recurring }))}
                className={`w-10 h-5 rounded-full transition-all relative ${form.is_recurring ? 'bg-[#5a75f4]' : 'bg-[#2a2a4a]'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.is_recurring ? 'left-5' : 'left-0.5'}`} />
              </div>
              <span className="text-sm text-slate-300">Recurring task</span>
            </label>

            <button
              type="submit"
              disabled={submitting || !form.title.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#5a75f4] to-[#7a5af8] text-white font-semibold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(90,117,244,0.3)]"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Adding…
                </>
              ) : (
                '+ Add Task'
              )}
            </button>
          </form>
        </div>

        {/* Task List */}
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider flex items-center gap-2">
            Today's Tasks
            <span className="px-2 py-0.5 rounded-full bg-[#1e1e38] text-xs text-slate-400 font-normal">
              {tasks.length}
            </span>
          </h2>

          {loadingTasks ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-slate-400 font-medium">No tasks yet</p>
              <p className="text-slate-600 text-sm mt-1">Add your first task above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const cat = CATEGORY_STYLES[task.category] || CATEGORY_STYLES.personal;
                const deadline = getDeadlineCountdown(task.deadline);
                const priority = PRIORITY_BADGE(task.ai_priority_score);
                const taskId = task._id || task.id;

                return (
                  <div
                    key={taskId}
                    className="glass rounded-2xl p-4 hover:border-[rgba(90,117,244,0.3)] transition-all"
                  >
                    <div className="flex items-start gap-3">
                      {/* Category dot */}
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${cat.dot}`} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-white text-sm truncate">{task.title}</span>
                          {/* Category badge */}
                          <span className={`px-2 py-0.5 rounded-full text-xs border ${cat.bg} ${cat.text} ${cat.border}`}>
                            {cat.label}
                          </span>
                          {/* Priority badge */}
                          {priority && (
                            <span className={`px-2 py-0.5 rounded-full text-xs border font-semibold ${priority.bg} ${priority.text} ${priority.border}`}>
                              {priority.label}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                          {deadline && (
                            <span className={`text-xs ${deadline.color}`}>⏰ {deadline.label}</span>
                          )}
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

                      {/* Actions */}
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleComplete(taskId)}
                          className="w-8 h-8 rounded-xl bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30 transition-all flex items-center justify-center text-sm"
                          title="Complete"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => handleDelete(taskId)}
                          className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-all flex items-center justify-center text-sm"
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
