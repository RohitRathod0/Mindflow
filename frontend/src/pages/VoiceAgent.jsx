import { useState, useEffect } from 'react';
import { api as axios } from '../utils/api';

export default function VoiceAgent() {
  const [messages, setMessages] = useState([]); // { role: 'user'|'agent', text: string }[]
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [textInput, setTextInput] = useState('');
  
  const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
  const langMap = { en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN' };
  const initialLangCode = langMap[userProfile?.profile?.language] || 'en-IN';
  const [langCode, setLangCode] = useState(initialLangCode);

  useEffect(() => {
    const userId = localStorage.getItem('user_id');
    const today = new Date().toISOString().split('T')[0];
    axios.get(`/api/agent/conversation?user_id=${userId}&date=${today}`)
      .then(res => {
        // Map DB messages to UI format: { role, text }
        const uiMessages = res.data.messages.map(m => ({ role: m.role, text: m.text }));
        setMessages(uiMessages);
      })
      .catch(() => {}); // fail silently, empty chat is fine
  }, []);

  const startListening = () => {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      alert('Speech recognition not supported. Use text input.');
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = langCode;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      handleSendMessage(transcript);
    };
    recognition.start();
  };

  const speakText = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // stop any ongoing speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = async (text) => {
    if (!text.trim()) return;
    const userId = localStorage.getItem('user_id');
    // Add user message to UI immediately
    setMessages(prev => [...prev, { role: 'user', text }]);
    setTextInput('');
    setIsThinking(true);
    try {
      const res = await axios.post('/api/agent/chat', {
        message: text,
        conversation_history: messages,
        voice_mode: true,
        user_id: userId
      });
      const { reply, tts_text, action_taken } = res.data;
      
      if (action_taken && action_taken !== 'null') {
        // Show a small action badge under the agent message
        setMessages(prev => [
          ...prev,
          { role: 'agent', text: reply },
          { role: 'system', text: `✅ ${action_taken}` }
        ]);
      } else {
        setMessages(prev => [...prev, { role: 'agent', text: reply }]);
      }
      
      speakText(tts_text || reply);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'agent', text: 'Sorry, something went wrong.' }]);
    } finally {
      setIsThinking(false);
    }
  };

  const LANG_OPTIONS = [
    { code: 'en-IN', label: 'English' },
    { code: 'hi-IN', label: 'हिंदी' },
    { code: 'ta-IN', label: 'Tamil' },
    { code: 'te-IN', label: 'Telugu' }
  ];

  const HINT_BY_LANG = {
    'en-IN': 'Try: "Skip gym today" or "What\'s pending?"',
    'hi-IN': 'Try: "Gym skip karna hai" or "Aaj kya pending hai?"',
    'ta-IN': 'Try: "Gym skip seyyanum" or "Today schedule?"',
    'te-IN': 'Try: "Gym skip cheyyali" or "Today tasks?"'
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[rgba(255,255,255,0.05)]">
        <button onClick={() => { localStorage.setItem('page','dashboard'); window.location.reload(); }}
          className="text-slate-400 hover:text-white">←</button>
        <span className="text-white font-semibold">FlowMind Agent</span>
        <select
          value={langCode}
          onChange={e => setLangCode(e.target.value)}
          className="ml-auto bg-[#1e1e38] border border-[rgba(90,117,244,0.2)] rounded-lg px-2 py-1 text-slate-400 text-xs outline-none"
        >
          {LANG_OPTIONS.map(l => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-slate-600 text-sm mt-20">
            <p className="text-4xl mb-3">🎙️</p>
            <p>Tap the mic or type to talk to FlowMind</p>
            <p className="text-xs mt-1 text-slate-700">{HINT_BY_LANG[langCode] || HINT_BY_LANG['en-IN']}</p>
          </div>
        )}
        {messages.map((msg, i) => {
          if (msg.role === 'system') {
            return (
              <div key={i} className="flex justify-center">
                <span className="text-xs text-green-400/70 bg-green-900/20 px-3 py-1 rounded-full">{msg.text}</span>
              </div>
            );
          }
          return (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-[#5a75f4] text-white rounded-br-sm'
                  : 'bg-[#1e1e38] text-slate-200 rounded-bl-sm border border-[rgba(90,117,244,0.15)]'
              }`}>
                {msg.text}
              </div>
            </div>
          );
        })}
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-[#1e1e38] px-4 py-3 rounded-2xl rounded-bl-sm border border-[rgba(90,117,244,0.15)] flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#5a75f4] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-[#5a75f4] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-[#5a75f4] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Text input fallback + mic button */}
      <div className="p-4 border-t border-[rgba(255,255,255,0.05)] flex items-center gap-3">
        <input
          value={textInput}
          onChange={e => setTextInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSendMessage(textInput)}
          placeholder="Or type here..."
          className="flex-1 bg-[#1e1e38] border border-[rgba(90,117,244,0.2)] rounded-xl px-4 py-2.5 text-slate-200 text-sm placeholder-slate-600 outline-none focus:border-[#5a75f4]"
        />
        <button
          onClick={startListening}
          disabled={isListening || isThinking}
          className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all ${
            isListening
              ? 'bg-red-500 animate-pulse'
              : 'bg-[#5a75f4] hover:bg-[#4a65e4]'
          } disabled:opacity-50`}
        >
          🎙️
        </button>
      </div>
    </div>
  );
}
