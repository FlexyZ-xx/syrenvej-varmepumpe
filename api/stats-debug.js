import { kv } from '@vercel/kv';

// API Key Authentication
const API_KEY = (process.env.API_KEY || 'change-me-in-production').trim();

function authenticate(req) {
    const apiKey = req.headers['x-api-key'];
    return apiKey === API_KEY;
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Authenticate
    if (!authenticate(req)) {
        return res.status(401).json({ error: 'Unauthorized - Invalid API Key' });
    }

    if (req.method === 'GET') {
        try {
            const hasKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
            
            if (!hasKV) {
                return res.status(200).json({
                    error: 'KV not configured',
                    env: {
                        hasUrl: !!process.env.KV_REST_API_URL,
                        hasToken: !!process.env.KV_REST_API_TOKEN
                    }
                });
            }

            // Try to read directly from KV without timeout
            const statsData = await kv.get('arduino:stats');
            
            // Also check all keys
            const allKeys = await kv.keys('arduino:*');
            
            return res.status(200).json({
                success: true,
                kvConfigured: hasKV,
                statsData: statsData,
                statsType: typeof statsData,
                statsIsNull: statsData === null,
                allArduinoKeys: allKeys,
                timestamp: Date.now()
            });
        } catch (error) {
            return res.status(500).json({
                error: 'Failed to read KV',
                message: error.message,
                stack: error.stack
            });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

