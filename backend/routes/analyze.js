const express = require("express");

const router = express.Router();

router.post("/", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({
      error: "Message is required",
    });
  }

  // Temporary fake analysis
  res.json({
    scamProbability: 72,
    trustScore: 28,
    riskLevel: "High",
    scamType: "Phishing Attempt",
    redFlags: [
      "Urgent language detected",
      "Suspicious request",
      "Potential impersonation"
    ],
    explanation:
      "The message contains common phishing indicators.",
    recommendation:
      "Do not click links or share personal information."
  });
});

module.exports = router;