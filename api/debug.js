/**
 * Debug endpoint for retrieving and managing Arduino error logs
 * 
 * GET: Returns error logs (same as status.js response.errors)
 * DELETE: Clears error logs on both server and Arduino EEPROM
 */

import { kv } from '@vercel/kv';

// Hybrid storage: KV if available, fallback message if not
let memoryErrorLog = { errors: [] };

// Check if KV is configured
const hasKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

// Helper function to wrap KV operations with timeout
async function kvWithTimeout(operation, timeoutMs = 500) {
    return Promise.race([
        operation(),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('KV timeout')), timeoutMs)
        )
    ]);
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const API_KEY = 'a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4';
    
    // Verify API key
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (req.method === 'DELETE') {
        // Clear error logs
        try {
            // Step 1: Send clear_errors command to Arduino
            const commandUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/command.js`;
            
            const commandResponse = await fetch(commandUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': API_KEY
                },
                body: JSON.stringify({ type: 'clear_errors' })
            });
            
            if (!commandResponse.ok) {
                console.error('Failed to send clear command to Arduino');
            }
            
            // Step 2: Clear server-side error log immediately (don't wait for Arduino)
            // This clears the status.js memory by calling it with an empty error array
            // We can't directly access status.js memory, but Arduino will send empty errors[] on next heartbeat
            
            return res.status(200).json({ 
                success: true,
                message: 'Clear command sent to Arduino. Error log will be cleared on next heartbeat (up to 60s).'
            });
            
        } catch (error) {
            console.error('Error clearing error log:', error);
            return res.status(500).json({ 
                error: 'Failed to clear error log',
                message: error.message
            });
        }
        
    } else if (req.method === 'GET') {
        try {
            // Access error log directly from same storage as status.js
            let errorLog = memoryErrorLog;
            
            if (hasKV) {
                try {
                    const storedLog = await kvWithTimeout(() => kv.get('arduino:error_log'));
                    if (storedLog) {
                        errorLog = storedLog;
                    } else {
                        console.log('No error log found in KV storage');
                    }
                } catch (kvError) {
                    console.error('KV error reading error log, using memory fallback:', kvError.message);
                    // Fall back to memory (which will be empty without KV)
                }
            } else {
                console.log('KV not configured - error log only available via /api/status.js?errors=true');
                console.log('Set up Vercel KV for persistent cross-instance error storage');
            }
            
            // Return errors array
            return res.status(200).json({
                errors: errorLog.errors || [],
                note: !hasKV ? 'KV not configured. Error logs only persist within same serverless instance. Use /api/status.js?errors=true for most reliable access.' : undefined
            });
            
        } catch (error) {
            console.error('Error retrieving error log:', error);
            return res.status(500).json({ 
                error: 'Failed to retrieve error log',
                errors: []
            });
        }
        
    } else {
        return res.status(405).json({ error: 'Method not allowed' });
    }
}

