const express = require("express");
const { analyzeWithAI } = require("../services/aiService");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const result = await analyzeWithAI(message);

    res.json(result);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Analysis failed"
    });
  }
});

module.exports = router;