import { kv } from '@vercel/kv';

// Hybrid storage: KV if available, in-memory as fallback
// This allows the app to work before KV is set up
let pendingCommand = null;

// Check if KV is configured
const hasKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

// API Key Authentication
const API_KEY = (process.env.API_KEY || 'change-me-in-production').trim();

// Helper function to wrap KV operations with timeout
async function kvWithTimeout(operation, timeoutMs = 500) {
    return Promise.race([
        operation(),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('KV timeout')), timeoutMs)
        )
    ]);
}

function authenticate(req) {
    const apiKey = req.headers['x-api-key'];
    return apiKey === API_KEY;
}

export default async function handler(req, res) {
    // Enable CORS for Arduino
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
        // Web interface sends a command
        try {
            const command = req.body;
            
            // Validate command
            if (!command.type) {
                return res.status(400).json({ error: 'Invalid command' });
            }

            // Store the command for Arduino to pick up
            const cmd = {
                ...command,
                timestamp: Date.now()
            };

            // Try KV first, fallback to memory
            if (hasKV) {
                try {
                    await kvWithTimeout(() => kv.set('arduino:command', cmd));
                    console.log('Command stored in KV:', cmd);
                } catch (kvError) {
                    console.error('KV error, using memory fallback:', kvError.message);
                    pendingCommand = cmd;
                }
            } else {
                pendingCommand = cmd;
                console.log('Command stored in memory (KV not configured):', cmd);
            }

            // Log command to stats (await to ensure it completes before function terminates)
            try {
                const statsUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/stats.js`;
                const statsResponse = await fetch(statsUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': API_KEY
                    },
                    body: JSON.stringify({
                        eventType: 'command',
                        commandType: command.type,
                        commandData: command
                    })
                });
                
                if (!statsResponse.ok) {
                    console.error('Stats logging failed:', statsResponse.status, await statsResponse.text());
                }
            } catch (statsError) {
                // Don't fail the command if stats logging fails
                console.error('Error logging to stats:', statsError);
            }

            return res.status(200).json({ 
                success: true,
                message: 'Command queued'
            });
        } catch (error) {
            console.error('Error processing command:', error);
            return res.status(500).json({ error: 'Server error' });
        }
    }

    if (req.method === 'GET') {
        // Arduino polls for pending command
        try {
            let cmd = null;
            
            // Try KV first, fallback to memory
            if (hasKV) {
                try {
                    cmd = await kvWithTimeout(() => kv.get('arduino:command'));
                    if (cmd) {
                        // Clear after sending
                        await kvWithTimeout(() => kv.del('arduino:command'));
                    } else {
                        // Fallback to memory if KV is empty
                        cmd = pendingCommand;
                        pendingCommand = null;
                    }
                } catch (kvError) {
                    console.error('KV error, using memory fallback:', kvError.message);
                    cmd = pendingCommand;
                    pendingCommand = null;
                }
            } else {
                cmd = pendingCommand;
                pendingCommand = null;
            }
            
            if (cmd) {
                return res.status(200).json(cmd);
            }

            return res.status(200).json({ type: 'none' });
        } catch (error) {
            console.error('Error fetching command:', error);
            return res.status(500).json({ error: 'Server error' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

