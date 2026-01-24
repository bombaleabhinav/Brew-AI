import express from "express";

const app = express();
app.use(express.json());
app.use(express.static("public"));

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "gemma3";

app.post("/contact", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        error: "All fields are required"
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: "Invalid email address"
      });
    }

    // Log the contact form submission (in production, you'd send an email or save to database)
    console.log("Contact Form Submission:", {
      name,
      email,
      subject,
      message,
      timestamp: new Date().toISOString()
    });

    // In a real application, you would:
    // - Send an email notification
    // - Save to a database
    // - Integrate with an email service (SendGrid, Mailgun, etc.)

    res.json({
      success: true,
      message: "Your message has been received. We'll get back to you soon!"
    });

  } catch (err) {
    console.error("CONTACT ERROR:", err.message);
    res.status(500).json({
      error: "Failed to send message",
      detail: err.message
    });
  }
});

app.post("/analyze", async (req, res) => {
  try {
    const { Domain, PS, Solution, TargetUsers, Guidelines } = req.body;

    const prompt = `
You are an expert hackathon judge and startup evaluator.

STRICT RULES:
- Output ONLY valid JSON
- No markdown
- No explanations
- No extra text
- Scores must be integers between 0 and 100

Return EXACTLY this JSON schema:
{
  "Innovation": number,
  "Feasibility": number,
  "ProblemRelevance": number,
  "Impact": number,
  "OverallScore": number,
  "Strengths": string,
  "Weaknesses": string,
  "RiskFactors": string,
  "Suggestions": string
}

Domain: ${Domain}
Problem Statement: ${PS}
Proposed Solution: ${Solution}
Target Users: ${TargetUsers}
Hackathon Guidelines: ${Guidelines}
`;

    const ollamaRes = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false
      })
    });

    const raw = await ollamaRes.json();

    // 🔍 DEBUG (keep this during development)
    console.log("RAW OLLAMA RESPONSE:\n", raw);

    // 🛡️ Extract text safely
    const text =
      raw.response ||
      raw.message?.content ||
      raw.output ||
      "";

    if (!text) {
      throw new Error("Empty response from Ollama");
    }

    // 🧹 Clean JSON (remove accidental text before/after)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in model output");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // ✅ Final validation (prevents frontend crashes)
    const requiredFields = [
      "Innovation",
      "Feasibility",
      "ProblemRelevance",
      "Impact",
      "OverallScore",
      "Strengths",
      "Weaknesses",
      "RiskFactors",
      "Suggestions"
    ];

    for (const field of requiredFields) {
      if (!(field in parsed)) {
        throw new Error(`Missing field: ${field}`);
      }
    }

    res.json(parsed);

  } catch (err) {
    console.error("ANALYZE ERROR:", err.message);
    res.status(500).json({
      error: "AI evaluation failed",
      detail: err.message
    });
  }
});

app.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});
