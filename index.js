require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const { MongoClient } = require('mongodb');
const { google } = require('googleapis');
const path = require('path');
const { business_onboarding } = require('./handlers');
const { functionDeclarations, toolRunners } = require('./tools');

// ##################################
// ### INITIALIZE SERVICES & APIS ###
// ##################################

const app = express();
app.use(bodyParser.json());

// --- Gemini AI ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- MongoDB ---
const mongoClient = new MongoClient(process.env.MONGO_CONNECTION_STRING);
let db;

// --- Google Calendar ---
const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, process.env.GOOGLE_CREDENTIALS_PATH),
    scopes: ['https://www.googleapis.com/auth/calendar'],
});
const calendarClient = google.calendar({ version: 'v3', auth });


// ##################################
// ### SETUP GEMINI MODEL         ###
// ##################################

const generativeModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    systemInstruction: `You are Aida, a helpful and friendly AI assistant for MoneyMatch. When a user asks to onboard, first respond with a brief confirmation message (like \"Onboarding scheduled.\") and then immediately call the business_onboarding tool. The current date is ${new Date().toISOString()}. Assume the user is in Malaysia (UTC+8) and do not ask for timezone information.`, // Corrected escaping for internal quotes
    tools: {
        functionDeclarations: [
            {
                name: "business_onboarding",
                description: "Starts the onboarding process for new business clients. For 'preferred_time', you must convert natural language dates (e.g., \"tomorrow at 10 AM\", \"next Tuesday at 3pm\") into a full ISO 8601 format string including the timezone offset (e.g., '2025-08-10T10:00:00+08:00').", // Corrected escaping for internal quotes
                parameters: {
                    type: "OBJECT",
                    properties: { 
                        business_name: { type: "STRING" }, 
                        contact_name: { type: "STRING" }, 
                        email: { type: "STRING" }, 
                        contact_number: { type: "STRING" }, 
                        preferred_time: { type: "STRING" }, 
                        estimated_transaction_value: { type: "STRING" }, 
                        notes: { type: "STRING" }
                    }, 
                    required: ["business_name", "contact_name", "email", "contact_number", "preferred_time"]
                }
            }
        ]
    },

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
            const chatHistoryForModel = [];
            // ... (History processing logic remains the same)

            const chat = generativeModel.startChat({ history: chatHistoryForModel });

            console.log('Sending user prompt to Gemini:', userPrompt);
            const result = await chat.sendMessage(userPrompt);
            const response = result.response;
            console.log('Gemini initial response object:', JSON.stringify(response, null, 2));

            const parts = response?.candidates?.[0]?.content?.parts || [];
            let textResponse = '';
            let finalToolMessage = ''; // New variable to store tool message
            let toolSuccessStatus = false; // Initialize to false

            for (const part of parts) {
                if (part.text) {
                    textResponse += part.text;
                }
                if (part.functionCall) {
                    console.log("Gemini requested function:", part.functionCall.name, part.functionCall.args);
                    const toolName = part.functionCall.name;
                    if (toolRunners[toolName]) {
                        const toolResult = await toolRunners[toolName](part.functionCall.args, { db, calendarClient });
                        console.log("Function result:", toolResult);
                        if (toolResult) { 
                            finalToolMessage = toolResult.message || ''; 
                            toolSuccessStatus = toolResult.success || false; 
                        }
                    } else {
                        console.warn(`Tool runner for ${toolName} not found.`);
                    }
                }
            }

            let responseToSend = textResponse; // Default to Gemini's text response
            let finalSuccessStatus = false; // Default success status for the overall response

            if (finalToolMessage) {
                responseToSend = finalToolMessage; // Override if tool provided a message
                finalSuccessStatus = toolSuccessStatus; // Use tool's success status
            } else if (textResponse) {
                // If no tool message, but there's text from Gemini, assume success for text response
                finalSuccessStatus = true;
            }

            if (responseToSend) {
                await saveToHistory(sessionId, userPrompt, responseToSend);
                res.json({ success: finalSuccessStatus, response: responseToSend }); // Include success status
            } else {
                // Fallback if no text or tool message
                res.json({ success: false, response: "Your request is being processed." });
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