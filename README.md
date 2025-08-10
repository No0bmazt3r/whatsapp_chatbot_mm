# WhatsApp Chatbot with Gemini AI and Google Calendar Integration

This project implements a WhatsApp chatbot powered by Google's Gemini AI, capable of engaging in conversations, maintaining chat history via MongoDB, and scheduling business onboarding meetings by integrating with Google Calendar. The application is designed for easy deployment using Docker Compose.

## Features

*   **WhatsApp Integration:** Communicates with users via WhatsApp webhooks.
*   **Gemini AI:** Utilizes Google's Gemini 1.5 Flash model for natural language understanding and response generation.
*   **Tool Use:** Leverages Gemini's function calling capabilities to interact with external services.
*   **Google Calendar Integration:** Automatically schedules business onboarding meetings, including attendee invitations (with proper setup).
*   **MongoDB Chat History:** Persists conversation history to provide context for ongoing interactions.
*   **Dockerized Deployment:** Easy setup and management using Docker Compose.
*   **Robust Error Handling:** Provides clear error messages for easier debugging.

## Prerequisites

Before you begin, ensure you have the following installed and configured:

*   **Node.js & npm:** [Download & Install Node.js](https://nodejs.org/en/download/) (includes npm).
*   **Docker & Docker Compose:** [Download & Install Docker Desktop](https://www.docker.com/products/docker-desktop/).
*   **Google Cloud Project:**
    *   A Google Cloud Project with the **Gemini API** enabled.
    *   The **Google Calendar API** enabled.
    *   A **Service Account** created with the necessary permissions (see setup below).
*   **Google Workspace Account:** Required if you intend to use **Domain-Wide Delegation** for sending calendar invitations.
*   **MongoDB Atlas Account (or local MongoDB):** A MongoDB database to store chat history.

## Setup Guide

Follow these steps to get your chatbot up and running:

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd whatsapp_chatbot_mm
```

### 2. Environment Variables (`.env` file)

Create a file named `.env` in the root directory of your project. This file will store your sensitive API keys and configuration details.

Copy the content from `.env.example` and fill in your details:

```env
# Your Google Gemini API Key
GEMINI_API_KEY=YOUR_GEMINI_API_KEY

# MongoDB Connection String (e.g., from MongoDB Atlas)
MONGO_CONNECTION_STRING=mongodb+srv://<user>:<password>@<cluster-url>/<database>?retryWrites=true&w=majority

# MongoDB Database Name for chat history
MONGO_DB_NAME=n8n_chat

# Port for the Node.js server to listen on
PORT=3000

# Your Google Calendar ID (usually your Google email address for your primary calendar)
GOOGLE_CALENDAR_ID=your.email@example.com

# Path to your Google Service Account JSON key file (e.g., ./google-credentials.json)
GOOGLE_CREDENTIALS_PATH=./google-credentials.json
```

**Important:** Replace the placeholder values with your actual credentials.

### 3. Google Calendar API Setup

This is a critical step for the calendar integration.

#### a. Create a Google Service Account

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Select your project.
3.  Navigate to **IAM & Admin > Service Accounts**.
4.  Click **"+ CREATE SERVICE ACCOUNT"**.
5.  Give it a name (e.g., `whatsapp-chatbot-calendar`) and description.
6.  In the "Grant this service account access to project" step, you can optionally grant it a role like `Editor` or a more specific role if you understand IAM permissions well (e.g., `Calendar Editor`). For simplicity, `Editor` is often used in development.
7.  In the "Grant users access to this service account" step, click **"DONE"**.
8.  Once created, click on the service account's email address.
9.  Go to the **"Keys"** tab.
10. Click **"ADD KEY" > "Create new key"**.
11. Select **"JSON"** as the key type and click **"CREATE"**.
12. A JSON file will be downloaded. **Rename this file to `google-credentials.json`** and place it directly in your project's root directory (`whatsapp_chatbot_mm/`).

#### b. Share Your Google Calendar with the Service Account

Your service account needs explicit permission to access your Google Calendar.

1.  Go to [Google Calendar](https://calendar.google.com/).
2.  On the left sidebar, hover over the calendar you want the bot to manage (e.g., your primary calendar).
3.  Click the three vertical dots next to the calendar name and select **"Settings and sharing"**.
4.  Scroll down to the **"Share with specific people or groups"** section.
5.  Click **"Add people and groups"**.
6.  In the "Email" field, paste the `client_email` from your `google-credentials.json` file. This email typically looks like `your-service-account-name@your-project-id.iam.gserviceaccount.com`.
    *   For example: `whatsapp-chatbot-calendar@weighty-forest-467414-i7.iam.gserviceaccount.com`
7.  In the "Permissions" dropdown, select **"Make changes to events"**.
8.  Click **"Send"**.

#### c. Domain-Wide Delegation (DWD) for Sending Invitations (Optional but Recommended)

**Why is this needed?**
By default, a service account cannot send email invitations to attendees because it doesn't "own" an email address in the same way a human user does. To send invitations, the service account needs to "impersonate" a user within your Google Workspace domain. This advanced permission is granted via Domain-Wide Delegation.

**Prerequisites for DWD:**
*   You must have a Google Workspace account.
*   You must have administrator access to your Google Workspace Admin console.

**Steps to Set Up DWD:**

1.  **Enable Admin SDK API:**
    *   Go to the [Google Cloud Console](https://console.cloud.google.com/).
    *   Select your project.
    *   Navigate to **APIs & Services > Library**.
    *   Search for "Admin SDK API" and enable it.

2.  **Get Service Account Client ID:**
    *   Open your `google-credentials.json` file.
    *   Copy the value of `client_id`.
    *   Your Client ID is: `110747823205472743192`

3.  **Go to Google Workspace Admin Console:**
    *   Open a new browser tab and go to: [https://admin.google.com/](https://admin.google.com/)
    *   Sign in with your Google Workspace administrator account.

4.  **Navigate to API Controls:**
    *   From the Admin console Home page, go to **Security > Access and data control > API controls**.
    *   Find the section titled **"Domain-wide delegation"**.
    *   Click on **"Manage Domain-wide Delegation"**.

5.  **Add a New API Client:**
    *   Click on **"Add new"**.
    *   In the "Client ID" field, paste your Service Account's Client ID (from step 2):
        `110747823205472743192`
    *   In the "OAuth scopes (comma-delimited)" field, paste the following scopes exactly as they appear (no spaces):
        `https://www.googleapis.com/auth/calendar,https://www.googleapis.com/auth/calendar.events`
    *   Click **"Authorize"**.

### 4. Install Node.js Dependencies

```bash
npm install
```

## Running the Application

### Using Docker Compose (Recommended)

This is the easiest way to run the application consistently across different environments.

1.  **Build and Run (first time or after code changes):**
```bash
docker compose up --build
```
This command builds your Docker image (if new or changed) and starts your application.

2.  **Run (after initial build):**
    If you haven't changed your `Dockerfile` or `package.json` since the last build, you can just run:
```bash
docker compose up
```
This will start your application using the existing image.

3.  **Stop and Remove Containers:**
    To stop your application and remove the Docker containers, run:
```bash
docker compose down
```

Your application should now be accessible via `http://localhost:3000` (or the `PORT` you configured in your `.env` file).

## Application Flow (How it Works)

1.  **User Interaction:** A user sends a message to your WhatsApp chatbot.
2.  **Webhook Trigger:** Your WhatsApp Business API (or a similar platform) forwards this message to your application's `/webhook` endpoint.
3.  **Chat History Retrieval:** The application fetches the user's previous conversation history from MongoDB to provide context to the AI.
4.  **Gemini AI Processing:** The user's prompt and the chat history are sent to the Gemini AI model. The model is instructed to:
    *   Assume the user is in Malaysia (UTC+8).
    *   Use the current date for relative time expressions (e.g., "tomorrow").
    *   Provide a brief text confirmation before calling any tools.
5.  **Tool Execution (e.g., `business_onboarding`):**
    *   If Gemini determines a tool needs to be called (e.g., for a business onboarding request), it sends a `functionCall` to the application.
    *   The `handleGeminiResponse` function dispatches this call to the appropriate tool runner (e.g., `business_onboarding_runner` in `handlers.js`).
    *   The `business_onboarding_runner` then interacts with the Google Calendar API to schedule the meeting.
6.  **Response Generation:**
    *   The application captures the result (success/failure message) from the tool execution.
    *   This result, along with any initial text response from Gemini, is formatted into the final message sent back to the user via WhatsApp.
7.  **History Storage:** The user's prompt and the AI's response are saved back into MongoDB to maintain conversation continuity.

## Troubleshooting

*   **`Error: listen EADDRINUSE: address already in use :::3000`**:
    *   This means another process is already using port 3000.
    *   If running locally, ensure no other application is using the port. `nodemon` (used by `npm start`) usually handles this by restarting, but if a previous process crashed, you might need to manually kill it.
    *   If using Docker, ensure no other Docker container is using the port. `docker compose down` should clear previous runs.

*   **`Error: Could not load the default credentials`**:
    *   **File Not Found:** Ensure `google-credentials.json` is in the project root and `GOOGLE_CREDENTIALS_PATH` in `.env` is set to `./google-credentials.json`.
    *   **File Permissions:** On Windows, ensure the Node.js process has read access to `google-credentials.json`. Right-click the file > Properties > Security tab > ensure your user has "Read" permissions.
    *   **Invalid JSON:** Verify the content of `google-credentials.json` is valid JSON and a correct service account key.

*   **`Service accounts cannot invite attendees without Domain-Wide Delegation of Authority`**:
    *   This means your service account is trying to send email invitations but lacks the necessary "Domain-Wide Delegation" permission in your Google Workspace Admin console.
    *   Refer to **"3.c. Domain-Wide Delegation (DWD) for Sending Invitations"** in the Setup Guide to configure this.

*   **`Gemini responded with text: undefined` or generic errors**:
    *   This indicates an issue within the tool execution or response handling.
    *   Check your console logs for more specific error messages (e.g., `❌ Google Calendar Error:`). The application is designed to provide detailed errors in the console.
