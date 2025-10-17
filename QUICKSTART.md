# Quick Start Guide

Get your Syrenvej6 Varmepumpe controller running in 15 minutes!

## What You'll Need

### Hardware
- ✅ ESP8266 (NodeMCU) or ESP32 board
- ✅ Relay module (1 or 4 channel)
- ✅ Micro USB cable
- ✅ Jumper wires (3-6 pieces)

### Software
- ✅ Computer with Node.js installed
- ✅ Arduino IDE installed
- ✅ WiFi credentials
- ✅ Vercel account (free)

---

## Step 1: Deploy to Cloud (5 minutes)

Open terminal and run:

```bash
cd /Users/felixn/git/syrenvej/syrenvej.ino/cloud
./deploy.sh
```

The script will:
1. Generate secure API key
2. Deploy to Vercel
3. Configure everything
4. Create `arduino_config.txt` with your settings

**Save the URL it gives you!** Example: `https://syrenvej-varmepumpe.vercel.app`

---

## Step 2: Prepare Arduino (5 minutes)

### Install Libraries

In Arduino IDE:
1. Go to: **Sketch → Include Library → Manage Libraries**
2. Search and install: **ArduinoJson** (version 6.x by Benoit Blanchon)

### Add Board Support (if not already done)

For ESP8266:
1. **File → Preferences**
2. Add to "Additional Board Manager URLs":
   ```
   http://arduino.esp8266.com/stable/package_esp8266com_index.json
   ```
3. **Tools → Board → Boards Manager**
4. Search "ESP8266" and install

For ESP32:
1. Add URL: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
2. Install "ESP32" from Boards Manager

### Load and Configure Sketch

1. Open `arduino/syrenvej_varmepumpe.ino`
2. Open `arduino_config.txt` (created by deploy script)
3. Copy the configuration values into the sketch:

```cpp
const char* WIFI_SSID = "Your-WiFi-Name";       // ← ADD YOUR WIFI
const char* WIFI_PASSWORD = "Your-WiFi-Pass";   // ← ADD YOUR WIFI
const char* API_HOST = "https://...vercel.app"; // ← From arduino_config.txt
const char* API_KEY = "...";                    // ← From arduino_config.txt
```

---

## Step 3: Wire Hardware (3 minutes)

### Simple 3-Wire Connection

```
ESP8266 NodeMCU    →    Relay Module
─────────────────────────────────────
GND                →    GND
VIN (5V)           →    VCC
D1 (GPIO5)         →    IN
```

**That's it!** 

For detailed diagrams, see [WIRING.md](WIRING.md)

---

## Step 4: Flash Arduino (2 minutes)

1. Connect ESP8266/ESP32 via USB
2. Select board: **Tools → Board → ESP8266 Boards → NodeMCU 1.0**
3. Select port: **Tools → Port → /dev/cu.usbserial-xxxx**
4. Click **Upload** button (→)

Wait for "Done uploading" message.

---

## Step 5: Test! (30 seconds)

### Monitor Arduino

1. Open **Tools → Serial Monitor**
2. Set baud rate to **115200**
3. You should see:
   ```
   WiFi connected!
   IP address: 192.168.x.x
   Time synchronized!
   ```

### Test Web Interface

1. Open your Vercel URL in browser
2. Toggle the switch **ON**
3. Watch Serial Monitor - should show:
   ```
   Manual command received: on
   Relay turned ON
   ```
4. Relay should **click** and LED should light up! 🎉

---

## 🎉 Success!

Your heat pump controller is now running!

### What You Can Do Now

✅ **Manual Control** - Toggle relay on/off from web  
✅ **Schedule** - Set future on/off actions  
✅ **Persistent** - Settings survive power loss  
✅ **Remote** - Access from anywhere  

---

## Next Steps

### Connect Your Heat Pump

⚠️ **IMPORTANT**: If you're switching mains power (110V/220V), **hire a licensed electrician**!

For safe low-voltage control, see [WIRING.md](WIRING.md) section on heat pump connections.

### Multi-Relay Setup

Want to control multiple devices?

1. Use 4-channel relay module
2. Flash `arduino/syrenvej_multi_relay.ino`
3. Access: `https://your-app.vercel.app/multi-relay.html`

See [WIRING.md](WIRING.md) for 4-relay wiring diagram.

### Secure Your Installation

The system already has API key authentication, but you can add more:

- IP whitelist
- Rate limiting
- Custom authentication

See [DEPLOY.md](DEPLOY.md) "Security Enhancements" section.

---

## Troubleshooting

### Arduino Won't Connect to WiFi

- Check SSID and password spelling
- Ensure WiFi is 2.4GHz (ESP8266 doesn't support 5GHz)
- Move closer to router

### Relay Doesn't Click

- Check wiring connections
- Verify VCC is connected to 5V (not 3.3V)
- Try different relay module (some are active LOW)

### Web Interface Shows Offline

- Verify Arduino is powered and running
- Check Serial Monitor for errors
- Verify API_KEY matches in all locations
- Test API endpoint: `curl https://your-app.vercel.app/api/status`

### Schedule Not Executing

- Check timezone setting in Arduino sketch:
  ```cpp
  const long GMT_OFFSET_SEC = 3600;  // +1 hour for CET
  ```
- Verify time synchronized (check Serial Monitor)
- Ensure Arduino has stable power

---

## File Reference

| File | Purpose |
|------|---------|
| `arduino_config.txt` | Your generated Arduino configuration |
| `deployment_info.txt` | Deployment details and API key |
| `.env` | API key (keep secret!) |

**⚠️ Keep these files secure - they contain your API key!**

---

## Getting Help

### Check Documentation

1. **README.md** - Overview and features
2. **DEPLOY.md** - Deployment details
3. **WIRING.md** - Hardware connections

### Debug Checklist

- [ ] Arduino Serial Monitor shows "WiFi connected"
- [ ] API_KEY matches in Arduino, .env, and Vercel
- [ ] Relay module has power (5V)
- [ ] Wiring is correct (GND, VCC, IN)
- [ ] Browser console shows no errors
- [ ] Vercel deployment is live

### Test API Manually

```bash
# Test status endpoint
curl -H "X-API-Key: your-api-key" \
     https://your-app.vercel.app/api/status

# Should return JSON with relay state
```

---

## Success Checklist

After completing this guide, you should have:

- [x] Web interface accessible from browser
- [x] Arduino connected to WiFi
- [x] Relay clicking when toggled from web
- [x] Serial Monitor showing communication logs
- [x] Schedule feature working

**Congratulations! Your system is fully operational! 🚀**

---

## What's Next?

### Optional Enhancements

1. **Add more relays** - Control circulation pump, zone valves, etc.
2. **Home automation** - Integrate with Home Assistant or Node-RED
3. **Monitoring** - Set up alerts for failures
4. **Custom domain** - Use your own domain name
5. **Mobile app** - Add to home screen as PWA

### Share Your Build

If you build this project, we'd love to see it! Consider:
- Taking photos of your setup
- Documenting any improvements
- Sharing lessons learned

---

**Need more help?** Check the full documentation in README.md and DEPLOY.md

**Happy automating! 🎉**

