'use server';

const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;

export async function listAvailableModels() {
    if (!GEMINI_API_KEY_ENV) {
        return { error: "API Key is missing in environment variables" };
    }
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY_ENV}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            return { error: `API Error (${response.status}): ${errorText}` };
        }

        const data = await response.json();
        return { models: data.models };
    } catch (e: any) {
        return { error: e.message };
    }
}
