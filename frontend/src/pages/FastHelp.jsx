import { useState } from 'react';
import { api as axios } from '../utils/api';

export default function FastHelp() {
  const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
  const persona = userProfile.persona || 'student';
  const [context, setContext] = useState('');
  const [deadlineHours, setDeadlineHours] = useState(24);
  const [result, setResult] = useState(null); // { help_content, type }
  const [loading, setLoading] = useState(false);

  const PERSONA_CONFIG = {
    student: {
      label: '📚 Quick Study Help',
      placeholder: 'e.g. Explain Fourier Transform for my signals exam',
      showDeadline: true,
      icon: '📚'
    },
    gym: {
      label: '💪 Workout Cues',
      placeholder: 'e.g. Upper body push day, 45 minutes',
      showDeadline: false,
      icon: '💪'
    },
    fitness: {
      label: '💪 Workout Cues',
      placeholder: 'e.g. HIIT circuit, 30 minutes',
      showDeadline: false,
      icon: '💪'
    },
    professional: {
      label: '📧 Quick Email / Task Draft',
      placeholder: 'e.g. Follow up email to client about delayed report',
      showDeadline: false,
      icon: '📧'
    }
  };
  const config = PERSONA_CONFIG[persona] || PERSONA_CONFIG.student;

  const handleGetHelp = async () => {
    if (!context.trim()) return;
    setLoading(true);
    try {
      const res = await axios.post('/api/agent/fast-help', {
        persona,
        context,
        deadline_hours_left: deadlineHours,
        user_id: localStorage.getItem('user_id')
      });
      setResult(res.data);
      // Auto-speak for gym persona
      if (res.data.type === 'workout' && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(res.data.help_content);
        utterance.lang = 'en-IN';
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      setResult({ help_content: 'Something went wrong. Try again.', type: 'qa' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => { localStorage.setItem('page','dashboard'); window.location.reload(); }}
          className="text-slate-400 hover:text-white">←</button>
        <span className="text-white font-semibold">{config.icon} Fast Help</span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[#1e1e38] text-slate-400 capitalize">{persona}</span>
      </div>

      {/* Input card */}
      <div className="rounded-2xl bg-[#1a1a2e] border border-[rgba(90,117,244,0.2)] p-4 space-y-3">
        <p className="text-white font-semibold text-sm">{config.label}</p>
        <textarea
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder={config.placeholder}
          rows={3}
          className="w-full bg-[#0f0f1a] border border-[rgba(90,117,244,0.15)] rounded-xl px-3 py-2 text-slate-200 text-sm placeholder-slate-600 outline-none resize-none focus:border-[#5a75f4]"
        />
        {config.showDeadline && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Deadline in</span>
            <input
              type="number"
              value={deadlineHours}
              onChange={e => setDeadlineHours(Number(e.target.value))}
              min={1} max={72}
              className="w-16 bg-[#0f0f1a] border border-[rgba(90,117,244,0.15)] rounded-lg px-2 py-1 text-slate-200 text-sm text-center outline-none"
            />
            <span className="text-xs text-slate-500">hours</span>
          </div>
        )}
        <button
          onClick={handleGetHelp}
          disabled={loading || !context.trim()}
          className="w-full py-2.5 rounded-xl bg-[#5a75f4] text-white text-sm font-semibold disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Get Help'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-2xl bg-[#1a1a2e] border border-[rgba(90,117,244,0.2)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 uppercase tracking-wider">
              {result.type === 'qa' ? 'Study Help' : result.type === 'workout' ? 'Workout Cues' : 'Email Draft'}
            </span>
            {result.type === 'workout' && (
              <button
                onClick={() => {
                  const u = new SpeechSynthesisUtterance(result.help_content);
                  u.lang = 'en-IN';
                  window.speechSynthesis.speak(u);
                }}
                className="text-xs text-[#5a75f4] underline"
              >
                🔊 Speak Again
              </button>
            )}
          </div>
          <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{result.help_content}</p>
          <button
            onClick={() => { setResult(null); setContext(''); }}
            className="text-xs text-slate-600 hover:text-slate-400"
          >
            Ask another
          </button>
        </div>
      )}
    </div>
  );
}
