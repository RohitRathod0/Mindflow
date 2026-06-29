/**
 * buildDebriefPrompt(completedTasks, missedTasks, userProfile, xpEarned)
 * Returns the Gemini prompt string for end-of-day debrief generation.
 */
function buildDebriefPrompt(completedTasks, missedTasks, userProfile, xpEarned) {
  return `You are FlowMind AI generating an end-of-day debrief.

User Profile:
- Name: ${userProfile.name}
- Persona: ${userProfile.persona}
- Coaching style: ${userProfile.profile.coaching_style}
- Language: ${userProfile.profile.language}

Today's Summary:
- Completed (${completedTasks.length}): ${completedTasks.map(t => t.title).join(', ') || 'none'}
- Missed (${missedTasks.length}): ${missedTasks.map(t => t.title).join(', ') || 'none'}
- XP Earned: ${xpEarned}

Generate a debrief in the user's language with EXACTLY this JSON structure:
{
  "productivity_score": number 0-100 (based on completed/total ratio and task priorities),
  "gemini_tip": "one specific, actionable tip for tomorrow based on what was missed today — persona-aware and coaching-style-aware, max 2 sentences",
  "motivational_line": "one short persona-appropriate closing line"
}

Return ONLY valid JSON, no markdown.`;
}

module.exports = { buildDebriefPrompt };
