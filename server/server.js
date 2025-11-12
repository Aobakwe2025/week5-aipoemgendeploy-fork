// Load environment variables from .env file
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// API Endpoints

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "MuseMind backend is running with Gemini API!",
    timestamp: new Date().toISOString(),
  });
});

// Gemini Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// Main poem generation
app.post("/api/generate-poem", async (req, res) => {
  try {
    const { userInput, theme } = req.body;

    if (!userInput || userInput.trim().length === 0) {
      return res.status(400).json({
        error: "Please provide your feelings or thoughts to generate a poem.",
      });
    }

    if (!GEMINI_API_KEY) {
      console.error("ERROR: GEMINI_API_KEY not found in .env file!");
      return res.status(500).json({
        error: "Server configuration error. Please contact support.",
      });
    }

    const prompt = buildPrompt(userInput, theme);

    const response = await axios.post(
      GEMINI_API_URL,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );

    let generatedPoem = "";
    if (
      response.data.candidates &&
      response.data.candidates[0] &&
      response.data.candidates[0].content &&
      response.data.candidates[0].content.parts &&
      response.data.candidates[0].content.parts[0]
    ) {
      generatedPoem = response.data.candidates[0].content.parts[0].text;
    } else {
      throw new Error("Unexpected response format from Gemini API");
    }

    generatedPoem = cleanPoem(generatedPoem);

    res.json({
      success: true,
      poem: generatedPoem,
      theme: theme,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating poem:", error.message);
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      console.error("Gemini API Error:", errorData);
      if (status === 400) return res.status(400).json({ error: "Invalid request to AI service." });
      if (status === 401 || status === 403) return res.status(500).json({ error: "Authentication failed." });
      if (status === 429) return res.status(429).json({ error: "Too many requests.", retryAfter: 10 });
      if (status === 503) return res.status(503).json({ error: "Service unavailable.", retryAfter: 20 });
      return res.status(500).json({ error: "Failed to generate poem." });
    } else if (error.code === "ECONNABORTED") {
      return res.status(504).json({ error: "Request timed out." });
    } else {
      return res.status(500).json({ error: "An unexpected error occurred." });
    }
  }
});

// Helper functions
function buildPrompt(userInput, theme) {
  const themeContexts = {
    lovelines: `You are a romantic poet. Write a beautiful, heartfelt love poem (exactly 5 lines) about: ${userInput}\nWrite the poem now:`,
    moodverse: `You are an emotional poet. Write a deeply emotional poem (exactly 5 lines) that captures these feelings: ${userInput}\nWrite the poem now:`,
    soulscript: `You are an inspirational poet. Write an uplifting, reflective affirmation poem (exactly 5 lines) about: ${userInput}\nWrite the poem now:`,
  };
  return themeContexts[theme] || themeContexts["moodverse"];
}

function cleanPoem(text) {
  text = text.trim();
  text = text.replace(/\*\*/g, "").replace(/\*/g, "");
  text = text.replace(/^(Here's|Here is).*?:\s*/i, "");
  text = text.replace(/^(Title|Poem):.*?\n/gi, "");
  let lines = text.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length > 5) lines = lines.slice(0, 5);
  return lines.join("\n").trim();
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found. Use POST /api/generate-poem." });
});

// Serve SPA frontend for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log("╔═══════════════════════════════════════╗");
  console.log("║     MuseMind Backend Server          ║");
  console.log("║        (Powered by Gemini AI)        ║");
  console.log("╚═══════════════════════════════════════╝");
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
  console.log(`✅ API endpoint: POST http://localhost:${PORT}/api/generate-poem`);
});
