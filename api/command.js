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

            // Store the command in KV for Arduino to pick up
            const pendingCommand = {
                ...command,
                timestamp: Date.now()
            };

            await kv.set('arduino:command', pendingCommand);

            console.log('Command received:', pendingCommand);

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
            const pendingCommand = await kv.get('arduino:command');
            
            if (pendingCommand) {
                // Clear after sending
                await kv.del('arduino:command');
                return res.status(200).json(pendingCommand);
            }

            return res.status(200).json({ type: 'none' });
        } catch (error) {
            console.error('Error fetching command:', error);
            return res.status(500).json({ error: 'Server error' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

