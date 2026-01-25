import { GoogleGenerativeAI } from "@google/generative-ai";

export interface TeamMemberAnalysis {
    username: string;
    topSkills: string[];
    skillSummary: string;
    projectsSummary: string; // Summary of all past projects
    bestProject: { name: string; description: string };
}

export interface TeamFitResult {
    teamMembers: TeamMemberAnalysis[];
    compatibilityScore: number;
    compatibilityGraphData: { skill: string; score: number }[];
    missingSkills: string;
    skillGapAnalysis: string;
}

async function fetchWithFirecrawl(url: string, apiKey: string): Promise<string> {
    try {
        const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                url: url,
                formats: ["markdown"]
            })
        });

        if (!response.ok) return `Failed to scrape ${url}`;
        const data = await response.json();
        return data.success ? data.data.markdown : `Error scraping ${url}`;
    } catch (e) {
        console.error("Firecrawl error:", e);
        return `Failed to scrape ${url}`;
    }
}

async function fetchGithubData(url: string, firecrawlKey?: string) {
    if (firecrawlKey) {
        return await fetchWithFirecrawl(url, firecrawlKey);
    }

    try {
        const parts = url.replace(/\/$/, "").split('/');
        const username = parts[3];
        const repoName = parts[4];

        if (repoName) {
            const response = await fetch(`https://api.github.com/repos/${username}/${repoName}`);
            if (!response.ok) return "No data found";
            const repo = await response.json();
            return JSON.stringify({
                name: repo.name,
                description: repo.description,
                language: repo.language,
                topics: repo.topics
            });
        } else if (username) {
            const response = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=10`);
            if (!response.ok) return "No data found";
            const repos = await response.json();
            return JSON.stringify(repos.map((r: any) => ({
                name: r.name,
                description: r.description,
                language: r.language,
                topics: r.topics
            })));
        }
        return "Invalid link";
    } catch (e) {
        console.error(`Failed to fetch data for ${url}`, e);
        return "Fetch failed";
    }
}

const PROMPT_TEMPLATE = (problemTechStack: string, teamData: string) => `
    You are an expert Technical Architect and Hackathon Mentor.
    
    TARGET PROBLEM / TECH STACK:
    ${problemTechStack}
    
    TEAM DATA (GitHub Projects):
    ${teamData}
    
    Analyze the technical compatibility between this team and the project.
    
    Return a RAW JSON object perfectly matching this structure (NO MARKDOWN WRAPPERS, NO EXPLANATIONS):
    {
      "teamMembers": [
        {
          "username": "string",
          "topSkills": ["string", "string"],
          "skillSummary": "A very detailed paragraph (80-100 words) reviewing their technical expertise, language mastery, and architectural understanding.",
          "projectsSummary": "A very detailed paragraph (80-100 words) summarizing their entire GitHub history/portfolio, identifying persistent themes, complexity levels, and domain experience.",
          "bestProject": { "name": "string", "description": "A detailed paragraph (approx 60 words) explaining why THIS SPECIFIC project is the best evidence for their capability to build the target stack." }
        }
      ],
      "compatibilityScore": number,
      "compatibilityGraphData": [
        { "skill": "Frontend Strategy", "score": number },
        { "skill": "Backend & Scaling", "score": number },
        { "skill": "DevOps & Deployment", "score": number },
        { "skill": "Project Relevance", "score": number }
      ],
      "missingSkills": "A detailed technical analysis paragraph on what is currently missing.",
      "skillGapAnalysis": "Actionable strategic advice on how to bridge the skills gap."
    }
`;

export async function analyzeTeamFit(
    problemTechStack: string,
    githubUrls: string[],
    geminiKey: string,
    firecrawlKey?: string
): Promise<TeamFitResult> {
    const rawMembers = [];

    for (const url of githubUrls) {
        if (!url) continue;
        const data = await fetchGithubData(url, firecrawlKey);
        const parts = url.replace(/\/$/, "").split('/');
        const username = parts[3];

        if (data) {
            rawMembers.push({ username, profileData: data });
        }
    }

    const teamDataString = JSON.stringify(rawMembers, null, 2);
    const prompt = PROMPT_TEMPLATE(problemTechStack, teamDataString);

    try {
        return await callGemini(prompt, geminiKey);
    } catch (e) {
        console.error("Team fit analysis failed:", e);
        throw e;
    }
}

async function callGemini(prompt: string, apiKey: string): Promise<TeamFitResult> {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean markdown code blocks if present
        const jsonString = text.replace(/```json\n?|```/g, "").trim();
        return JSON.parse(jsonString) as TeamFitResult;
    } catch (error) {
        console.error("Gemini evaluation failed:", error);
        throw new Error("Failed to generate valid team fit analysis from Gemini.");
    }
}
