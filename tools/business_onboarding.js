const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { parseISO, formatISO } = require('date-fns');

// Load Google Calendar credentials
const credentialsPath = path.join(__dirname, '..', 'google-calendar-credentials.json');
let credentials;
try {
    credentials = JSON.parse(fs.readFileSync(credentialsPath));
    console.log('Google Calendar credentials loaded successfully.');
} catch (error) {
    console.error('Error loading Google Calendar credentials:', error.message);
    credentials = null; // Set to null if loading fails
}

let calendarAuth;
let calendarClient;

if (credentials) {
    calendarAuth = new google.auth.GoogleAuth({
        credentials,
        scopes: 'https://www.googleapis.com/auth/calendar',
    });
    calendarClient = google.calendar({
        version: 'v3',
        auth: calendarAuth,
    });
    console.log('Google Calendar API client initialized.');
} else {
    console.warn('Google Calendar API client not initialized due to missing credentials.');
}

const business_onboarding = async (args) => {
    console.log('Executing business_onboarding tool with args:', args);
    return new Promise(async (resolve, reject) => {
        let calendarSuccess = false;
        let message = `Onboarding for ${args.business_name} has been processed.`;

        if (calendarClient) {
            console.log('Attempting to create Google Calendar event...');
            
            // Parse and format preferred_time
            let startTime;
            try {
                startTime = formatISO(parseISO(args.preferred_time));
                console.log('Parsed preferred_time:', startTime);
            } catch (dateError) {
                console.error('Error parsing preferred_time:', dateError);
                message += ' Invalid preferred_time format for calendar event.';
                return resolve({ success: false, error: message });
            }

            // Parse and format preferred_end_time (optional)
            let endTime = startTime; // Default to start time if end time is not provided
            if (args.preferred_end_time) {
                try {
                    endTime = formatISO(parseISO(args.preferred_end_time));
                    console.log('Parsed preferred_end_time:', endTime);
                } catch (dateError) {
                    console.warn('Error parsing preferred_end_time, using preferred_time as end time.', dateError);
                }
            }

            if (startTime) { // Only attempt to create event if start time is valid
                const event = {
                    summary: `${args.business_name} Business Onboarding`,
                    description: `Contact: ${args.contact_name}\nEmail: ${args.email}\nPhone: ${args.contact_number}\nTime: ${args.preferred_time}\nEst. Value: ${args.estimated_transaction_value || 'Not provided'}\nNotes: ${args.notes || 'No additional notes provided.'}`,
                    start: {
                        dateTime: startTime,
                        timeZone: 'Asia/Kuala_Lumpur',
                    },
                    end: {
                        dateTime: endTime, 
                        timeZone: 'Asia/Kuala_Lumpur',
                    },
                    attendees: [{ email: args.email }],
                };

                try {
                    const calendarResponse = await calendarClient.events.insert({
                        calendarId: 'primary', 
                        resource: event,
                    });
                    console.log('Google Calendar event created:', calendarResponse.data.htmlLink);
                    calendarSuccess = true;
                    message += ' A calendar event has been scheduled.';
                } catch (calendarError) {
                    console.error('Google Calendar Error:', calendarError);
                    message += ' Failed to create calendar event.';
                }
            } else {
                console.warn('Skipping Google Calendar event creation: Start time is invalid.');
            }
        } else {
            console.warn('Skipping Google Calendar event creation: Calendar client not initialized.');
        }
        resolve({ success: calendarSuccess, message: message });
    });
};

module.exports = business_onboarding;
