# Syrenvej6 Heat Pump Relay Controller

Simple web interface to control a relay connected to an ESP32/Arduino via the cloud.

## 📚 Documentation Index

- **[README.md](README.md)** (this file) - Main documentation and setup guide
- **[STATS_EXAMPLE.md](STATS_EXAMPLE.md)** - Statistics tracking and usage analytics
- **[ERROR_LOGGING.md](ERROR_LOGGING.md)** - Arduino error logging and debugging
- **[VERCEL_KV_SETUP.md](VERCEL_KV_SETUP.md)** - Optional Upstash Redis (KV) persistent storage setup

## Quick Overview

- **Web Interface**: https://syrenvej-varmepumpe.vercel.app
- **Password**: Check `public/auth.js` for current password
- **Features**: Manual ON/OFF toggle + Schedule control + Error logging
- **Hardware**: ESP32 + Soldered I2C Relay Board

### Arduino LED Quick Reference
- 🟢 **Green (blinking)** = ✅ All good! Normal operation
- 🟣 **Purple** = Starting up
- 🟡 **Yellow** = WiFi connected, syncing time
- 🔴 **Red** = ⚠️ Error (WiFi/HTTP), auto-retrying

## How It Works

```
Web Browser → Vercel API → Arduino (polls every 60s) → Relay → Heat Pump
```

- Arduino only makes outgoing HTTPS requests (no open ports)
- All state stored locally on Arduino EEPROM
- Web interface shows real-time connection status
- Error logs automatically synced every heartbeat
- Automatic WiFi reconnection and reboot on failures

## Setup

### 1. Deploy to Vercel (Already Done)

The app is already deployed at: https://syrenvej-varmepumpe.vercel.app

### 2. Arduino Setup

#### Required Libraries:
1. **ESP32 Board Support**
   - In Arduino IDE: File → Preferences
   - Add URL: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Tools → Board Manager → Install "ESP32 by Espressif"

2. **ArduinoJson Library**
   - Sketch → Include Library → Manage Libraries
   - Install "ArduinoJson by Benoit Blanchon"

3. **Relay-SOLDERED Library**
   - Sketch → Include Library → Manage Libraries
   - Install "Relay board-SOLDERED"

#### Configure Arduino:
1. Open `arduino/syrenvej_varmepumpe/syrenvej_varmepumpe.ino`
2. Edit WiFi credentials:
   ```cpp
   const char* WIFI_SSID = "Your_WiFi_Name";
   const char* WIFI_PASSWORD = "Your_WiFi_Password";
   ```
3. Upload to ESP32

### 3. Hardware Wiring

**Soldered I2C Relay Board:**
```
ESP32 Pin    →    Relay Board
──────────────────────────────
3.3V         →    VCC
GND          →    GND
GPIO21 (SDA) →    SDA
GPIO22 (SCL) →    SCL
```

**Relay Connections:**
- **NO**    → Default closed → Heat pump control wire
- **COM**   → Heat pump power source
- **NC**    → Default open → Heat pump control wire

### 4. Arduino LED Status Indicators

The Arduino provides visual feedback through its LED to show operational status:

#### RGB LED (WS2812) - Default
- 🟣 **PURPLE (solid)** - Starting up / Initializing
- 🟡 **YELLOW (solid)** - WiFi connected, waiting for time sync
- 🟢 **GREEN (blinking)** - Normal operation (loop running, all good!)
- 🔴 **RED (solid)** - Error/retry state (WiFi or HTTP errors)

#### Built-in LED (STATIC_LED) - Alternative
- ⚡ **BLINKING FAST (100ms)** - Starting up / Error/retry state
- 💚 **BLINKING SLOW (1000ms)** - Normal operation

**LED Type Configuration:**
```cpp
// In syrenvej_varmepumpe.ino (lines 31-32):
#define RGB_LED      // WS2812 RGB LED (default)
// #define STATIC_LED   // Uncomment to use built-in LED
```

**What Each Color Means:**

| LED Color | Status | Action Needed |
|-----------|--------|---------------|
| 🟣 Purple | Starting up | Wait a few seconds |
| 🟡 Yellow | WiFi connected | Syncing time, wait 5-10s |
| 🟢 Green (blinking) | ✅ **All Good!** | Normal operation |
| 🔴 Red | ⚠️ Error | Check WiFi/network, will auto-retry |

**Startup Sequence:**
1. 🟣 Purple → Power on / Initialization
2. 🟡 Yellow → WiFi connected
3. 🟢 Green blinking → Ready and running!

**If LED stays Red:**
- WiFi connection failed → Check credentials
- HTTP errors → Check network/API
- Arduino auto-retries 3 times, then reboots

## Web Interface

### Status Indicators:
- 🟢 **Connected** - Arduino heartbeat received (< 90 seconds)
- 🔴 **Not Connected** - No heartbeat from Arduino (> 90 seconds)
- 🔵 **Waiting...** - Processing command (controls disabled)
- ⏱️ **Active now / Xs ago** - Time since last Arduino heartbeat

### Features:
1. **Manual Control** - Toggle relay ON/OFF immediately
2. **Schedule** - Set future ON/OFF action (date + time)
   - ⏰ **Automatic DST**: Schedules automatically adjust for summer/winter time (CET/CEST)
   - Timezone: Copenhagen, Denmark (UTC+1/UTC+2)
3. **Connection Status** - Real-time heartbeat monitoring
4. **Error Logging** - Automatic error tracking and remote viewing
5. **Usage Statistics** - Track logins and commands with timestamps
6. **Auto-Recovery** - WiFi reconnection and reboot on failures

## API Configuration

### API Key

The API key is stored in:
- **Vercel**: Environment variable `API_KEY`
- **Arduino**: Variable `API_KEY` in the `.ino` file
- **Web Interface**: Variable `API_KEY` in `public/script.js`

To update the API key:
```bash
vercel env add API_KEY
# Generate new key: openssl rand -hex 32
```

### Persistent Storage (Optional)

For production use, set up **Upstash Redis** for persistent storage:
- Without it: Data stored in-memory (lost on cold starts)
- With it: All data persists permanently
- See [VERCEL_KV_SETUP.md](VERCEL_KV_SETUP.md) for setup instructions
- Free tier: 10,000 requests/day, 256 MB storage

## Project Structure

```
cloud/
├── public/
│   ├── index.html          # Web interface
│   ├── script.js           # Frontend logic
│   ├── styles.css          # Styling
│   └── auth.js             # Password protection
├── api/
│   ├── command.js          # Command endpoint (logs to stats)
│   ├── status.js           # Status endpoint
│   ├── debug.js            # Error log management
│   └── stats.js            # Login/command statistics tracking
└── arduino/
    └── syrenvej_varmepumpe/
        └── syrenvej_varmepumpe.ino  # ESP32 firmware
```

## Troubleshooting

**Arduino won't connect:**
1. Check LED status:
   - 🔴 Red = WiFi/network issue
   - 🟣 Purple stuck = Check power/hardware
2. Verify WiFi credentials in code
3. Check serial monitor for detailed errors
4. Verify API_KEY matches Vercel

**Web shows "Not Connected":**
1. Check Arduino LED:
   - Should be 🟢 green (blinking) = normal
   - If 🔴 red = network errors
2. Arduino needs to be powered on
3. Wait 60 seconds for first heartbeat
4. Check Arduino serial monitor

**Toggle doesn't work:**
1. Check web connection status is green
2. Check Arduino LED is 🟢 green (blinking)
3. Wait for Arduino to confirm (controls re-enable)
4. Check error logs: `curl /api/debug.js`

**LED is Red constantly:**
1. WiFi connection failed - check credentials
2. HTTP errors - check API_KEY
3. Arduino will auto-retry 3 times
4. If still red after 30s, it will reboot automatically

## API Endpoints Reference

All API endpoints require authentication via `X-API-Key` header.

### Debug Endpoint (`/api/debug.js`)

**View Error Logs:**
```bash
# Get all error logs
curl https://syrenvej-varmepumpe.vercel.app/api/debug.js \
  -H "X-API-Key: YOUR_API_KEY"
```

**Clear Error Logs:**
```bash
# Clear all error logs (sends clear command to Arduino)
curl -X DELETE https://syrenvej-varmepumpe.vercel.app/api/debug.js \
  -H "X-API-Key: YOUR_API_KEY"
```

See ERROR_LOGGING.md for details.

### Statistics Endpoint (`/api/stats.js`)

**View Statistics:**
```bash
# Get login and command statistics with summary
curl https://syrenvej-varmepumpe.vercel.app/api/stats.js \
  -H "X-API-Key: YOUR_API_KEY"
```

**Response includes:**
- Total logins and commands
- Activity for last 24 hours and 7 days
- Command type breakdown
- Recent 50 logins with timestamps and user agents
- Recent 50 commands with timestamps and types

**Clear Statistics:**
```bash
# Clear all statistics
curl -X DELETE https://syrenvej-varmepumpe.vercel.app/api/stats.js \
  -H "X-API-Key: YOUR_API_KEY"
```

**Manual Log Entry (optional):**
```bash
# Log a login event
curl -X POST https://syrenvej-varmepumpe.vercel.app/api/stats.js \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"login"}'

# Log a command event
curl -X POST https://syrenvej-varmepumpe.vercel.app/api/stats.js \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"command","commandType":"manual","commandData":{"action":"on"}}'
```

Note: Login and command events are automatically tracked when using the web interface.

### Status Endpoint (`/api/status.js`)

**Get Current State:**
```bash
# View current relay state, schedule, and connection status
curl https://syrenvej-varmepumpe.vercel.app/api/status.js \
  -H "X-API-Key: YOUR_API_KEY"
```

### Command Endpoint (`/api/command.js`)

**Send Manual Command:**
```bash
# Turn relay ON
curl -X POST https://syrenvej-varmepumpe.vercel.app/api/command.js \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"manual","action":"on"}'

# Turn relay OFF
curl -X POST https://syrenvej-varmepumpe.vercel.app/api/command.js \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"manual","action":"off"}'
```

**Set Schedule:**
```bash
# Schedule relay to turn ON at specific time
curl -X POST https://syrenvej-varmepumpe.vercel.app/api/command.js \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"schedule","action":"on","dateTime":"2025-10-23T14:30:00"}'

# Cancel schedule
curl -X POST https://syrenvej-varmepumpe.vercel.app/api/command.js \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"cancel_schedule"}'
```

## Security

- **Web Login**: Password required (24-hour session)
- **API Authentication**: All endpoints use API key
- **HTTPS Only**: Encrypted communication
- **No Open Ports**: Arduino only polls outward

## Upgrading Arduino Firmware

After pulling new Arduino code changes (like DST fixes), you need to re-upload to your ESP32:

1. Open `arduino/syrenvej_varmepumpe/syrenvej_varmepumpe.ino` in Arduino IDE
2. Select your ESP32 board (Tools → Board → ESP32 Arduino → ESP32 Dev Module)
3. Select correct COM port (Tools → Port)
4. Click **Upload** (or Ctrl+U)
5. Wait for "Hard resetting via RTS pin..." message
6. Arduino will reboot and LED will turn purple → yellow → green

**Check Serial Monitor** (115200 baud) after upload to verify:
- Time shows correct CET/CEST
- "DST will automatically adjust" message appears

## Support

For issues or questions, check:
- Serial monitor output from Arduino (115200 baud)
- Browser console for errors
- Vercel deployment logs

---

**Simple, secure, and it just works!** 🎉
