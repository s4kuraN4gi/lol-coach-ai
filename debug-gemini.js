
// Checked via node --env-file=.env.local
// const dotenv = require("dotenv");
// dotenv.config({ path: '.env.local' });

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("API Key not found in .env.local");
        return;
    }

    /*
    const genAI = new GoogleGenerativeAI(apiKey);
    // listModels is accessible via valid model instance or directly?
    // It's usually easier to just try to instanciate and catch error, 
    // but the library restricts direct listModels access sometimes?
    // Actually standard method is fetch or use the manager.
    // Let's try raw fetch to be sure if library is hiding things.
    */
    
    // Using raw fetch to 'https://generativelanguage.googleapis.com/v1beta/models?key=API_KEY'
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to fetch models: ${response.status} ${response.statusText}`);
            console.error(await response.text());
            return;
        }
        
        const data = await response.json();
        console.log("=== Available Models for this API Key ===");
        if (data.models) {
             data.models.forEach(m => {
                 console.log(`- ${m.name} (${m.supportedGenerationMethods.join(', ')})`);
             });
        } else {
            console.log("No models returned.");
        }
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
