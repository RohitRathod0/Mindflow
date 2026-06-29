import { useState } from 'react';
import { api as axios } from '../utils/api';

const STEPS = [
  {
    id: 1,
    question: 'What is your primary role?',
    type: 'single',
    options: [
      { label: 'Student', value: 'student', icon: '🎓' },
      { label: 'Professional', value: 'professional', icon: '💼' },
      { label: 'Fitness Enthusiast', value: 'gym', icon: '💪' },
      { label: 'Mixed', value: 'mixed', icon: '🌀' },
    ],
    field: 'persona',
  },
  {
    id: 2,
    question: 'What matters most to you?',
    subtitle: 'Drag to rank your priorities (top = most important)',
    type: 'rank',
    options: [
      { label: 'Academics', value: 'academics', icon: '📚' },
      { label: 'Career', value: 'career', icon: '📈' },
      { label: 'Health', value: 'health', icon: '❤️' },
      { label: 'Social', value: 'social', icon: '👥' },
      { label: 'Projects', value: 'projects', icon: '🛠️' },
    ],
    field: 'priority_weights',
  },
  {
    id: 3,
    question: 'Daily hours on your core activity?',
    type: 'single',
    options: [
      { label: 'Under 2 hours', value: 'under_2', icon: '⚡' },
      { label: '2–4 hours', value: '2_4', icon: '🕑' },
      { label: '4–6 hours', value: '4_6', icon: '🕓' },
      { label: '6+ hours', value: '6_plus', icon: '🏆' },
    ],
    field: 'age_group',
  },
  {
    id: 4,
    question: 'Fixed daily commitments?',
    subtitle: 'Select all that apply and set times',
    type: 'multi_time',
    options: [
      { label: 'College', value: 'college', icon: '🏫' },
      { label: 'Gym', value: 'gym', icon: '🏋️' },
      { label: 'Office', value: 'office', icon: '🏢' },
      { label: 'Sports', value: 'sports', icon: '⚽' },
    ],
    field: 'fixed_blocks',
  },
  {
    id: 5,
    question: 'When are you most productive?',
    type: 'single',
    options: [
      { label: 'Morning', value: 'morning', icon: '🌅' },
      { label: 'Afternoon', value: 'afternoon', icon: '☀️' },
      { label: 'Evening', value: 'evening', icon: '🌆' },
      { label: 'Night', value: 'night', icon: '🌙' },
    ],
    field: 'productive_hours',
  },
  {
    id: 6,
    question: "What's your biggest struggle?",
    type: 'single',
    options: [
      { label: 'Deadlines', value: 'deadline_focused', icon: '⏰' },
      { label: 'Motivation', value: 'motivation_focused', icon: '🔥' },
      { label: 'Too many tasks', value: 'clarity_focused', icon: '🌪️' },
      { label: 'Time management', value: 'time_focused', icon: '🗓️' },
    ],
    field: 'coaching_style',
  },
];

const RANK_WEIGHTS = [1.0, 0.8, 0.5, 0.2, 0.2];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState({
    persona: '',
    priority_weights: ['academics', 'career', 'health', 'social', 'projects'],
    age_group: '',
    fixed_blocks: {},
    productive_hours: '',
    coaching_style: '',
    name: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentStep = STEPS[step - 1];

  // --- Handlers ---
  const handleSingle = (field, value) => {
    setAnswers((prev) => ({ ...prev, [field]: value }));
  };

  const handleRankMove = (index, direction) => {
    setAnswers((prev) => {
      const arr = [...prev.priority_weights];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= arr.length) return prev;
      [arr[index], arr[targetIndex]] = [arr[targetIndex], arr[index]];
      return { ...prev, priority_weights: arr };
    });
  };

  const handleMultiTimeToggle = (value) => {
    setAnswers((prev) => {
      const blocks = { ...prev.fixed_blocks };
      if (blocks[value]) {
        delete blocks[value];
      } else {
        blocks[value] = { start: '09:00', end: '10:00' };
      }
      return { ...prev, fixed_blocks: blocks };
    });
  };

  const handleTimeChange = (value, field, time) => {
    setAnswers((prev) => ({
      ...prev,
      fixed_blocks: {
        ...prev.fixed_blocks,
        [value]: { ...prev.fixed_blocks[value], [field]: time },
      },
    }));
  };

  const canAdvance = () => {
    if (step === 1) return !!answers.name && !!answers.email && !!answers.persona;
    if (step === 2) return true;
    if (step === 3) return !!answers.age_group;
    if (step === 4) return true;
    if (step === 5) return !!answers.productive_hours;
    if (step === 6) return !!answers.coaching_style;
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      // Build priority_weights object from ranked array
      const weightObj = {};
      answers.priority_weights.forEach((key, idx) => {
        if (['academics', 'health', 'career', 'social'].includes(key)) {
          weightObj[key] = RANK_WEIGHTS[idx] ?? 0.2;
        }
      });

      // Build fixed_blocks array
      const fixed_blocks = Object.entries(answers.fixed_blocks).map(
        ([name, times]) => ({
          name,
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          start: times.start,
          end: times.end,
        })
      );

      const payload = {
        firebase_uid: `user_${Date.now()}`,
        name: answers.name,
        email: answers.email,
        persona: answers.persona,
        priority_weights: weightObj,
        fixed_blocks,
        age_group: answers.age_group,
        productive_hours: answers.productive_hours,
        coaching_style: answers.coaching_style,
        language: 'en',
      };

      const { data } = await axios.post('/api/user/onboarding', payload);

      localStorage.setItem('user_id', data.user_profile._id);
      localStorage.setItem('firebase_uid', data.user_profile.firebase_uid);
      localStorage.setItem('user_profile', JSON.stringify(data.user_profile));
      localStorage.setItem('page', 'dashboard');
      window.location.reload();
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // --- Renders ---
  const renderStep1Extra = () => (
    <div className="mb-6 space-y-3">
      <input
        type="text"
        placeholder="Your name"
        value={answers.name}
        onChange={(e) => setAnswers((p) => ({ ...p, name: e.target.value }))}
        className="w-full px-4 py-3 rounded-xl bg-[#12122a] border border-[rgba(90,117,244,0.25)] text-white placeholder-slate-500 focus:outline-none focus:border-[#5a75f4] transition-all"
      />
      <input
        type="email"
        placeholder="Your email"
        value={answers.email}
        onChange={(e) => setAnswers((p) => ({ ...p, email: e.target.value }))}
        className="w-full px-4 py-3 rounded-xl bg-[#12122a] border border-[rgba(90,117,244,0.25)] text-white placeholder-slate-500 focus:outline-none focus:border-[#5a75f4] transition-all"
      />
    </div>
  );

  const renderSingle = (field, options) => (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => handleSingle(field, opt.value)}
          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200 hover:scale-[1.02] ${
            answers[field] === opt.value
              ? 'border-[#5a75f4] bg-[rgba(90,117,244,0.15)] shadow-[0_0_20px_rgba(90,117,244,0.3)]'
              : 'border-[rgba(90,117,244,0.2)] bg-[#12122a] hover:border-[rgba(90,117,244,0.5)]'
          }`}
        >
          <span className="text-3xl">{opt.icon}</span>
          <span className="text-sm font-medium text-slate-200">{opt.label}</span>
        </button>
      ))}
    </div>
  );

  const renderRank = () => (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 mb-4 text-center">Click arrows to reorder — top = most important</p>
      {answers.priority_weights.map((key, idx) => {
        const opt = STEPS[1].options.find((o) => o.value === key);
        return (
          <div
            key={key}
            className="flex items-center gap-3 p-3 rounded-xl bg-[#12122a] border border-[rgba(90,117,244,0.2)]"
          >
            <span className="w-6 h-6 rounded-full bg-[#5a75f4] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {idx + 1}
            </span>
            <span className="text-lg">{opt?.icon}</span>
            <span className="flex-1 text-sm font-medium text-slate-200">{opt?.label}</span>
            <span className="text-xs text-slate-500 mr-2">{RANK_WEIGHTS[idx]}</span>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => handleRankMove(idx, -1)}
                disabled={idx === 0}
                className="text-slate-400 hover:text-white disabled:opacity-20 text-xs leading-none"
              >
                ▲
              </button>
              <button
                onClick={() => handleRankMove(idx, 1)}
                disabled={idx === answers.priority_weights.length - 1}
                className="text-slate-400 hover:text-white disabled:opacity-20 text-xs leading-none"
              >
                ▼
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderMultiTime = () => (
    <div className="space-y-3">
      {currentStep.options.map((opt) => {
        const isSelected = !!answers.fixed_blocks[opt.value];
        return (
          <div
            key={opt.value}
            className={`rounded-2xl border-2 transition-all duration-200 overflow-hidden ${
              isSelected
                ? 'border-[#5a75f4] bg-[rgba(90,117,244,0.1)]'
                : 'border-[rgba(90,117,244,0.2)] bg-[#12122a]'
            }`}
          >
            <button
              className="w-full flex items-center gap-3 p-3 text-left"
              onClick={() => handleMultiTimeToggle(opt.value)}
            >
              <span
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  isSelected ? 'bg-[#5a75f4] border-[#5a75f4]' : 'border-slate-500'
                }`}
              >
                {isSelected && <span className="text-white text-xs">✓</span>}
              </span>
              <span className="text-lg">{opt.icon}</span>
              <span className="text-sm font-medium text-slate-200">{opt.label}</span>
            </button>
            {isSelected && (
              <div className="px-3 pb-3 flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-slate-500 block mb-1">Start</label>
                  <input
                    type="time"
                    value={answers.fixed_blocks[opt.value]?.start}
                    onChange={(e) => handleTimeChange(opt.value, 'start', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0f0f1a] border border-[rgba(90,117,244,0.3)] text-white text-sm focus:outline-none focus:border-[#5a75f4]"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-500 block mb-1">End</label>
                  <input
                    type="time"
                    value={answers.fixed_blocks[opt.value]?.end}
                    onChange={(e) => handleTimeChange(opt.value, 'end', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0f0f1a] border border-[rgba(90,117,244,0.3)] text-white text-sm focus:outline-none focus:border-[#5a75f4]"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderContent = () => {
    if (step === 1)
      return (
        <>
          {renderStep1Extra()}
          {renderSingle('persona', currentStep.options)}
        </>
      );
    if (step === 2) return renderRank();
    if (step === 4) return renderMultiTime();
    return renderSingle(currentStep.field, currentStep.options);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0f0f1a]">
      {/* Background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse,rgba(90,117,244,0.15)_0%,transparent_70%)] pointer-events-none" />

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5a75f4] to-[#7a5af8] flex items-center justify-center">
              <span className="text-white font-bold text-sm">F</span>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">FlowMind AI</span>
          </div>
          <p className="text-slate-500 text-sm">Let's personalize your experience</p>
        </div>

        {/* Card */}
        <div className="glass rounded-3xl p-6 shadow-2xl">
          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-slate-500 mb-2">
              <span>Step {step} of {STEPS.length}</span>
              <span>{Math.round((step / STEPS.length) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-[#1e1e38] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#5a75f4] to-[#7a5af8] rounded-full transition-all duration-500"
                style={{ width: `${(step / STEPS.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Question */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-1">{currentStep.question}</h2>
            {currentStep.subtitle && (
              <p className="text-sm text-slate-500">{currentStep.subtitle}</p>
            )}
          </div>

          {/* Options */}
          <div className="mb-6">{renderContent()}</div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-900/30 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex-1 py-3 rounded-xl border border-[rgba(90,117,244,0.3)] text-slate-300 hover:bg-[rgba(90,117,244,0.1)] transition-all font-medium"
              >
                Back
              </button>
            )}
            {step < STEPS.length ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canAdvance()}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#5a75f4] to-[#7a5af8] text-white font-semibold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_15px_rgba(90,117,244,0.4)]"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canAdvance() || loading}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#5a75f4] to-[#7a5af8] text-white font-semibold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_15px_rgba(90,117,244,0.4)] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Launch FlowMind 🚀'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
