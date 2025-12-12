'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;

export async function listAvailableModels() {
    if (!GEMINI_API_KEY_ENV) {
        console.error("DEBUG: No API Key found");
        return { error: "No API Key" };
    }
    
    try {
        // Use a generic fetch to list models since the SDK might abstract it or default to a version
        // Actually SDK has listModels? No, usually through model manager.
        // Let's try to just hit the API endpoint directly to be sure, or use SDK if possible.
        // The SDK doesn't expose listModels easily on the main entry point in all versions.
        
        // Let's use fetch for raw check
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY_ENV}`);
        const data = await response.json();
        console.log("DEBUG: Available Models:", JSON.stringify(data, null, 2));
        return data;
    } catch (e: any) {
        console.error("DEBUG: Failed to list models", e);
        return { error: e.message };
    }
}
