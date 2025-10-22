/**
 * Debug endpoint for retrieving Arduino error logs
 * 
 * Note: Error logs are now included in /api/status.js GET response.
 * This is a convenience endpoint that returns the same data.
 * 
 * GET: Returns error logs (same as status.js response.errors)
 */

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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
    
    if (req.method === 'GET') {
        try {
            // Call status.js internally to get the latest data (including errors)
            const statusUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/status.js`;
            
            const response = await fetch(statusUrl, {
                headers: {
                    'X-API-Key': API_KEY
                }
            });
            
            if (!response.ok) {
                throw new Error(`Status API returned ${response.status}`);
            }
            
            const data = await response.json();
            
            // Return just the errors array
            return res.status(200).json({
                errors: data.errors || []
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

