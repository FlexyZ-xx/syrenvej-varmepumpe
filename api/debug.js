/**
 * Debug endpoint for retrieving Arduino error logs
 * 
 * Error logs are automatically sent by Arduino with every heartbeat to /api/status.js
 * This endpoint simply retrieves them from the same storage.
 * 
 * GET: UI retrieves error logs
 */

import { kv } from '@vercel/kv';

const API_KEY = 'a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4';

// Check if KV is configured
const hasKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Verify API key
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (req.method === 'GET') {
        // UI requesting error logs
        try {
            let errorLog = { errors: [] };
            
            // Read from KV storage (same place where status.js stores errors)
            if (hasKV) {
                try {
                    const storedLog = await kv.get('arduino:error_log');
                    if (storedLog) {
                        errorLog = storedLog;
                    }
                } catch (kvError) {
                    console.error('KV error reading error log:', kvError);
                    // Return empty errors array if KV fails
                }
            } else {
                console.warn('KV not configured - error logs require Vercel KV to persist across serverless functions');
            }
            
            // Timestamps are already formatted by status.js, just return as-is
            return res.status(200).json(errorLog);
            
        } catch (error) {
            console.error('Error retrieving error log:', error);
            return res.status(500).json({ error: 'Failed to retrieve error log' });
        }
        
    } else {
        return res.status(405).json({ error: 'Method not allowed' });
    }
}

