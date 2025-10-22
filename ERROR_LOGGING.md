# Arduino Error Logging System

## Overview

The Arduino automatically logs all errors to EEPROM flash memory and **automatically sends them with every heartbeat** (every 60 seconds) to the cloud for remote debugging.

**No setup required** - Uses shared memory within the API, works immediately!

## Features

- **Persistent Storage**: Last 10 errors stored in EEPROM (survives reboots)
- **Timestamps**: Each error includes Unix timestamp
- **Circular Buffer**: Oldest errors automatically overwritten
- **Automatic Sync**: Error log sent with every heartbeat (no manual trigger needed)
- **Remote Access**: Retrieve error logs via API without serial console
- **Always Fresh**: Error log updated every 60 seconds automatically
- **No Setup Required**: Works with in-memory storage (no KV needed)

## What Gets Logged

The Arduino automatically logs:
- WiFi connection failures
- WiFi disconnections and reconnection attempts
- HTTP request errors (negative error codes)
- Multiple consecutive HTTP errors
- Initial heartbeat failures after startup
- Reboot triggers (WiFi failures, HTTP errors)

## How to Retrieve Error Logs

### Option 1: Errors Only

```bash
curl https://syrenvej-varmepumpe.vercel.app/api/debug.js \
  -H "X-API-Key: a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4"
```

Returns: `{"errors": [...]}`

### Option 2: Full Status (includes errors)

```bash
curl https://syrenvej-varmepumpe.vercel.app/api/status.js \
  -H "X-API-Key: a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4"
```

Returns: `{"relayState": "on", "schedule": {...}, "isConnected": true, "errors": [...]}`

### Option 3: Clear Error Logs

Clear both server storage and Arduino EEPROM:

```bash
curl -X DELETE https://syrenvej-varmepumpe.vercel.app/api/debug.js \
  -H "X-API-Key: a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4"
```

Returns: `{"success": true, "message": "Clear command sent to Arduino..."}`

**Note**: Arduino polls every 60 seconds, so errors will be cleared within 1 minute.

### Browser Console

```javascript
// Get errors only
fetch('https://syrenvej-varmepumpe.vercel.app/api/debug.js', {
    headers: {
        'X-API-Key': 'a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4'
    }
}).then(r => r.json()).then(console.log);

// Or get full status (includes errors)
fetch('https://syrenvej-varmepumpe.vercel.app/api/status.js', {
    headers: {
        'X-API-Key': 'a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4'
    }
}).then(r => r.json()).then(data => console.log(data.errors));

// Clear error logs (clears both server and Arduino EEPROM)
fetch('https://syrenvej-varmepumpe.vercel.app/api/debug.js', {
    method: 'DELETE',
    headers: {
        'X-API-Key': 'a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4'
    }
}).then(r => r.json()).then(console.log);
```

## Error Log Format

```json
{
  "errors": [
    {
      "timestamp": 1729612345,
      "time": "2025-10-22T14:32:25.000Z",
      "message": "WiFi disconnected (attempt 2/3)"
    },
    {
      "timestamp": 1729612350,
      "time": "2025-10-22T14:32:30.000Z",
      "message": "Poll HTTP error: -11"
    }
  ]
}
```

## Example Errors You Might See

| Error Message | Meaning |
|--------------|---------|
| `WiFi connection failed (attempt X/3)` | WiFi failed to connect during startup |
| `WiFi disconnected (attempt X/3)` | WiFi lost connection during operation |
| `Poll HTTP error: -11` | HTTP request to command API failed |
| `Status report HTTP error: -1` | HTTP request to status API failed |
| `Multiple HTTP errors - reconnecting WiFi` | Too many HTTP failures, forcing WiFi reconnect |
| `WiFi reconnection failed - rebooting` | WiFi reconnection failed, Arduino is rebooting |
| `Initial heartbeat failed (attempt X/3)` | First heartbeat after startup failed |
| `Failed to connect to WiFi after 3 attempts - rebooting` | Complete WiFi failure at startup |

## EEPROM Layout

```
Address 0:    Relay state (1 byte)
Address 10:   Schedule structure (~40 bytes)
Address 100:  Error log buffer (850 bytes)
  - nextIndex: 4 bytes
  - 10 × ErrorLog entries (85 bytes each):
    - timestamp: 4 bytes
    - message: 80 bytes
    - valid: 1 byte
```

## Integration with UI (Optional)

You can add a debug panel to your web UI:

```html
<button onclick="requestDebugLogs()">View Error Logs</button>
<button onclick="clearDebugLogs()">Clear Error Logs</button>
<pre id="errorLogs"></pre>

<script>
const API_KEY = 'a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4';
const API_HOST = 'https://syrenvej-varmepumpe.vercel.app';

async function requestDebugLogs() {
    document.getElementById('errorLogs').textContent = 'Loading...';
    
    const response = await fetch(`${API_HOST}/api/debug.js`, {
        headers: { 'X-API-Key': API_KEY }
    });
    const data = await response.json();
    
    if (data.errors.length === 0) {
        document.getElementById('errorLogs').textContent = 'No errors logged ✅';
    } else {
        document.getElementById('errorLogs').textContent = JSON.stringify(data, null, 2);
    }
}

async function clearDebugLogs() {
    if (!confirm('Clear all error logs from server and Arduino EEPROM?')) {
        return;
    }
    
    document.getElementById('errorLogs').textContent = 'Sending clear command...';
    
    const response = await fetch(`${API_HOST}/api/debug.js`, {
        method: 'DELETE',
        headers: { 'X-API-Key': API_KEY }
    });
    const data = await response.json();
    
    if (data.success) {
        document.getElementById('errorLogs').textContent = 
            'Clear command sent! Errors will be cleared within 60 seconds.\nClick "View Error Logs" to refresh.';
    } else {
        document.getElementById('errorLogs').textContent = 'Error: ' + data.message;
    }
}
</script>
```

## Related Endpoints

For additional monitoring and analytics, see:
- **`/api/stats.js`** - Login and command statistics tracking (see STATS_EXAMPLE.md)
- **`/api/status.js`** - Current system status (includes error logs)

## Notes

- Error logs persist across reboots (stored in EEPROM on Arduino)
- Maximum 10 errors stored (oldest overwritten)
- **Error log automatically sent with every heartbeat (every 60 seconds)**
- Timestamps are Unix timestamps (seconds since 1970)
- Errors are logged before reboots, so you can see what triggered them
- No manual trigger needed - just retrieve from `/api/debug.js` or `/api/status.js` anytime

### How Shared Memory Works

- Error logs stored in-memory within `/api/status.js` serverless function
- Same function handles both POST (Arduino) and GET (user) → memory is shared
- Vercel keeps function instances warm, so memory persists between calls
- If instance cold-starts, Arduino will repopulate errors on next heartbeat (max 60s)
- For persistent storage across all instances, optionally set up Vercel KV (see VERCEL_KV_SETUP.md)


