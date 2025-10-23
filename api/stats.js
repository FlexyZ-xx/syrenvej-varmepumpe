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
                    stats = await kvWithTimeout(() => kv.get('arduino:stats'));
                    if (!stats) {
                        // Initialize with empty structure if not found
                        stats = { logins: [], commands: [] };
                    }
                } catch (kvError) {
                    console.error('KV error, using memory fallback:', kvError.message);
                    stats = memoryStats;
                }
            } else {
                stats = memoryStats;
            }
            
            // Ensure arrays exist (defensive)
            if (!stats.logins) stats.logins = [];
            if (!stats.commands) stats.commands = [];

            // Calculate summary statistics
            const now = Date.now();
            const last24h = now - (24 * 60 * 60 * 1000);
            const last7d = now - (7 * 24 * 60 * 60 * 1000);

            const logins24h = stats.logins.filter(l => l.timestamp > last24h).length;
            const logins7d = stats.logins.filter(l => l.timestamp > last7d).length;
            const commands24h = stats.commands.filter(c => c.timestamp > last24h).length;
            const commands7d = stats.commands.filter(c => c.timestamp > last7d).length;

            // Get most recent events (last 50 of each)
            const recentLogins = stats.logins.slice(-50).reverse().map(l => ({
                timestamp: l.timestamp,
                time: new Date(l.timestamp).toLocaleString('en-GB', { 
                    timeZone: 'Europe/Copenhagen', 
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                    hour12: false
                }) + ' CEST',
                userAgent: l.userAgent
            }));

            const recentCommands = stats.commands.slice(-50).reverse().map(c => ({
                timestamp: c.timestamp,
                time: new Date(c.timestamp).toLocaleString('en-GB', { 
                    timeZone: 'Europe/Copenhagen', 
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                    hour12: false
                }) + ' CEST',
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

            const userAgent = req.headers['user-agent'] || 'unknown';

            // Load current stats
            let stats;
            let kvLoadFailed = false;  // Track if KV load failed
            if (hasKV) {
                try {
                    stats = await kvWithTimeout(() => kv.get('arduino:stats'));
                    if (!stats) {
                        // Initialize with empty structure (KV is empty, not failed)
                        stats = { logins: [], commands: [] };
                    }
                } catch (kvError) {
                    console.error('KV error loading stats:', kvError.message);
                    kvLoadFailed = true;  // Mark that KV failed
                    stats = memoryStats;  // Use stale memory as fallback (read-only)
                }
            } else {
                stats = memoryStats;
            }
            
            // Ensure arrays exist (defensive)
            if (!stats.logins) stats.logins = [];
            if (!stats.commands) stats.commands = [];

            // Add new event
            const timestamp = Date.now();
            
            if (eventType === 'login') {
                stats.logins.push({
                    timestamp,
                    userAgent
                });
                
                // Keep only last 1000 login entries
                if (stats.logins.length > 1000) {
                    stats.logins = stats.logins.slice(-1000);
                }
            } else if (eventType === 'command') {
                stats.commands.push({
                    timestamp,
                    commandType: commandType || 'unknown',
                    commandData: commandData || {}
                });
                
                // Keep only last 1000 command entries
                if (stats.commands.length > 1000) {
                    stats.commands = stats.commands.slice(-1000);
                }
            }

            // Save updated stats (only if KV load succeeded or we're using in-memory mode)
            if (hasKV && !kvLoadFailed) {
                try {
                    await kvWithTimeout(() => kv.set('arduino:stats', stats));
                    console.log(`${eventType} event logged to KV`);
                    memoryStats = stats;  // Update memory cache after successful KV save
                } catch (kvError) {
                    console.error('KV error saving stats:', kvError.message);
                    // Don't save to memory if KV save fails - avoid overwriting on next attempt
                }
            } else if (!hasKV) {
                memoryStats = stats;
                console.log(`${eventType} event logged to memory`);
            } else {
                // KV load failed - event added to stale memory but not saved
                console.warn(`${eventType} event NOT saved (KV unavailable, avoiding data loss)`);
                memoryStats = stats;  // Update memory for next attempt
            }

            return res.status(200).json({ 
                success: true,
                message: 'Event logged',
                eventType
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
                    await kvWithTimeout(() => kv.set('arduino:stats', emptyStats));
                    console.log('Statistics cleared from KV');
                } catch (kvError) {
                    console.error('KV error clearing stats:', kvError.message);
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

