import { kv } from '@vercel/kv';

/**
 * Statistics endpoint for tracking login and command activity
 * 
 * GET: Returns login and command statistics
 * POST: Log a new event (login or command)
 * DELETE: Clear all statistics
 */

// In-memory fallback storage
let memoryStats = {
    logins: [],
    commands: []
};

// Check if KV is configured
const hasKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

// API Key Authentication
const API_KEY = (process.env.API_KEY || 'change-me-in-production').trim();

function authenticate(req) {
    const apiKey = req.headers['x-api-key'];
    return apiKey === API_KEY;
}

// Extract client IP address
function getClientIP(req) {
    // Try various headers that contain client IP
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // x-forwarded-for can contain multiple IPs, get the first one
        return forwarded.split(',')[0].trim();
    }
    
    return req.headers['x-real-ip'] || 
           req.socket?.remoteAddress || 
           'unknown';
}

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Authenticate all requests
    if (!authenticate(req)) {
        return res.status(401).json({ error: 'Unauthorized - Invalid API Key' });
    }

    if (req.method === 'GET') {
        // Retrieve statistics
        try {
            let stats;
            
            // Try KV first, fallback to memory
            if (hasKV) {
                try {
                    stats = await kv.get('arduino:stats');
                    if (!stats) {
                        stats = memoryStats;
                    }
                } catch (kvError) {
                    console.error('KV error, using memory fallback:', kvError);
                    stats = memoryStats;
                }
            } else {
                stats = memoryStats;
            }

            // Calculate summary statistics
            const now = Date.now();
            const last24h = now - (24 * 60 * 60 * 1000);
            const last7d = now - (7 * 24 * 60 * 60 * 1000);

            const logins24h = stats.logins.filter(l => l.timestamp > last24h).length;
            const logins7d = stats.logins.filter(l => l.timestamp > last7d).length;
            const commands24h = stats.commands.filter(c => c.timestamp > last24h).length;
            const commands7d = stats.commands.filter(c => c.timestamp > last7d).length;

            // Get unique IPs
            const uniqueIPs = new Set([
                ...stats.logins.map(l => l.ip),
                ...stats.commands.map(c => c.ip)
            ]);

            // Get most recent events (last 50 of each)
            const recentLogins = stats.logins.slice(-50).reverse().map(l => ({
                timestamp: l.timestamp,
                time: new Date(l.timestamp).toISOString(),
                ip: l.ip,
                userAgent: l.userAgent
            }));

            const recentCommands = stats.commands.slice(-50).reverse().map(c => ({
                timestamp: c.timestamp,
                time: new Date(c.timestamp).toISOString(),
                ip: c.ip,
                commandType: c.commandType,
                commandData: c.commandData
            }));

            // Command type breakdown
            const commandTypes = {};
            stats.commands.forEach(c => {
                const type = c.commandType || 'unknown';
                commandTypes[type] = (commandTypes[type] || 0) + 1;
            });

            return res.status(200).json({
                summary: {
                    totalLogins: stats.logins.length,
                    totalCommands: stats.commands.length,
                    uniqueIPs: uniqueIPs.size,
                    logins24h,
                    logins7d,
                    commands24h,
                    commands7d,
                    commandTypeBreakdown: commandTypes
                },
                recentLogins,
                recentCommands,
                storage: hasKV ? 'vercel-kv' : 'in-memory'
            });

        } catch (error) {
            console.error('Error fetching statistics:', error);
            return res.status(500).json({ 
                error: 'Server error',
                message: error.message
            });
        }
    }

    if (req.method === 'POST') {
        // Log a new event
        try {
            const { eventType, commandType, commandData } = req.body;
            
            if (!eventType || (eventType !== 'login' && eventType !== 'command')) {
                return res.status(400).json({ error: 'Invalid eventType (must be "login" or "command")' });
            }

            const clientIP = getClientIP(req);
            const userAgent = req.headers['user-agent'] || 'unknown';

            // Load current stats
            let stats;
            if (hasKV) {
                try {
                    stats = await kv.get('arduino:stats');
                    if (!stats) {
                        stats = memoryStats;
                    }
                } catch (kvError) {
                    console.error('KV error loading stats:', kvError);
                    stats = memoryStats;
                }
            } else {
                stats = memoryStats;
            }

            // Add new event
            const timestamp = Date.now();
            
            if (eventType === 'login') {
                stats.logins.push({
                    timestamp,
                    ip: clientIP,
                    userAgent
                });
                
                // Keep only last 1000 login entries
                if (stats.logins.length > 1000) {
                    stats.logins = stats.logins.slice(-1000);
                }
            } else if (eventType === 'command') {
                stats.commands.push({
                    timestamp,
                    ip: clientIP,
                    commandType: commandType || 'unknown',
                    commandData: commandData || {}
                });
                
                // Keep only last 1000 command entries
                if (stats.commands.length > 1000) {
                    stats.commands = stats.commands.slice(-1000);
                }
            }

            // Save updated stats
            if (hasKV) {
                try {
                    await kv.set('arduino:stats', stats);
                    console.log(`${eventType} event logged to KV from IP ${clientIP}`);
                } catch (kvError) {
                    console.error('KV error saving stats:', kvError);
                    memoryStats = stats;
                }
            } else {
                memoryStats = stats;
                console.log(`${eventType} event logged to memory from IP ${clientIP}`);
            }

            return res.status(200).json({ 
                success: true,
                message: 'Event logged',
                eventType,
                ip: clientIP
            });

        } catch (error) {
            console.error('Error logging event:', error);
            return res.status(500).json({ 
                error: 'Server error',
                message: error.message
            });
        }
    }

    if (req.method === 'DELETE') {
        // Clear all statistics
        try {
            const emptyStats = {
                logins: [],
                commands: []
            };

            if (hasKV) {
                try {
                    await kv.set('arduino:stats', emptyStats);
                    console.log('Statistics cleared from KV');
                } catch (kvError) {
                    console.error('KV error clearing stats:', kvError);
                    memoryStats = emptyStats;
                }
            } else {
                memoryStats = emptyStats;
                console.log('Statistics cleared from memory');
            }

            return res.status(200).json({ 
                success: true,
                message: 'All statistics cleared'
            });

        } catch (error) {
            console.error('Error clearing statistics:', error);
            return res.status(500).json({ 
                error: 'Server error',
                message: error.message
            });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

