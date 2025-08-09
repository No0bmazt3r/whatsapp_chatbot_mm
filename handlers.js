const { parseISO, formatISO } = require('date-fns');
const chrono = require('chrono-node'); // Handles natural language dates
const { toolRunners } = require('./tools');

// ===== Gemini Response Handler =====
async function handleGeminiResponse(geminiResponse, toolsContext) {
    const parts = geminiResponse?.candidates?.[0]?.content?.parts || [];

    if (parts.length === 0) {
        console.log("⚠ Gemini sent an empty response.");
        return;
    }

    for (const part of parts) {
        if (part.functionCall) {
            console.log(" Gemini requested function:", part.functionCall.name, part.functionCall.args);

            const toolName = part.functionCall.name;
            if (toolRunners[toolName]) {
                const result = await toolRunners[toolName](part.functionCall.args, toolsContext);
                console.log(" Function result:", result);
            } else {
                console.warn(`Tool runner for ${toolName} not found.`);
            }
        } else if (part.text) {
            console.log(" Gemini responded with text:", part.text);
        }
    }
}

module.exports = {
    handleGeminiResponse
};