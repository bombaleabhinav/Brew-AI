import { GoogleGenerativeAI } from "@google/generative-ai";

export interface EvaluationResult {
    verdicts: {
        judgeId: string;
        score: number;
        feedback: string[];
        improvement: string;
    }[];
    overallStrengths: string[];
    overallWeaknesses: string[];
    finalText: string;
}

export async function scrapeHackathon(url: string, apiKey: string): Promise<string> {
    try {
        const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                url: url,
                formats: ["markdown"],
            })
        });

        if (!response.ok) {
            throw new Error(`Firecrawl failed: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(`Firecrawl error: ${data.error || "Unknown error"}`);
        }

        return data.data.markdown;
    } catch (error) {
        console.error("Scraping error:", error);
        throw error;
    }
}

const PROMPT_TEMPLATE = (guidelines: string, solution: string) => `
    You are the Head Judge for a Hackathon.
    
    HACKATHON GUIDELINES:
    ${guidelines}
    
    PARTICIPANT SOLUTION:
    ${solution}
    
    Extract key criteria and evaluate. simulate 4 judges.
    
    IMPORTANT: Provide ONLY a valid JSON object. No conversational text.
    
    REQUIRED JSON STRUCTURE:
    {
      "verdicts": [
        {
          "judgeId": "corporate",
          "score": 8,
          "feedback": ["Detailed paragraph..."],
          "improvement": "Actionable strategy..."
        },
        {
          "judgeId": "research",
          "score": 7,
          "feedback": ["Detailed paragraph..."],
          "improvement": "Actionable strategy..."
        },
        {
          "judgeId": "vc",
          "score": 9,
          "feedback": ["Detailed paragraph..."],
          "improvement": "Actionable strategy..."
        },
        {
          "judgeId": "community",
          "score": 6,
          "feedback": ["Detailed paragraph..."],
          "improvement": "Actionable strategy..."
        }
      ],
      "overallStrengths": ["Strength 1 text paragraph", "Strength 2 text paragraph"],
      "overallWeaknesses": ["Weakness 1 text paragraph", "Weakness 2 text paragraph"],
      "finalText": "Comprehensive executive summary paragraph."
    }
  `;

export async function checkConsistencyAndEvaluate(
    guidelines: string,
    solution: string,
    apiKey: string
): Promise<EvaluationResult> {
    const prompt = PROMPT_TEMPLATE(guidelines, solution);
    return await callGemini(prompt, apiKey);
}

async function callGemini(prompt: string, apiKey: string): Promise<EvaluationResult> {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log("Raw Response from Gemini:", text);

        // Find the first '{' and last '}' to extract the core JSON object
        const firstBracket = text.indexOf('{');
        const lastBracket = text.lastIndexOf('}');

        if (firstBracket === -1 || lastBracket === -1) {
            console.error("No JSON brackets found in response.");
            throw new Error("Invalid response format from AI.");
        }

        const jsonString = text.substring(firstBracket, lastBracket + 1);

        try {
            const parsed = JSON.parse(jsonString);

            // Basic validation
            if (!parsed.verdicts || !Array.isArray(parsed.verdicts)) {
                throw new Error("Parsed result missing 'verdicts' array.");
            }

            console.log("Successful Gemini Parse:", parsed);
            return parsed as EvaluationResult;
        } catch (parseErr) {
            console.error("JSON Parse Error. String was:", jsonString);
            throw new Error("Failed to parse evaluation data.");
        }
    } catch (error) {
        console.error("Gemini service error:", error);
        throw error;
    }
}
