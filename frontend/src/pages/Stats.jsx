import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Stats() {
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);

  const userId = localStorage.getItem('user_id');
  const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
  const xp = profile.xp ?? 0;
  const level = profile.level ?? 1;
  const userName = profile?.name || 'User';

  useEffect(() => {
    const fetchHabits = async () => {
      try {
        const { data } = await axios.get('/api/habits', { params: { user_id: userId } });
        setHabits(data.habits || []);
      } catch (err) {
        console.error('Failed to fetch habits:', err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchHabits();
  }, [userId]);

  const goBack = () => {
    localStorage.setItem('page', 'dashboard');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] pb-20">
      {/* Background glows */}
      <div className="fixed top-0 left-0 w-[500px] h-[300px] bg-[radial-gradient(ellipse,rgba(90,117,244,0.10)_0%,transparent_70%)] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-[radial-gradient(ellipse,rgba(122,90,248,0.07)_0%,transparent_70%)] pointer-events-none" />

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
            <h1 className="text-lg font-bold text-white">Stats &amp; Habits</h1>
            <p className="text-xs text-slate-500">Your progress at a glance</p>
          </div>
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5a75f4] to-[#7a5af8] flex items-center justify-center text-white font-semibold text-sm">
            {userName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">

        {/* XP & Level Card */}
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Experience</h2>
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5a75f4] to-[#7a5af8] flex items-center justify-center shadow-[0_0_15px_rgba(90,117,244,0.4)]">
                  <span className="text-white font-bold text-sm">⚡</span>
                </div>
                <div>
                  <span className="text-white font-bold text-lg">Level {level}</span>
                  <p className="text-slate-500 text-xs">FlowMind Practitioner</p>
                </div>
              </div>
              <span className="text-slate-400 text-sm font-mono">{xp}/100 XP</span>
            </div>

            {/* XP Progress bar */}
            <div className="h-3 bg-[#1e1e38] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#5a75f4] to-[#7a5af8] rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.min(xp, 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">{100 - xp} XP to Level {level + 1}</p>

            {/* XP milestone dots */}
            <div className="flex items-center gap-1 mt-3">
              {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((milestone) => (
                <div
                  key={milestone}
                  className={`flex-1 h-1 rounded-full transition-all ${xp >= milestone ? 'bg-[#5a75f4]' : 'bg-[#1e1e38]'}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Habit Streaks */}
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Habit Streaks</h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-[#1e1e38] animate-pulse" />
              ))}
            </div>
          ) : habits.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center">
              <div className="text-5xl mb-3">🌱</div>
              <p className="text-slate-300 font-semibold">No habits tracked yet</p>
              <p className="text-slate-500 text-sm mt-1">Complete tasks to start tracking streaks</p>
            </div>
          ) : (
            <div className="space-y-3">
              {habits.map((habit) => {
                const progress = Math.min((habit.this_week_count / (habit.goal_frequency || 5)) * 100, 100);
                const categoryEmojis = {
                  study: '📚',
                  gym: '💪',
                  work: '💼',
                  personal: '✨',
                };
                const emoji = categoryEmojis[habit.task_category] || '🎯';

                return (
                  <div key={habit._id} className="glass rounded-2xl p-4 hover:border-[rgba(90,117,244,0.3)] transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{emoji}</span>
                        <span className="text-white font-semibold capitalize">{habit.task_category}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-2xl font-bold text-[#5a75f4]">🔥</span>
                        <span className="text-2xl font-bold text-[#5a75f4]">{habit.current_streak}</span>
                        <span className="text-xs text-slate-500">day streak</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                      <span>🏆 Best: <span className="text-slate-300">{habit.longest_streak} days</span></span>
                      <span>📅 This week: <span className="text-slate-300">{habit.this_week_count}x</span></span>
                    </div>

                    {/* Weekly progress bar */}
                    <div>
                      <div className="flex justify-between text-xs text-slate-600 mb-1.5">
                        <span>Weekly goal</span>
                        <span className={progress >= 100 ? 'text-green-400' : 'text-slate-400'}>
                          {habit.this_week_count}/{habit.goal_frequency}
                          {progress >= 100 && ' ✓'}
                        </span>
                      </div>
                      <div className="h-2 bg-[#1e1e38] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${progress >= 100 ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-green-500/70'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick summary card */}
        {habits.length > 0 && (
          <div className="glass rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Quick Summary</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-xl font-bold text-[#5a75f4]">
                  {Math.max(...habits.map((h) => h.current_streak), 0)}
                </div>
                <div className="text-xs text-slate-500 mt-1">Best Active Streak</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-purple-400">
                  {habits.reduce((s, h) => s + (h.this_week_count || 0), 0)}
                </div>
                <div className="text-xs text-slate-500 mt-1">Tasks This Week</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-400">{habits.length}</div>
                <div className="text-xs text-slate-500 mt-1">Active Habits</div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
