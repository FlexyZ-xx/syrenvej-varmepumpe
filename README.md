# Syrenvej6 Heat Pump Relay Controller

Simple web interface to control a relay connected to an ESP32/Arduino via the cloud.

## Quick Overview

- **Web Interface**: https://syrenvej-varmepumpe.vercel.app
- **Password**: Check `public/auth.js` for current password
- **Features**: Manual ON/OFF toggle + Schedule control
- **Hardware**: ESP32 + Soldered I2C Relay Board

## How It Works

```
Web Browser → Vercel API → Arduino (polls every 5s) → Relay → Heat Pump
```

- Arduino only makes outgoing HTTPS requests (no open ports)
- All state stored locally on Arduino EEPROM
- Web interface shows real-time connection status

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
- **COM** → Heat pump power source
- **NO** (Normally Open) → Heat pump control wire
- **NC** → Not used

## Web Interface

### Status Indicators:
- 🟢 **Connected** - Arduino is actively polling (< 10 seconds)
- 🔴 **Not Connected** - No heartbeat from Arduino (> 10 seconds)
- 🔵 **Waiting...** - Processing command (toggle disabled)

### Features:
1. **Manual Control** - Toggle relay ON/OFF immediately
2. **Schedule** - Set future ON/OFF action (date + time)
3. **Connection Status** - Real-time heartbeat monitoring

## API Configuration

The API key is stored in:
- **Vercel**: Environment variable `API_KEY`
- **Arduino**: Variable `API_KEY` in the `.ino` file
- **Web Interface**: Variable `API_KEY` in `public/script.js`

To update the API key:
```bash
vercel env add API_KEY
# Generate new key: openssl rand -hex 32
```

## Project Structure

```
cloud/
├── public/
│   ├── index.html          # Web interface
│   ├── script.js           # Frontend logic
│   ├── styles.css          # Styling
│   └── auth.js             # Password protection
├── api/
│   ├── command.js          # Command endpoint
│   └── status.js           # Status endpoint
└── arduino/
    └── syrenvej_varmepumpe/
        └── syrenvej_varmepumpe.ino  # ESP32 firmware
```

## Troubleshooting

**Arduino won't connect:**
1. Check WiFi credentials
2. Verify API_KEY in code matches Vercel
3. Check serial monitor for errors

**Web shows "Not Connected":**
1. Arduino needs to be powered on
2. Wait 10 seconds for first poll
3. Check Arduino is connected to WiFi

**Toggle doesn't work:**
1. Check connection status is green
2. Wait for Arduino to confirm (blue status)
3. Relay should activate within 10 seconds

## Security

- **Web Login**: Password required (24-hour session)
- **API Authentication**: All endpoints use API key
- **HTTPS Only**: Encrypted communication
- **No Open Ports**: Arduino only polls outward

## Support

For issues or questions, check:
- Serial monitor output from Arduino
- Browser console for errors
- Vercel deployment logs

---

**Simple, secure, and it just works!** 🎉
