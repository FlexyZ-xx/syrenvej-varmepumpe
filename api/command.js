// Simple in-memory storage for commands
// In production, you could use Vercel KV for persistence
let pendingCommand = null;

// API Key Authentication
const API_KEY = process.env.API_KEY || 'change-me-in-production';

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
            pendingCommand = {
                ...command,
                timestamp: Date.now()
            };

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
        if (pendingCommand) {
            const cmd = pendingCommand;
            pendingCommand = null; // Clear after sending
            return res.status(200).json(cmd);
        }

        return res.status(200).json({ type: 'none' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

