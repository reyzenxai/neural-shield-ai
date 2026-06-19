const axios = require("axios");

async function analyzeWithAI(message) {
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "openai/gpt-4o-mini",

      messages: [
        {
          role: "system",
          content: `
You are Neural Shield AI, an expert cybersecurity and fraud detection analyst.

Analyze the user's message and determine whether it is a scam, phishing attempt, fraud, impersonation, malicious link, or legitimate communication.

IMPORTANT RULES:
- Return ONLY valid JSON.
- No markdown.
- No explanation outside JSON.
- scamProbability must be an INTEGER between 0 and 100.
- trustScore must be an INTEGER between 0 and 100.
- High-risk phishing messages should have scamProbability above 80.
- Legitimate messages should have trustScore above 80.

Example:

{
  "scamProbability": 92,
  "trustScore": 8,
  "riskLevel": "High",
  "scamType": "Phishing",
  "redFlags": [
    "Urgent language",
    "Suspicious link",
    "Account impersonation"
  ],
  "explanation": "The message uses urgency and attempts to pressure the user into clicking a link.",
  "recommendation": "Do not click any links. Verify through official channels."
}
`
        },
        {
          role: "user",
          content: message
        }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  const content =
    response.data.choices[0].message.content.trim();

  return JSON.parse(content);
}

module.exports = {
  analyzeWithAI,
};