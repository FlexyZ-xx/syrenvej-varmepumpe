# Arduino Error Logging System

## Overview

The Arduino now automatically logs all errors to EEPROM flash memory and can send them to the cloud for remote debugging.

## Features

- **Persistent Storage**: Last 10 errors stored in EEPROM (survives reboots)
- **Timestamps**: Each error includes Unix timestamp
- **Circular Buffer**: Oldest errors automatically overwritten
- **Remote Access**: Retrieve error logs via API without serial console

## What Gets Logged

The Arduino automatically logs:
- WiFi connection failures
- WiFi disconnections and reconnection attempts
- HTTP request errors (negative error codes)
- Multiple consecutive HTTP errors
- Initial heartbeat failures after startup
- Reboot triggers (WiFi failures, HTTP errors)

## How to Retrieve Error Logs

### Method 1: Trigger Arduino to Send Logs

Send a debug command to make Arduino push its error log:

```bash
curl -X POST https://syrenvej-varmepumpe.vercel.app/api/command.js \
  -H "Content-Type: application/json" \
  -H "X-API-Key: a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4" \
  -d '{"type": "debug"}'
```

Arduino will receive this command on next poll and send its error log to the server.

### Method 2: Retrieve from Server

After Arduino has sent the logs (or anytime to see cached logs):

```bash
curl -X GET https://syrenvej-varmepumpe.vercel.app/api/debug.js \
  -H "X-API-Key: a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4"
```

### Method 3: Browser Console

Open browser console on your web UI and run:

```javascript
// Trigger Arduino to send logs
fetch('https://syrenvej-varmepumpe.vercel.app/api/command.js', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4'
    },
    body: JSON.stringify({type: 'debug'})
});

// Wait ~1 minute for Arduino to poll and send logs, then retrieve:
fetch('https://syrenvej-varmepumpe.vercel.app/api/debug.js', {
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
<pre id="errorLogs"></pre>

<script>
async function requestDebugLogs() {
    const apiKey = 'a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4';
    
    // Trigger Arduino to send logs
    await fetch('https://syrenvej-varmepumpe.vercel.app/api/command.js', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey
        },
        body: JSON.stringify({type: 'debug'})
    });
    
    // Wait for Arduino to send (it polls every 1 minute)
    document.getElementById('errorLogs').textContent = 'Waiting for Arduino to send logs (up to 1 minute)...';
    
    setTimeout(async () => {
        const response = await fetch('https://syrenvej-varmepumpe.vercel.app/api/debug.js', {
            headers: { 'X-API-Key': apiKey }
        });
        const data = await response.json();
        document.getElementById('errorLogs').textContent = JSON.stringify(data, null, 2);
    }, 65000); // Wait 65 seconds
}
</script>
```

## Notes

- Error logs persist across reboots (stored in EEPROM)
- Maximum 10 errors stored (oldest overwritten)
- Arduino polls for debug command every 1 minute
- Timestamps are Unix timestamps (seconds since 1970)
- Errors are logged before reboots, so you can see what triggered them

