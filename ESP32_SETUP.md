# 🔧 ESP32 Quick Setup Guide

## ✅ Ready to Flash!

Your Arduino sketches are **pre-configured** for ESP32 and ready to use!

---

## 📦 What You Need

### Hardware
- ✅ **ESP32 Dev Board** (any ESP32 with WiFi)
- ✅ **Relay Module** (1 or 4 channel, 3.3V or 5V compatible)
- ✅ **Micro USB Cable**
- ✅ **Jumper Wires**

### Software
- ✅ **Arduino IDE** (already installed)
- ✅ **ESP32 Board Support** (install below)
- ✅ **ArduinoJson Library** (install below)

---

## 🚀 Setup Steps

### 1. Install ESP32 Board Support

In Arduino IDE:

1. **File → Preferences**
2. **Additional Board Manager URLs**, add:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. **Tools → Board → Boards Manager**
4. Search **"ESP32"**
5. Install **"ESP32 by Espressif Systems"**
6. Click **Close**

### 2. Install ArduinoJson Library

1. **Sketch → Include Library → Manage Libraries**
2. Search **"ArduinoJson"**
3. Install **"ArduinoJson by Benoit Blanchon"** (version 6.x or 7.x)
4. Click **Close**

### 3. Configure WiFi

Open your sketch and **only update these 2 lines**:

```cpp
const char* WIFI_SSID = "Your_WiFi_Name";      // ← Your WiFi name
const char* WIFI_PASSWORD = "Your_WiFi_Pass";  // ← Your WiFi password
```

**Everything else is already configured!** ✅
- API URL: `https://syrenvej-varmepumpe.vercel.app`
- API Key: Pre-configured
- Endpoints: Pre-configured

### 4. Select Board & Port

1. **Tools → Board → ESP32 Arduino**
2. Choose your board (e.g., **"ESP32 Dev Module"** or **"DOIT ESP32 DEVKIT V1"**)
3. **Tools → Port** → Select your ESP32 port (e.g., `/dev/cu.usbserial-xxxx`)

### 5. Upload Sketch

1. Connect ESP32 via USB
2. Click **Upload** button (→)
3. Wait for "Done uploading"
4. Open **Serial Monitor** (115200 baud)

You should see:
```
Syrenvej6 Varmepumpe Controller
================================
Connecting to WiFi: Your_WiFi_Name
...
WiFi connected!
IP address: 192.168.x.x
Time synchronized!
Setup complete. Starting main loop...
```

---

## 🔌 Wiring for ESP32

### Single Relay Setup

```
ESP32 Pin      →    Relay Module
────────────────────────────────
GND            →    GND
3.3V or 5V*    →    VCC
GPIO5          →    IN

* Use 5V if relay requires 5V, 3.3V if it's 3.3V compatible
```

### Multi-Relay Setup (4 Relays)

```
ESP32 Pin      →    Relay Module
────────────────────────────────
GND            →    GND
5V             →    VCC
GPIO5          →    IN1 (Heat Pump)
GPIO18         →    IN2 (Circulation Pump)
GPIO19         →    IN3 (Spare 1)
GPIO21         →    IN4 (Spare 2)
```

---

## 📊 Pin Assignments

### Single Relay (`syrenvej_varmepumpe.ino`)
| ESP32 Pin | Function |
|-----------|----------|
| GPIO5 | Relay control |

### Multi-Relay (`syrenvej_multi_relay.ino`)
| ESP32 Pin | Function |
|-----------|----------|
| GPIO5 | Heat Pump Relay |
| GPIO18 | Circulation Pump |
| GPIO19 | Spare Relay 1 |
| GPIO21 | Spare Relay 2 |

---

## 🎯 Which Sketch to Use?

### Single Relay (Simple)
**File:** `arduino/syrenvej_varmepumpe.ino`
- Control 1 relay
- One schedule
- Simpler setup

### Multi-Relay (Advanced)
**File:** `arduino/syrenvej_multi_relay.ino`
- Control 4 relays
- 4 independent schedules
- Named relays
- Use web interface at: `/multi-relay.html`

---

## ✅ What's Pre-Configured

You **don't** need to change these - they're already set!

```cpp
// ✅ API Configuration (already set)
const char* API_HOST = "https://syrenvej-varmepumpe.vercel.app";
const char* COMMAND_ENDPOINT = "/api/command.js";
const char* STATUS_ENDPOINT = "/api/status.js";
const char* API_KEY = "a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4";

// ✅ Pin Configuration (already set)
const int RELAY_PIN = 5;  // GPIO5

// ✅ Polling Intervals (already optimized)
const unsigned long POLL_INTERVAL = 5000;  // 5 seconds
const unsigned long STATUS_REPORT_INTERVAL = 10000;  // 10 seconds

// ✅ Timezone (CET/CEST - adjust if needed)
const long GMT_OFFSET_SEC = 3600;  // +1 hour
const int DAYLIGHT_OFFSET_SEC = 3600;  // DST
```

---

## 🧪 Testing

### 1. Check Serial Monitor

After uploading, open Serial Monitor (115200 baud). You should see:

```
Syrenvej6 Varmepumpe Controller
================================
Loading state from EEPROM...
Loaded relay state: OFF
No active schedule
Connecting to WiFi: Your_WiFi_Name
.....
WiFi connected!
IP address: 192.168.1.100
Waiting for time sync...
Time synchronized!
Setup complete. Starting main loop...

Status reported successfully
```

### 2. Test from Web Interface

1. Open: https://syrenvej-varmepumpe.vercel.app
2. Login with password: `syrenvej2025`
3. Toggle switch **ON**
4. Check Serial Monitor:
   ```
   Manual command received: on
   Relay turned ON
   Relay state saved to EEPROM
   ```
5. Relay should **click** and LED should light up! ✅

---

## 🐛 Troubleshooting

### Can't Find ESP32 Port
- Install CH340 or CP2102 driver (depends on your ESP32 board)
- Try different USB cable (data cable, not charge-only)
- Press reset button on ESP32

### Compilation Error: "WiFi.h not found"
- Board support not installed correctly
- Go back to step 1 and reinstall ESP32 boards

### Compilation Error: "ArduinoJson.h not found"
- Library not installed
- Install ArduinoJson version 6.x or 7.x

### WiFi Won't Connect
- Check SSID and password (case-sensitive!)
- ESP32 only supports 2.4GHz WiFi (not 5GHz)
- Move closer to router
- Check Serial Monitor for errors

### Time Won't Sync
- Check internet connection
- Firewall might be blocking NTP (port 123)
- Try different NTP server in code: `const char* NTP_SERVER = "time.google.com";`

### Relay Doesn't Click
- Check wiring (VCC, GND, IN)
- Some relays need 5V (not 3.3V)
- Try different relay module
- Some relays are active-LOW (invert signal in code)

### "Failed to report status" in Serial
- Check API_KEY matches
- Verify internet connection
- Check API endpoints are accessible
- Test manually: `curl -H "X-API-Key: YOUR_KEY" https://syrenvej-varmepumpe.vercel.app/api/status.js`

---

## 🔧 Optional Adjustments

### Change Polling Frequency

In the sketch:
```cpp
const unsigned long POLL_INTERVAL = 10000;  // Poll every 10 seconds instead of 5
```

### Change Timezone

For different timezone (e.g., PST = UTC-8):
```cpp
const long GMT_OFFSET_SEC = -28800;  // -8 hours in seconds
```

### Change Relay Pin

```cpp
const int RELAY_PIN = 23;  // Use GPIO23 instead of GPIO5
```

---

## 📱 Web Interfaces

### Single Relay
**URL:** https://syrenvej-varmepumpe.vercel.app
- Toggle relay on/off
- Set schedule
- View current state

### Multi-Relay
**URL:** https://syrenvej-varmepumpe.vercel.app/multi-relay.html
- Control 4 relays independently
- 4 separate schedules
- Visual grid layout

**Login Password:** `syrenvej2025`

---

## 🎉 Quick Checklist

Before uploading:
- [x] ESP32 board support installed
- [x] ArduinoJson library installed
- [x] Board selected (ESP32 Dev Module)
- [x] Port selected
- [x] WiFi credentials updated in sketch
- [ ] Upload sketch
- [ ] Open Serial Monitor (115200 baud)
- [ ] Check "WiFi connected!"
- [ ] Test from web interface

---

## 📸 Expected Output

### Serial Monitor (Success)
```
Syrenvej6 Varmepumpe Controller
================================
Connecting to WiFi: MyWiFi
.....
WiFi connected!
IP address: 192.168.1.100
Time synchronized!
Setup complete. Starting main loop...

Status reported successfully
Manual command received: on
Relay turned ON
```

### Serial Monitor (Errors)
```
Failed to report status. HTTP code: 401  ← Wrong API key
Failed to report status. HTTP code: -1   ← No internet
WiFi connection failed!                   ← Wrong WiFi credentials
```

---

## 💡 Tips

1. **Use good power supply** - USB power is fine for testing, but use proper 5V supply for production
2. **Check relay voltage** - Most 3.3V ESP32 pins can drive 5V relays, but verify
3. **Add capacitor** - 100µF cap across ESP32 power pins helps with stability
4. **Serial Monitor is your friend** - Always check it first when debugging
5. **EEPROM persists** - State survives reboots and power loss
6. **OTA updates possible** - Can add OTA (Over-The-Air) updates later

---

## 🔗 Useful Links

- **ESP32 Pinout:** https://randomnerdtutorials.com/esp32-pinout-reference-gpios/
- **ArduinoJson:** https://arduinojson.org/
- **ESP32 Docs:** https://docs.espressif.com/projects/esp-idf/en/latest/esp32/

---

**Ready to start? Just update WiFi and upload!** 🚀

Your ESP32 will automatically:
- ✅ Connect to WiFi
- ✅ Sync time via NTP
- ✅ Poll cloud for commands
- ✅ Report status
- ✅ Execute schedules
- ✅ Save state to EEPROM

**No additional configuration needed!** 🎉

