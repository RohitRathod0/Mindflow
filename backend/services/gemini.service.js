const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Call the Gemini API.
 * @param {string} prompt - The prompt to send
 * @param {boolean} jsonMode - If true, requests JSON output with lower temperature
 * @returns {Promise<string|object>} - Parsed JSON object if jsonMode, else text string
 */
async function callGemini(prompt, jsonMode = false) {
  try {
    const generationConfig = jsonMode
      ? {
          responseMimeType: 'application/json',
          temperature: 0.3,
          maxOutputTokens: 500,
        }
      : {};

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig,
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    if (jsonMode) {
      return JSON.parse(text);
    }
    return text;
  } catch (err) {
    console.error('Gemini call error:', err.message);
    throw new Error(`Gemini API error: ${err.message}`);
  }
}

module.exports = { callGemini };
