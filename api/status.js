import { kv } from '@vercel/kv';

// Hybrid storage: KV if available, in-memory as fallback
// This allows the app to work before KV is set up
let memoryState = {
    relayState: 'off',
    schedule: null,
    lastUpdate: null
};

let memoryErrorLog = { errors: [] };

// Track last state and schedule to detect changes
let lastKnownSchedule = null;

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
        // Arduino reports its current state
        try {
            const state = req.body;
            
            const previousState = memoryState.relayState; // Track previous state
            const previousSchedule = lastKnownSchedule; // Track previous schedule
            const newState = state.relayState || 'off';
            const newSchedule = state.schedule || null;
            
            const arduinoState = {
                relayState: newState,
                schedule: newSchedule,
                lastUpdate: Date.now()
            };

            // Try KV first, fallback to memory
            if (hasKV) {
                try {
                    await kvWithTimeout(() => kv.set('arduino:state', arduinoState));
                    console.log('State stored in KV:', arduinoState);
                } catch (kvError) {
                    console.error('KV error, using memory fallback:', kvError.message);
                    memoryState = arduinoState;
                }
            } else {
                memoryState = arduinoState;
                console.log('State stored in memory (KV not configured):', arduinoState);
            }
            
            // Update last known schedule
            lastKnownSchedule = newSchedule;
            
            // Check if relay state changed - log execution to stats
            if (previousState !== newState) {
                console.log(`Relay state changed: ${previousState} → ${newState}`);
                
                // Determine if this was a schedule execution or manual command
                // Multiple detection methods to handle cold starts:
                // 1. Schedule was active before and now it's gone/inactive = schedule executed
                const scheduleClearedAfterUse = previousSchedule && previousSchedule.active && 
                                              (!newSchedule || !newSchedule.active);
                
                // 2. Current report shows schedule just executed (Arduino reports schedule with executed flag or inactive after state change)
                const scheduleJustExecuted = newSchedule && newSchedule.executed === true;
                
                // 3. New schedule exists but is now inactive and matches the action that just happened
                const scheduleInactiveMatchingAction = newSchedule && !newSchedule.active && 
                                                       newSchedule.action === newState;
                
                const wasScheduleExecution = scheduleClearedAfterUse || scheduleJustExecuted || scheduleInactiveMatchingAction;
                
                let commandType = wasScheduleExecution ? 'schedule_executed' : 'manual_executed';
                let commandData = {
                    action: newState,
                    previousState: previousState
                };
                
                if (wasScheduleExecution) {
                    // Build scheduledDateTime from whichever schedule object is available
                    const scheduleRef = previousSchedule || newSchedule;
                    if (scheduleRef) {
                        commandData.scheduledDateTime = scheduleRef.dateTime || 
                                                       `${scheduleRef.year}-${String(scheduleRef.month).padStart(2, '0')}-${String(scheduleRef.day).padStart(2, '0')}T${String(scheduleRef.hour).padStart(2, '0')}:${String(scheduleRef.minute).padStart(2, '0')}:00`;
                        commandData.scheduleAction = scheduleRef.action;
                    }
                }
                
                // Log to stats (fire and forget, don't block Arduino heartbeat)
                try {
                    const statsUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/stats.js`;
                    fetch(statsUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-Key': API_KEY
                        },
                        body: JSON.stringify({
                            eventType: 'command',
                            commandType: commandType,
                            commandData: commandData
                        })
                    }).catch(err => console.error('Failed to log execution to stats:', err));
                } catch (statsError) {
                    console.error('Error logging execution to stats:', statsError);
                }
            }
            
            // Also check if schedule was set (sent from UI)
            if (!previousSchedule && newSchedule && newSchedule.active) {
                console.log('Schedule was set:', newSchedule);
                
                // Log schedule creation to stats
                try {
                    const statsUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/stats.js`;
                    fetch(statsUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-Key': API_KEY
                        },
                        body: JSON.stringify({
                            eventType: 'command',
                            commandType: 'schedule_set',
                            commandData: {
                                action: newSchedule.action,
                                scheduledDateTime: newSchedule.dateTime || 
                                                 `${newSchedule.year}-${String(newSchedule.month).padStart(2, '0')}-${String(newSchedule.day).padStart(2, '0')}T${String(newSchedule.hour).padStart(2, '0')}:${String(newSchedule.minute).padStart(2, '0')}:00`
                            }
                        })
                    }).catch(err => console.error('Failed to log schedule set to stats:', err));
                } catch (statsError) {
                    console.error('Error logging schedule set to stats:', statsError);
                }
            }
            
            // Check if schedule was cancelled
            if (previousSchedule && previousSchedule.active && (!newSchedule || !newSchedule.active) && previousState === newState) {
                console.log('Schedule was cancelled');
                
                // Log schedule cancellation to stats
                try {
                    const statsUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/stats.js`;
                    fetch(statsUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-Key': API_KEY
                        },
                        body: JSON.stringify({
                            eventType: 'command',
                            commandType: 'schedule_cancelled',
                            commandData: {
                                scheduledAction: previousSchedule.action,
                                scheduledDateTime: previousSchedule.dateTime || 
                                                 `${previousSchedule.year}-${String(previousSchedule.month).padStart(2, '0')}-${String(previousSchedule.day).padStart(2, '0')}T${String(previousSchedule.hour).padStart(2, '0')}:${String(previousSchedule.minute).padStart(2, '0')}:00`
                            }
                        })
                    }).catch(err => console.error('Failed to log schedule cancelled to stats:', err));
                } catch (statsError) {
                    console.error('Error logging schedule cancelled to stats:', statsError);
                }
            }

            // Also store error log if included in heartbeat
            if (state.errors && Array.isArray(state.errors)) {
                const errorLog = {
                    errors: state.errors.map(err => ({
                        timestamp: err.timestamp,
                        time: new Date(err.timestamp * 1000).toLocaleString('en-GB', { 
                            timeZone: 'Europe/Copenhagen', 
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit', second: '2-digit',
                            hour12: false
                        }) + ' CEST',
                        message: err.message
                    }))
                };

                if (hasKV) {
                    try {
                        await kvWithTimeout(() => kv.set('arduino:error_log', errorLog));
                        console.log('Error log stored in KV:', errorLog.errors.length, 'errors');
                    } catch (kvError) {
                        console.error('KV error storing error log, using memory fallback:', kvError.message);
                        memoryErrorLog = errorLog;
                    }
                } else {
                    memoryErrorLog = errorLog;
                    console.log('Error log stored in memory:', errorLog.errors.length, 'errors');
                }
            }

            return res.status(200).json({ success: true });
        } catch (error) {
            console.error('Error updating state:', error);
            return res.status(500).json({ error: 'Server error' });
        }
    }

    if (req.method === 'GET') {
        // Web interface requests current state
        try {
            let arduinoState;
            
            // Try KV first, fallback to memory
            if (hasKV) {
                try {
                    arduinoState = await kvWithTimeout(() => kv.get('arduino:state'));
                    if (!arduinoState) {
                        arduinoState = memoryState; // Fallback to memory if KV is empty
                    }
                } catch (kvError) {
                    console.error('KV error, using memory fallback:', kvError.message);
                    arduinoState = memoryState;
                }
            } else {
                arduinoState = memoryState;
            }
            
            // Connection timeout: 90 seconds (gives 30s buffer for 60s heartbeat interval)
            // This detects offline Arduino faster while still being very safe for network delays
            const isConnected = arduinoState.lastUpdate ? (Date.now() - arduinoState.lastUpdate) < 90000 : false;
            
            // Only fetch error log if explicitly requested (via query param)
            // This makes status checks MUCH faster (no extra KV call)
            let errorLog = { errors: [] };
            const includeErrors = req.query?.errors === 'true';
            
            if (includeErrors) {
                errorLog = memoryErrorLog;
                if (hasKV) {
                    try {
                        const storedLog = await kvWithTimeout(() => kv.get('arduino:error_log'));
                        if (storedLog) {
                            errorLog = storedLog;
                        }
                    } catch (kvError) {
                        console.error('KV error reading error log:', kvError.message);
                        // Fall back to memory
                    }
                }
            }
            
            return res.status(200).json({
                relayState: arduinoState.relayState,
                schedule: arduinoState.schedule,
                lastUpdate: arduinoState.lastUpdate,
                isConnected: isConnected,
                errors: errorLog.errors || []  // Include error log only if requested
            });
        } catch (error) {
            console.error('Error fetching state:', error);
            return res.status(500).json({ error: 'Server error' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

