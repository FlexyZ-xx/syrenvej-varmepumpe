# Syrenvej6 Varmepumpe Controller

A cloud-based control system for an Arduino-controlled heat pump relay. The system features a web interface for manual control and scheduling, with all state stored locally on the Arduino.

## Architecture

```
Web Interface (Vercel)
    ↓ Commands
API Routes (Serverless)
    ↓ HTTPS Polling (every 5 sec)
Arduino (ESP8266/ESP32)
    ↓ Controls
Relay Module → Heat Pump
```

**Key Features:**
- ✅ No inbound connections to Arduino (only outgoing HTTPS)
- ✅ All state stored in Arduino EEPROM (survives power loss)
- ✅ Secure HTTPS communication
- ✅ Runs entirely on free tier hosting
- ✅ Modern, responsive web UI
- ✅ I2C relay control with Soldered board

## 🔌 Hardware

**Soldered I2C Relay Board**

![Relay Board](images/relay-board.jpg)

This project uses the Soldered I2C Relay Board:
- **I2C Interface** (address 0x30)
- **5V Relay** with NO/COM/NC terminals
- **Optocoupler** isolation
- **Compatible** with `Relay-SOLDERED.h` library
- **Easy wiring** with just 4 wires (VCC, GND, SDA, SCL)

See [WIRING.md](WIRING.md) for detailed connection diagrams.

## 🚀 Quick Start

**The fastest way to get started:**

```bash
cd /Users/felixn/git/syrenvej/syrenvej.ino/cloud
./deploy.sh
```

This automated script will deploy everything and generate your Arduino configuration!

**For detailed instructions, see:** [DEPLOY.md](DEPLOY.md)

---

## Setup Instructions

### 1. Deploy Cloud Service (Free Tier)

#### Option A: Deploy to Vercel (Recommended)

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
cd /Users/felixn/git/syrenvej/syrenvej.ino/cloud
vercel
```

3. Follow the prompts:
   - Set up and deploy: Yes
   - Which scope: Choose your account
   - Link to existing project: No
   - Project name: syrenvej-varmepumpe
   - Directory: ./
   - Override settings: No

4. Note your deployment URL (e.g., `https://syrenvej-varmepumpe.vercel.app`)

#### Option B: Deploy to Netlify

1. Install Netlify CLI:
```bash
npm install -g netlify-cli
```

2. Create `netlify.toml`:
```toml
[build]
  publish = "public"
  
[functions]
  directory = "api"
```

3. Deploy:
```bash
netlify deploy --prod
```

### 2. Arduino Setup

#### Hardware Requirements

- **ESP8266** (NodeMCU, Wemos D1 Mini) or **ESP32**
- Relay module (5V or 3.3V compatible)
- Jumper wires

#### Wiring

```
ESP8266          Relay Module
-------          ------------
D1 (GPIO5)  -->  IN
GND         -->  GND
VIN/5V      -->  VCC
```

⚠️ **Important**: Make sure your relay module matches your board's voltage level (3.3V or 5V).

#### Software Setup

1. **Install Arduino IDE** (if not installed):
   - Download from [arduino.cc](https://www.arduino.cc/en/software)

2. **Add ESP8266/ESP32 Board Support**:
   - Open Arduino IDE
   - Go to: File → Preferences
   - Add to "Additional Board Manager URLs":
     - ESP8266: `http://arduino.esp8266.com/stable/package_esp8266com_index.json`
     - ESP32: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Go to: Tools → Board → Boards Manager
   - Search and install "ESP8266" or "ESP32"

3. **Install Required Libraries**:
   - Go to: Sketch → Include Library → Manage Libraries
   - Install:
     - `ArduinoJson` (by Benoit Blanchon) - version 6.x

4. **Configure the Sketch**:
   - Open `arduino/syrenvej_varmepumpe.ino`
   - Update these lines:
   ```cpp
   const char* WIFI_SSID = "YOUR_WIFI_SSID";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   const char* API_HOST = "https://your-app.vercel.app";
   ```
   - Adjust timezone if needed:
   ```cpp
   const long GMT_OFFSET_SEC = 3600;  // +1 hour for CET
   ```

5. **Upload to Arduino**:
   - Connect your ESP8266/ESP32 via USB
   - Select: Tools → Board → ESP8266 Boards → NodeMCU 1.0 (or your board)
   - Select: Tools → Port → [Your device port]
   - Click: Upload (→ button)

6. **Monitor Serial Output**:
   - Open: Tools → Serial Monitor
   - Set baud rate to: 115200
   - You should see connection status and logs

### 3. Usage

#### Access Web Interface

Navigate to your deployment URL:
```
https://your-app.vercel.app
```

#### Manual Control

Use the toggle switch to turn the relay on/off immediately.

#### Schedule Control

1. Set the date and time for the action
2. Choose action: Turn ON or Turn OFF
3. Click "Save Schedule"
4. The Arduino will execute the action at the specified time
5. Use "Clear Schedule" to remove the scheduled action

#### Features

- **Persistent State**: Relay state and schedule survive power loss (stored in EEPROM)
- **Real-time Updates**: Web interface updates every 2 seconds
- **Schedule Status**: Shows if a schedule is active or already executed
- **Timezone Aware**: Arduino uses NTP for accurate time

## How It Works

### Communication Flow

1. **Web → Cloud**: User interaction sends command to API
2. **Arduino → Cloud**: Arduino polls `/api/command` every 5 seconds for new commands
3. **Arduino → Cloud**: Arduino reports state to `/api/status` every 10 seconds
4. **Cloud → Web**: Web interface polls `/api/status` every 2 seconds for updates

### State Storage

All state is stored in Arduino EEPROM:
- **Relay State**: Current on/off status
- **Schedule**: Scheduled action with date/time
- **Executed Flag**: Whether schedule has run

### Security

- ✅ HTTPS encryption for all communication
- ✅ No open ports on Arduino (outgoing only)
- ✅ Can add API key authentication if needed

## Customization

### Add API Key Authentication

✅ **Already included!** The system comes with API key authentication built-in.

The `deploy.sh` script automatically:
- Generates a secure API key
- Configures Vercel environment variables
- Updates Arduino configuration file
- Secures all endpoints

If you deployed manually, see [DEPLOY.md](DEPLOY.md) for instructions.

### Change Polling Interval

In Arduino sketch:
```cpp
const unsigned long POLL_INTERVAL = 5000;  // Change to desired ms
```

### Change Relay Pin

In Arduino sketch:
```cpp
const int RELAY_PIN = D1;  // Change to your pin
```

## Troubleshooting

### Arduino Not Connecting to WiFi

- Check SSID and password
- Ensure WiFi is 2.4GHz (ESP8266 doesn't support 5GHz)
- Check signal strength

### Arduino Not Receiving Commands

- Verify API_HOST URL is correct (no trailing slash)
- Check serial monitor for error messages
- Test API endpoint in browser: `https://your-app.vercel.app/api/status`

### Schedule Not Executing

- Verify time is synchronized (check serial monitor)
- Adjust GMT_OFFSET_SEC for your timezone
- Ensure Arduino has stable power

### Relay Not Switching

- Check wiring connections
- Verify relay module voltage compatibility
- Test relay with direct connection
- Some relays are active LOW (invert logic in code)

## Cost Analysis

**Total Monthly Cost: $0** 🎉

- **Vercel**: Free tier (100GB bandwidth, unlimited requests)
- **API Routes**: Serverless, included in free tier
- **Domain**: Optional (use vercel.app subdomain for free)
- **Arduino**: One-time hardware cost (~$5-15)

**Free Tier Limits:**
- Vercel: 100GB bandwidth/month (more than enough for this use case)
- Expected usage: ~1MB/day = ~30MB/month

## 📦 What's Included

### Web Interface
- **Control Interface**: `index.html` - Heat pump control with scheduling

### Arduino Sketch
- **ESP32 Controller**: `arduino/syrenvej_varmepumpe.ino`

### Documentation
- **README.md** - This file (overview and quick setup)
- **DEPLOY.md** - Complete deployment guide
- **WIRING.md** - Detailed wiring diagrams and hardware setup
- **ESP32_SETUP.md** - ESP32-specific setup guide

### Deployment Tools
- **deploy.sh** - Automated deployment script
- **vercel.json** - Vercel configuration

## 🔒 Security Features

✅ **API Key Authentication** - All endpoints secured  
✅ **HTTPS Only** - Encrypted communication  
✅ **No Inbound Connections** - Arduino only polls outward  
✅ **Environment Variables** - Secrets stored securely  
✅ **Password Protected** - Web interface requires login

## 📚 Documentation

| File | Description |
|------|-------------|
| [README.md](README.md) | Main documentation (you are here) |
| [DEPLOY.md](DEPLOY.md) | Complete deployment guide |
| [WIRING.md](WIRING.md) | Hardware wiring diagrams |

## License

MIT License - Use freely for personal or commercial projects.

## Support

For issues or questions:
1. Check the Troubleshooting section
2. Review [DEPLOY.md](DEPLOY.md) deployment guide
3. Check [WIRING.md](WIRING.md) for hardware issues
4. Review serial monitor output (115200 baud)
5. Check browser console for errors
6. Verify API endpoints are responding

## Credits

Created for Syrenvej6 heat pump automation project.

