'use server';

// Import Google GenAI (Same as analysis.ts)
import { getGeminiClient } from "@/lib/gemini";
import { createClient } from "@/utils/supabase/server";

const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;

type AnalysisRequest = {
    timelineSummary: any; // Simplified timeline data
    apiKey?: string;      // User's provided key (BYOK)
}

export async function analyzeTurningPoints(req: AnalysisRequest) {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const apiKeyToUse = req.apiKey || GEMINI_API_KEY_ENV;

    if (!apiKeyToUse) {
        return { error: "API Key Not Found" };
    }

    try {
        const genAI = getGeminiClient(apiKeyToUse);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
You are a professional League of Legends Coach.
Analyze the following match timeline events and identify the single most critical "Turning Point" where the game was decided.

Timeline Events (Gold Diff & Kills):
${JSON.stringify(req.timelineSummary, null, 2)}

Output Format (JSON):
{
    "timestamp": number, // Time in milliseconds of the turning point
    "reason": "string",  // Detailed explanation of why this was the turning point (Japanese)
    "advice": "string"   // What should have been done differently (Japanese)
}
        `;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Parse JSON from code block
        const jsonMatch = text.match(/```json\n([\s\S]*)\n```/) || text.match(/{[\s\S]*}/);
        
        if (jsonMatch) {
            const jsonStr = jsonMatch[1] || jsonMatch[0];
            return { data: JSON.parse(jsonStr) };
        }

        return { error: "Failed to parse AI response" };

    } catch (e: any) {
        console.error("AI Analysis Error:", e);
        return { error: "AI analysis failed. Please try again later." };
    }
}
