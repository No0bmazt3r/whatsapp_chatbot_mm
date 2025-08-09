
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const { MongoClient } = require('mongodb');
const tools = require('./tools'); // Import all tools from the tools directory

// ##################################
// ### INITIALIZE SERVICES & APIS ###
// ##################################

const app = express();
app.use(bodyParser.json());

// --- Rate Limiter ---
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, 
	max: 100, 
	standardHeaders: true,
	legacyHeaders: false,
});
app.use(limiter);

// --- Gemini AI ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- MongoDB ---
const mongoClient = new MongoClient(process.env.MONGO_CONNECTION_STRING);
let db;


// ##################################
// ### SETUP GEMINI MODEL         ###
// ##################################

const generativeModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    systemInstruction: `You are Aida, a helpful and friendly AI assistant for MoneyMatch. You have access to several tools to help users. Call a tool as soon as you have all its required parameters. You may ask for optional parameters if they seem relevant. Assume the user is in Malaysia (UTC+8) and do not ask for timezone information.`,
    tools: { functionDeclarations: [
        {
            name: "business_onboarding",
            description: "Starts the onboarding process for new business clients. For 'preferred_time', extract the full date and time in ISO 8601 format (e.g., '2025-08-09T10:00:00+08:00').",
            parameters: { type: "OBJECT", properties: { 
                business_name: { type: "STRING" }, contact_name: { type: "STRING" }, email: { type: "STRING" }, contact_number: { type: "STRING" }, preferred_time: { type: "STRING" }, estimated_transaction_value: { type: "STRING" }, notes: { type: "STRING" }
            }, required: ["business_name", "contact_name", "email", "contact_number", "preferred_time"] }
        }
    ]},
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ]
});


// ##################################
// ### API ENDPOINT               ###
// ##################################

app.post('/webhook', async (req, res) => {
    const body = req.body;

    try {
        const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

        if (message && message.type === 'text') {
            const userPrompt = message.text.body;
            const sessionId = message.from;

            const history = await db.collection('n8n_chat').find({ sessionId }).sort({ timestamp: 1 }).toArray();
            // Filter history to ensure it starts with 'user' and alternates correctly
            const chatHistoryForModel = [];
            let expectedRole = 'user';
            for (const item of history) {
                if (item.role === expectedRole) {
                    const textContent = item.text || '';
                    chatHistoryForModel.push({ role: item.role, parts: [{ text: textContent }] });
                    expectedRole = (expectedRole === 'user') ? 'model' : 'user'; // Toggle expected role
                } else {
                    console.warn(`Skipping history item with unexpected role: ${item.role}. Expected: ${expectedRole}`);
                }
            }

            const chat = generativeModel.startChat({ history: chatHistoryForModel });

            console.log('Sending user prompt to Gemini:', userPrompt);
            const result = await chat.sendMessage(userPrompt);
            const response = result.response;
            console.log('Gemini initial response object:', JSON.stringify(response, null, 2));

            if (response.functionCalls && response.functionCalls.length > 0) {
                const call = response.functionCalls[0];
                console.log('Gemini requested tool call:', call.name, 'with arguments:', call.args);
                
                // Pass the db object to the tool function if needed
                let apiResponse;
                try {
                    apiResponse = await tools[call.name](call.args, db); 
                    console.log('Tool execution response:', apiResponse);
                } catch (toolError) {
                    console.error('Error during tool execution:', toolError);
                    apiResponse = { success: false, error: toolError.message };
                }

                console.log('Sending tool response back to Gemini...');
                const result2 = await chat.sendMessage([{ functionResponse: { name: call.name, response: apiResponse } }]);
                const finalResponse = result2.response;
                console.log('Gemini final response object after tool call:', JSON.stringify(finalResponse, null, 2));

                const modelResponseText = finalResponse.candidates[0]?.content?.parts[0]?.text;
                if (modelResponseText) {
                    await saveToHistory(sessionId, userPrompt, modelResponseText);
                    res.json({ response: modelResponseText });
                } else {
                    console.warn('Gemini did not return a text response after tool call.');
                    res.json({ response: "I've processed your request, but I don't have a specific text response for you right now." });
                }
            } else {
                console.log('Gemini responded with text:', response.candidates[0].content.parts[0].text);
                const textResponse = response.candidates[0].content.parts[0].text;
                await saveToHistory(sessionId, userPrompt, textResponse);
                res.json({ response: textResponse });
            }
        } else {
            res.status(400).json({ error: "Invalid or non-text message format." });
        }
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Failed to process webhook request.' });
    }
});


// ##################################
// ### HELPER FUNCTIONS           ###
// ##################################

async function saveToHistory(sessionId, userText, modelText) {
    try {
        await db.collection('n8n_chat').insertMany([
            { sessionId, role: 'user', text: userText, timestamp: new Date() },
            { sessionId, role: 'model', text: modelText, timestamp: new Date() }
        ]);
    } catch (error) {
        console.error('Error saving chat history:', error);
    }
}


// ##################################
// ### START SERVER               ###
// ##################################

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    try {
        await mongoClient.connect();
        console.log('Connected to MongoDB');
        db = mongoClient.db(process.env.MONGO_DB_NAME);
    } catch (error) {
        console.error('Failed to connect to MongoDB', error);
        process.exit(1);
    }

    console.log(`Server is running on port ${PORT}`);
});
