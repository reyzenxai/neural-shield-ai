
const express = require("express");
const cors = require("cors");
const analyzeRoute = require("./routes/analyze");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/analyze", analyzeRoute);

app.get("/", (req, res) => {
  res.json({
    status: "Neural Shield Backend Running",
    version: "1.0.0",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});