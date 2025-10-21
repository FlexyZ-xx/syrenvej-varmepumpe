import { kv } from '@vercel/kv';

// Persistent storage using Vercel KV
// Replaces in-memory storage to survive serverless cold starts

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
            
            const arduinoState = {
                relayState: state.relayState || 'off',
                schedule: state.schedule || null,
                lastUpdate: Date.now()
            };

            // Store in Vercel KV (persistent across cold starts)
            await kv.set('arduino:state', arduinoState);

            console.log('State updated:', arduinoState);

            return res.status(200).json({ success: true });
        } catch (error) {
            console.error('Error updating state:', error);
            return res.status(500).json({ error: 'Server error' });
        }
    }

    if (req.method === 'GET') {
        // Web interface requests current state
        try {
            // Fetch from Vercel KV (persistent storage)
            const arduinoState = await kv.get('arduino:state') || {
                relayState: 'off',
                schedule: null,
                lastUpdate: null
            };
            
            // Connection timeout: 120 seconds (gives 60s buffer for 60s heartbeat interval)
            const isConnected = arduinoState.lastUpdate ? (Date.now() - arduinoState.lastUpdate) < 120000 : false;
            
            return res.status(200).json({
                relayState: arduinoState.relayState,
                schedule: arduinoState.schedule,
                lastUpdate: arduinoState.lastUpdate,
                isConnected: isConnected
            });
        } catch (error) {
            console.error('Error fetching state:', error);
            return res.status(500).json({ error: 'Server error' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

