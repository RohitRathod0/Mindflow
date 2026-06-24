/**
 * Build the Gemini prompt for task priority scoring.
 * @param {Array} tasks - Array of task objects
 * @param {Object} userProfile - User profile object with persona and priority_weights
 * @returns {string} - The constructed prompt string
 */
function buildPrioritizePrompt(tasks, userProfile) {
  const persona = userProfile?.persona || 'mixed';
  const weights = userProfile?.profile?.priority_weights || {
    academics: 0,
    health: 0,
    career: 0,
    social: 0,
  };

  const tasksForPrompt = tasks.map((t) => ({
    task_id: t._id || t.id,
    title: t.title,
    deadline: t.deadline ? new Date(t.deadline).toISOString() : null,
    duration_mins: t.duration_mins,
    energy_level: t.energy_level,
    category: t.category,
  }));

  return `You are FlowMind AI, an intelligent task prioritization assistant. Score each task 0-100 based on:
- Deadline urgency (closer deadline = higher score)
- Energy level (high energy tasks score higher when user has energy)
- Persona priority weights (see below)
- Task duration (shorter tasks may be prioritized for quick wins)

User Persona: ${persona}
Priority Weights:
- Academics: ${weights.academics}
- Health: ${weights.health}
- Career: ${weights.career}
- Social: ${weights.social}

Tasks to score:
${JSON.stringify(tasksForPrompt, null, 2)}

Return ONLY a JSON array with no additional text or explanation:
[
  { "task_id": "<id>", "priority_score": <0-100>, "reason": "<one sentence reason>" },
  ...
]

Example output:
[
  { "task_id": "abc123", "priority_score": 87, "reason": "Deadline is in 2 hours and aligns with high career priority." }
]`;
}

module.exports = { buildPrioritizePrompt };
