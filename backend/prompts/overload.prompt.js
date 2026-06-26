/**
 * buildOverloadPrompt(tasks, freeSlotsToday, userProfile)
 * Returns a prompt string for Gemini to triage an overloaded day.
 */
function buildOverloadPrompt(tasks, freeSlotsToday, userProfile) {
  return `User is overloaded. Free slots: ${JSON.stringify(freeSlotsToday)}
Total free time: ${freeSlotsToday.reduce((sum, s) => sum + s.duration_mins, 0)} minutes

Pending tasks:
${tasks.map(t => `- ${t.title} | ${t.category} | ${t.duration_mins}m | deadline: ${t.deadline} | priority: ${t.ai_priority_score}`).join('\n')}

User Profile:
- Persona: ${userProfile.persona}
- Coaching style: ${userProfile.profile.coaching_style}
- Priority weights: ${JSON.stringify(userProfile.profile.priority_weights)}

Layer 1 — Triage: Pick top 2-3 MUST-do tasks today based on deadline urgency and priority score.
Layer 2 — Compress: For each must-do task, suggest minimum viable duration (not full duration_mins).
Layer 3 — Damage Control: Write an honest, persona-appropriate message about the situation and a tomorrow plan.

Return ONLY valid JSON, no markdown:
{
  "must_do": [{ "task_id": "id", "title": "string", "min_duration_mins": number, "reason": "string" }],
  "can_defer": [{ "task_id": "id", "title": "string", "defer_to": "tomorrow" }],
  "damage_control_msg": "honest, persona-aware message to show user",
  "sprint_mode": true | false
}`;
}

module.exports = { buildOverloadPrompt };
