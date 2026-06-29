import { useState, useEffect } from 'react';
import { api as axios } from '../utils/api';

export default function Debrief() {
  const [debrief, setDebrief] = useState(null);
  // shape: { completed[], missed[], tip, motivational_line, xp_summary: { xp_earned, productivity_score } }
  const [loading, setLoading] = useState(true);

  const userId = localStorage.getItem('user_id');

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    axios.post('/api/agent/debrief', {
      date: today,
      user_id: userId
    }).then(res => {
      setDebrief(res.data);
    }).catch(err => {
      console.error('Debrief fetch error:', err.message);
    }).finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="min-h-screen bg-[#0f0f1a] p-4 space-y-5">
      {/* Fixed background glows */}
      <div className="fixed top-0 left-0 w-[500px] h-[300px] bg-[radial-gradient(ellipse,rgba(90,117,244,0.12)_0%,transparent_70%)] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-[radial-gradient(ellipse,rgba(122,90,248,0.08)_0%,transparent_70%)] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { localStorage.setItem('page', 'dashboard'); window.location.reload(); }}
          className="w-9 h-9 rounded-xl bg-[#1e1e38] border border-[rgba(90,117,244,0.2)] flex items-center justify-center text-slate-400 hover:text-white transition-all"
        >
          ←
        </button>
        <span className="text-white font-semibold">Today's Debrief</span>
        <span className="ml-auto text-xs text-slate-600">
          {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
        </span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-6 h-6 border-2 border-[#5a75f4] border-t-transparent rounded-full" />
        </div>
      )}

      {debrief && !loading && (
        <>
          {/* Productivity Score */}
          <div className="rounded-2xl bg-[#1a1a2e] border border-[rgba(90,117,244,0.2)] p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-sm">Productivity Score</span>
              <span className="text-3xl font-bold text-white">
                {debrief.xp_summary.productivity_score}
                <span className="text-lg text-slate-500">/100</span>
              </span>
            </div>
            <div className="h-2 bg-[#0f0f1a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#5a75f4] to-[#7a5af8] transition-all duration-700"
                style={{ width: `${debrief.xp_summary.productivity_score}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">+{debrief.xp_summary.xp_earned} XP earned today</p>
          </div>

          {/* Completed Tasks */}
          <div className="rounded-2xl bg-[#0f1a0f] border border-green-900/40 p-4 space-y-2">
            <p className="text-green-400 text-xs font-semibold uppercase tracking-wider">
              ✅ Completed ({debrief.completed.length})
            </p>
            {debrief.completed.length === 0 && (
              <p className="text-slate-600 text-sm">No tasks completed today</p>
            )}
            {debrief.completed.map(t => (
              <div key={t._id} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-slate-300 text-sm">{t.title}</span>
                <span className="ml-auto text-xs text-green-600">+{t.xp_value || 10} XP</span>
              </div>
            ))}
          </div>

          {/* Missed Tasks */}
          {debrief.missed.length > 0 && (
            <div className="rounded-2xl bg-[#1a0f0f] border border-red-900/40 p-4 space-y-2">
              <p className="text-red-400 text-xs font-semibold uppercase tracking-wider">
                ⚠️ Missed ({debrief.missed.length})
              </p>
              {debrief.missed.map(t => (
                <div key={t._id} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                  <span className="text-slate-400 text-sm">{t.title}</span>
                </div>
              ))}
            </div>
          )}

          {/* Gemini Tip */}
          <div className="rounded-2xl bg-[#1a1a2e] border border-[rgba(90,117,244,0.3)] p-4 space-y-2">
            <p className="text-[#5a75f4] text-xs font-semibold uppercase tracking-wider">
              💡 FlowMind Tip for Tomorrow
            </p>
            <p className="text-slate-200 text-sm leading-relaxed">{debrief.tip}</p>
            <p className="text-slate-500 text-xs italic">{debrief.motivational_line}</p>
          </div>
        </>
      )}

      {!loading && !debrief && (
        <div className="rounded-2xl bg-[#1a1a2e] border border-[rgba(90,117,244,0.2)] p-10 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-slate-300 font-semibold">Debrief unavailable</p>
          <p className="text-slate-500 text-sm mt-1">Check back later</p>
        </div>
      )}
    </div>
  );
}
