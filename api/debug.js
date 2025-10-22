/**
 * Debug endpoint for Arduino error logs
 * 
 * POST: Arduino sends error logs
 * GET: UI retrieves error logs
 */

import { kv } from '@vercel/kv';

const API_KEY = 'a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4';

// In-memory fallback storage
let memoryErrorLog = { errors: [] };

// Check if KV is configured
const hasKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Verify API key for all requests
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (req.method === 'POST') {
        // Arduino sending error logs
        try {
            const errorLog = req.body;
            
            if (!errorLog || !errorLog.errors || !Array.isArray(errorLog.errors)) {
                return res.status(400).json({ error: 'Invalid error log format' });
            }
            
            // Store error log
            if (hasKV) {
                try {
                    await kv.set('arduino:error_log', errorLog);
                    console.log('Error log stored in KV');
                } catch (kvError) {
                    console.error('KV error, using memory fallback:', kvError);
                    memoryErrorLog = errorLog;
                }
            } else {
                memoryErrorLog = errorLog;
            }
            
            return res.status(200).json({ 
                success: true, 
                message: 'Error log received',
                errorCount: errorLog.errors.length 
            });
            
        } catch (error) {
            console.error('Error processing error log:', error);
            return res.status(500).json({ error: 'Failed to process error log' });
        }
        
    } else if (req.method === 'GET') {
        // UI requesting error logs
        try {
            let errorLog;
            
            // Try to get from KV first, fallback to memory
            if (hasKV) {
                try {
                    errorLog = await kv.get('arduino:error_log');
                    if (!errorLog) {
                        errorLog = memoryErrorLog;
                    }
                } catch (kvError) {
                    console.error('KV error, using memory fallback:', kvError);
                    errorLog = memoryErrorLog;
                }
            } else {
                errorLog = memoryErrorLog;
            }
            
            // Format timestamps for display
            if (errorLog && errorLog.errors) {
                errorLog.errors = errorLog.errors.map(err => ({
                    timestamp: err.timestamp,
                    time: new Date(err.timestamp * 1000).toISOString(),
                    message: err.message
                }));
            }
            
            return res.status(200).json(errorLog || { errors: [] });
            
        } catch (error) {
            console.error('Error retrieving error log:', error);
            return res.status(500).json({ error: 'Failed to retrieve error log' });
        }
        
    } else {
        return res.status(405).json({ error: 'Method not allowed' });
    }
}

