const { parseISO, formatISO } = require('date-fns');
const chrono = require('chrono-node'); // Handles natural language dates

const business_onboarding_declaration = {
    name: "business_onboarding",
    description: "Starts the onboarding process for new business clients. For 'preferred_time', you must convert natural language dates (e.g., \"tomorrow at 10 AM\", \"next Tuesday at 3pm\") into a full ISO 8601 format string including the timezone offset (e.g., '2025-08-10T10:00:00+08:00).",
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
};

const business_onboarding_runner = async (args, { db, calendarClient }) => {
    console.log('Executing business_onboarding tool with args:', args);

    if (!calendarClient) {
        console.warn('Skipping Google Calendar event creation: Calendar client not initialized.');
        return { success: false, message: 'Onboarding processed, but calendar client is not initialized.' };
    }

    if (!process.env.GOOGLE_CALENDAR_ID) {
        console.error('Google Calendar ID not configured in environment variables.');
        return { success: false, message: 'Onboarding processed, but GOOGLE_CALENDAR_ID is not set.' };
    }

    let startTime;
    try {
        // First try ISO parsing
        startTime = parseISO(args.preferred_time);
        if (isNaN(startTime.getTime())) {
            // If invalid, try natural language parsing
            const parsedDate = chrono.parseDate(args.preferred_time, new Date(), { forwardDate: true });
            if (!parsedDate) throw new Error('Could not parse preferred_time');
            startTime = parsedDate;
        }
    } catch (dateError) {
        console.error('Error parsing preferred_time:', dateError);
        return { success: false, message: 'Onboarding processed, but the preferred_time format was invalid.' };
    }

    // Default to a 1-hour meeting
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    const event = {
        summary: `${args.business_name} Business Onboarding`,
        description: `Contact: ${args.contact_name}\nEmail: ${args.email}\nPhone: ${args.contact_number}\nTime: ${args.preferred_time}\nEst. Value: ${args.estimated_transaction_value || 'Not provided'}\nNotes: ${args.notes || 'No additional notes provided.'}`,
        start: {
            dateTime: formatISO(startTime),
            timeZone: 'Asia/Kuala_Lumpur',
        },
        end: {
            dateTime: formatISO(endTime),
            timeZone: 'Asia/Kuala_Lumpur',
        },
        //attendees: [{ email: args.email }], (this wont work due to some issue with google admin api sdk)
        attendees: [],
    };

    try {
        const calendarResponse = await calendarClient.events.insert({
            calendarId: process.env.GOOGLE_CALENDAR_ID,
            resource: event,
            sendNotifications: false,
        });
        console.log('✅ Google Calendar event created:', calendarResponse.data.htmlLink);
        return { success: true, message: `Onboarding for ${args.business_name} is complete and a calendar event has been scheduled.` };
    } catch (calendarError) {
        console.error('❌ Google Calendar Error:', calendarError);
        let errorMessage = 'Onboarding processed, but the calendar event could not be scheduled. ';
        if (calendarError.message.includes('Not Found')) {
            errorMessage += 'The specified calendar was not found. Please check the GOOGLE_CALENDAR_ID and sharing permissions.';
        } else {
            errorMessage += `An unknown error occurred: ${calendarError.message}`;
        }
        return { success: false, message: errorMessage };
    }
};

module.exports = {
    business_onboarding_declaration,
    business_onboarding_runner
};
