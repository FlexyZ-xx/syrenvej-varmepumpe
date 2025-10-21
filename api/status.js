import { kv } from '@vercel/kv';

// Hybrid storage: KV if available, in-memory as fallback
// This allows the app to work before KV is set up
let memoryState = {
    relayState: 'off',
    schedule: null,
    lastUpdate: null
};

// Check if KV is configured
const hasKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

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

            // Try KV first, fallback to memory
            if (hasKV) {
                try {
                    await kv.set('arduino:state', arduinoState);
                    console.log('State stored in KV:', arduinoState);
                } catch (kvError) {
                    console.error('KV error, using memory fallback:', kvError);
                    memoryState = arduinoState;
                }
            } else {
                memoryState = arduinoState;
                console.log('State stored in memory (KV not configured):', arduinoState);
            }

            return res.status(200).json({ success: true });
        } catch (error) {
            console.error('Error updating state:', error);
            return res.status(500).json({ error: 'Server error' });
        }
    }

    if (req.method === 'GET') {
        // Web interface requests current state
        try {
            let arduinoState;
            
            // Try KV first, fallback to memory
            if (hasKV) {
                try {
                    arduinoState = await kv.get('arduino:state');
                    if (!arduinoState) {
                        arduinoState = memoryState; // Fallback to memory if KV is empty
                    }
                } catch (kvError) {
                    console.error('KV error, using memory fallback:', kvError);
                    arduinoState = memoryState;
                }
            } else {
                arduinoState = memoryState;
            }
            
            // Connection timeout: 90 seconds (gives 30s buffer for 60s heartbeat interval)
            // This detects offline Arduino faster while still being very safe for network delays
            const isConnected = arduinoState.lastUpdate ? (Date.now() - arduinoState.lastUpdate) < 90000 : false;
            
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

