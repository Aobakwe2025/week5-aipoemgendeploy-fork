// Load environment variables from .env file
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow frontend to call backend
app.use(express.json()); // Parse JSON request bodies

// Gemini Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "MuseMind backend is running with Gemini API!",
    timestamp: new Date().toISOString(),
  });
});

// Main poem generation endpoint
app.post("/api/generate-poem", async (req, res) => {
  try {
    const { userInput, theme } = req.body;

    // Validate input
    if (!userInput || userInput.trim().length === 0) {
      return res.status(400).json({
        error: "Please provide your feelings or thoughts to generate a poem.",
      });
    }

    // Check if API key exists
    if (!GEMINI_API_KEY) {
      console.error("ERROR: GEMINI_API_KEY not found in .env file!");
      return res.status(500).json({
        error: "Server configuration error. Please contact support.",
      });
    }

    // Build the prompt based on theme
    const prompt = buildPrompt(userInput, theme);

    console.log(
      `Generating ${theme} poem for input: "${userInput.substring(0, 50)}..."`
    );

    // Call Gemini API
    const response = await axios.post(
      GEMINI_API_URL,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.9,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 second timeout
      }
    );

    // Extract generated text from Gemini response
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

    // Clean up the poem
    generatedPoem = cleanPoem(generatedPoem);

    // Return the poem
    res.json({
      success: true,
      poem: generatedPoem,
      theme: theme,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating poem:", error.message);

    // Handle different error types
    if (error.response) {
      // Gemini API error
      const status = error.response.status;
      const errorData = error.response.data;

      console.error("Gemini API Error:", errorData);

      if (status === 400) {
        return res.status(400).json({
          error:
            "Invalid request to AI service. Please try a different prompt.",
        });
      } else if (status === 401 || status === 403) {
        return res.status(500).json({
          error: "Authentication failed. Please check server configuration.",
        });
      } else if (status === 429) {
        return res.status(429).json({
          error: "Too many requests. Please wait a moment and try again.",
          retryAfter: 10,
        });
      } else if (status === 503) {
        return res.status(503).json({
          error:
            "The AI service is temporarily unavailable. Please try again in a moment.",
          retryAfter: 20,
        });
      } else {
        return res.status(500).json({
          error: "Failed to generate poem. Please try again.",
        });
      }
    } else if (error.code === "ECONNABORTED") {
      // Timeout error
      return res.status(504).json({
        error: "Request timed out. Please try again with a shorter prompt.",
      });
    } else {
      // Generic error
      return res.status(500).json({
        error: "An unexpected error occurred. Please try again.",
      });
    }
  }
});

// Helper function to build themed prompts
function buildPrompt(userInput, theme) {
  const themeContexts = {
    lovelines: `You are a romantic poet. Write a beautiful, heartfelt love poem (exactly 5 lines) about: ${userInput}

Requirements:
- Make it sweet, emotional, and expressive
- Focus on feelings of love, affection, and tenderness
- Use romantic and poetic language
- Keep it to exactly 5 lines
- Don't include a title
- Make each line flow naturally

Write the poem now:`,

    moodverse: `You are an emotional poet. Write a deeply emotional poem (exactly 5 lines) that captures these feelings: ${userInput}

Requirements:
- Reflect the mood authentically and powerfully
- Whether joyful, melancholic, anxious, or peaceful - capture it fully
- Use vivid, evocative language
- Keep it to exactly 5 lines
- Don't include a title
- Make each line meaningful

Write the poem now:`,

    soulscript: `You are an inspirational poet. Write an uplifting, reflective affirmation poem (exactly 5 lines) about: ${userInput}

Requirements:
- Make it inspiring, motivational, and soul-nourishing
- Focus on inner strength, personal growth, and positivity
- Use empowering and affirming language
- Keep it to exactly 5 lines
- Don't include a title
- Make each line resonate

Write the poem now:`,
  };

  return themeContexts[theme] || themeContexts["moodverse"];
}

// Helper function to clean up generated poem
function cleanPoem(text) {
  // Remove extra whitespace
  text = text.trim();

  // Remove markdown formatting if present
  text = text.replace(/\*\*/g, "");
  text = text.replace(/\*/g, "");

  // Remove any "Here's" or "Here is" introductions
  text = text.replace(/^(Here's|Here is|Here's a|Here is a).*?:\s*/i, "");

  // Remove any title lines that might be present
  text = text.replace(/^(Title|Poem):.*?\n/gi, "");

  // Split into lines and take only the first 5-6 substantial lines
  let lines = text.split("\n").filter((line) => line.trim().length > 0);

  // If we have more than 6 lines, take the first 5
  if (lines.length > 6) {
    lines = lines.slice(0, 5);
  }

  // Join back together
  text = lines.join("\n");

  return text.trim();
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found. Use POST /api/generate-poem to generate poems.",
  });
});

// Start server
app.listen(PORT, () => {
  console.log("╔═══════════════════════════════════════╗");
  console.log("║     MuseMind Backend Server          ║");
  console.log("║        (Powered by Gemini AI)        ║");
  console.log("╚═══════════════════════════════════════╝");
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
  console.log(
    `✅ API endpoint: POST http://localhost:${PORT}/api/generate-poem`
  );
  console.log("\n📝 Press Ctrl+C to stop the server\n");
});
