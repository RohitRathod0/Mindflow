# FlowMind AI — Vibe2Ship Hackathon 2025
## PS1: AI-Powered Smart Daily Planner

### Live Demo URL
https://your-app.web.app

### GitHub Repository
https://github.com/your-username/flowmind-ai

### Problem Statement
People waste 20-40 minutes daily deciding what to do next. Existing apps remind you but never act for you. FlowMind AI is a JARVIS-style productivity agent that proactively reschedules, reprioritizes, and motivates — adapting to who you are.

### Google Technologies Used
| Technology | How Used |
|---|---|
| Gemini 2.0 Flash | Task prioritization, intent classification, rescheduling, debrief generation, persona-aware notifications |
| Google Calendar API | OAuth read + write — reads schedule for free slots, writes events on task creation, updates on reschedule |
| Firebase Hosting | Frontend deployment |

### All 8 PS1 Features
| Feature | Implementation |
|---|---|
| Intelligent Task Prioritization | Gemini scores every task 0-100 on deadline, energy level, persona weights |
| AI-Powered Scheduling | Free slot detection from Calendar + Gemini picks best reschedule slot |
| Personalized Recommendations | 3 persona panels (Student Q&A, Gym TTS, Professional email draft) |
| Context-Aware Reminders | Web Push notifications with Gemini-generated persona-aware text |
| Calendar Integration | Google Calendar OAuth — read free slots + write task events |
| Goal & Habit Tracking | XP system, streak counter, weekly progress, level-up |
| Voice-Enabled Assistance | Web Speech API STT + Gemini intent classification + SpeechSynthesis TTS |
| Autonomous Task Planning | Full agent loop: skip → detect overload → triage → reschedule → calendar update |

### Architecture
- Backend: Node.js + Express + MongoDB Atlas
- Frontend: React 18 + Vite + Tailwind CSS
- AI: Gemini 2.0 Flash (prioritize, chat, reschedule, overload, debrief, fast-help prompts)
- Auth: localStorage session (Firebase Auth ready to plug in)
- Notifications: Web Push API + VAPID + node-cron (5 scheduled jobs)
- Voice: Web Speech API (STT + TTS, no external service)

### Agentic Depth
FlowMind implements a full detect → decide → act → confirm loop:
1. User skips task (or voice command)
2. Agent fetches calendar free slots
3. Gemini picks best slot with reason
4. User confirms → DB updated + Calendar event moved
5. Push notification set for new slot

### Demo Script (2 minutes)
1. Onboarding: Select Student persona → rank priorities → set fixed blocks
2. Dashboard: 3 tasks with priority badges → connect Google Calendar → free slots visible
3. Voice: Say 'Skip gym today' → reschedule suggestion → confirm → Calendar updated
4. Overload: 6 tasks, no free time → overload banner → must_do triage
5. Fast Help: Ask study question → Gemini explains in seconds
6. Stats: XP bar, streak counter, weekly progress
7. Debrief: Gemini tip for tomorrow
