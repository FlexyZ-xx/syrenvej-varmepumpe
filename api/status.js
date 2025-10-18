// Simple in-memory storage for Arduino state
// The Arduino will report its state here
let arduinoState = {
    relayState: 'off',
    schedule: null,
    lastUpdate: null
};

// API Key Authentication
const API_KEY = (process.env.API_KEY || 'change-me-in-production').trim();

function authenticate(req) {
    const apiKey = req.headers['x-api-key'];
    return apiKey === API_KEY;
}

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Authenticate all requests
    if (!authenticate(req)) {
        return res.status(401).json({ error: 'Unauthorized - Invalid API Key' });
    }

    if (req.method === 'POST') {
        // Arduino reports its current state
        try {
            const state = req.body;
            
            arduinoState = {
                relayState: state.relayState || 'off',
                schedule: state.schedule || null,
                lastUpdate: Date.now()
            };

            console.log('State updated:', arduinoState);

            return res.status(200).json({ success: true });
        } catch (error) {
            console.error('Error updating state:', error);
            return res.status(500).json({ error: 'Server error' });
        }
    }

    if (req.method === 'GET') {
        // Web interface requests current state
        // Include lastUpdate so UI can check if Arduino is still active
        // Connection timeout: 12 seconds (gives 7s buffer for 5s heartbeat interval)
        return res.status(200).json({
            relayState: arduinoState.relayState,
            schedule: arduinoState.schedule,
            lastUpdate: arduinoState.lastUpdate,
            isConnected: arduinoState.lastUpdate ? (Date.now() - arduinoState.lastUpdate) < 12000 : false
        });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

