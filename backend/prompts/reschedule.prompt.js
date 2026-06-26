/**
 * buildReschedulePrompt(task, reason, freeSlotsToday, freeSlotsTomorrow, userProfile)
 * Returns a prompt string for Gemini to suggest the best reschedule slot.
 */
function buildReschedulePrompt(task, reason, freeSlotsToday, freeSlotsTomorrow, userProfile) {
  return `User skipped: ${task.title} at ${task.scheduled_time || task.deadline}
Reason: ${reason}
Category: ${task.category}
Duration needed: ${task.duration_mins} minutes

User Profile:
- Persona: ${userProfile.persona}
- Sleep time: ${userProfile.profile.sleep_time}
- Coaching style: ${userProfile.profile.coaching_style}
- Priority weights: ${JSON.stringify(userProfile.profile.priority_weights)}

Free slots today: ${JSON.stringify(freeSlotsToday)}
Tomorrow free slots: ${JSON.stringify(freeSlotsTomorrow)}

Rules:
- Emergency reason: never break streak, always find a slot
- Choice reason: reschedule only if slot exists today, else tomorrow
- Forgot reason: reschedule if slot > 30 mins exists, else tomorrow
- Never suggest a slot past user sleep_time
- Prefer slots matching user productive_hours preference

Return ONLY valid JSON, no markdown:
{
  "best_slot": "today_HH:MM" | "tomorrow_HH:MM" | "no_slot",
  "slot_start": "HH:MM",
  "slot_date": "today" | "tomorrow",
  "reason": "one sentence why this slot",
  "streak_impact": "maintained" | "broken" | "emergency_exception",
  "user_message": "conversational message to show user in their language"
}`;
}

module.exports = { buildReschedulePrompt };
