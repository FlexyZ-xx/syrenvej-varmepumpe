# Deployment Guide

Complete step-by-step guide to deploy your Syrenvej6 Varmepumpe controller.

## Quick Start (Automated)

The easiest way to deploy is using the automated deployment script:

```bash
cd /Users/felixn/git/syrenvej/syrenvej.ino/cloud
chmod +x deploy.sh
./deploy.sh
```

This script will:
1. ✅ Generate a secure API key
2. ✅ Deploy to Vercel
3. ✅ Configure environment variables
4. ✅ Generate Arduino configuration file
5. ✅ Update web interface with API key

**Then just:**
- Copy values from `arduino_config.txt` to your Arduino sketch
- Flash your ESP8266/ESP32
- Done! 🎉

---

## Manual Deployment (Step by Step)

If you prefer manual control or the script doesn't work:

### Step 1: Generate API Key

Generate a secure random key:

```bash
openssl rand -hex 32
```

Save this key - you'll need it for both Vercel and Arduino!

Example output: `a7f3d9e2c8b1f4a6d8e9c2b5f1a3d7e9c4b6f8a2d5e7c9b3f6a1d8e4c7b9f2a5`

### Step 2: Create Environment File

Create `.env` file in the cloud directory:

```bash
echo "API_KEY=your-generated-key-here" > .env
```

### Step 3: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 4: Login to Vercel

```bash
vercel login
```

Follow the browser prompts to authenticate.

### Step 5: Deploy to Vercel

```bash
vercel --prod
```

Answer the prompts:
- Set up and deploy? **Yes**
- Which scope? Choose your account
- Link to existing project? **No**
- Project name? **syrenvej-varmepumpe** (or your choice)
- In which directory is your code? **./**
- Override settings? **No**

You'll get a deployment URL like: `https://syrenvej-varmepumpe.vercel.app`

### Step 6: Set Environment Variable on Vercel

Add your API key to Vercel:

```bash
vercel env add API_KEY production
```

Paste your API key when prompted.

### Step 7: Update Web Interface

Edit `public/script.js` and `public/multi-relay-script.js`:

Change this line:
```javascript
const API_KEY = 'change-me-in-production';
```

To:
```javascript
const API_KEY = 'your-generated-api-key-here';
```

### Step 8: Redeploy

```bash
vercel --prod
```

This deploys the updated web interface.

### Step 9: Configure Arduino

Edit your Arduino sketch and update:

```cpp
const char* WIFI_SSID = "Your-WiFi-Name";
const char* WIFI_PASSWORD = "Your-WiFi-Password";
const char* API_HOST = "https://syrenvej-varmepumpe.vercel.app";
const char* API_KEY = "your-generated-api-key-here";
```

### Step 10: Flash Arduino

1. Open Arduino IDE
2. Load `arduino/syrenvej_varmepumpe.ino`
3. Select your board (Tools → Board → ESP8266)
4. Select your port (Tools → Port)
5. Click Upload

---

## Verification

### Test Web Interface

1. Open your Vercel URL in browser
2. You should see the control interface
3. Toggle should be visible (but won't control anything until Arduino is connected)

### Test Arduino

1. Open Serial Monitor (Tools → Serial Monitor)
2. Set baud rate to 115200
3. You should see:
   ```
   Syrenvej6 Varmepumpe Controller
   ================================
   Connecting to WiFi: Your-WiFi-Name
   ...
   WiFi connected!
   IP address: 192.168.x.x
   Time synchronized!
   Setup complete. Starting main loop...
   ```

### Test End-to-End

1. Open web interface
2. Toggle the switch ON
3. In Serial Monitor, you should see:
   ```
   Manual command received: on
   Relay turned ON
   Relay state saved to EEPROM
   ```
4. Relay should click and LED should light up

---

## Deployment to Other Platforms

### Netlify

1. Install Netlify CLI:
```bash
npm install -g netlify-cli
```

2. Login:
```bash
netlify login
```

3. Create `netlify.toml`:
```toml
[build]
  publish = "public"
  
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[functions]
  directory = "api"
```

4. Move API files to functions format:
```bash
mkdir -p functions
cp api/*.js functions/
```

5. Deploy:
```bash
netlify deploy --prod
```

6. Set environment variable:
```bash
netlify env:set API_KEY your-api-key-here
```

### Railway.app

1. Create `railway.toml`:
```toml
[build]
  builder = "NIXPACKS"

[deploy]
  startCommand = "npx serve public"
```

2. Push to GitHub

3. Connect to Railway:
   - Go to railway.app
   - New Project → Deploy from GitHub
   - Select your repository
   - Add environment variable: `API_KEY`

### Render.com

1. Create `render.yaml`:
```yaml
services:
  - type: web
    name: syrenvej-varmepumpe
    env: static
    staticPublishPath: ./public
    routes:
      - type: rewrite
        source: /api/*
        destination: /.netlify/functions/:splat
```

2. Push to GitHub

3. Connect to Render:
   - Go to render.com
   - New Static Site
   - Connect your repository
   - Add environment variable: `API_KEY`

---

## Custom Domain (Optional)

### Add Custom Domain to Vercel

1. Go to your project on vercel.com
2. Settings → Domains
3. Add your domain (e.g., `varmepumpe.example.com`)
4. Follow DNS instructions
5. Update Arduino `API_HOST` to use new domain

### Free Domain Options

If you don't have a domain:
- **DuckDNS** (free dynamic DNS): duckdns.org
- **FreeDNS** (free subdomain): freedns.afraid.org
- **No-IP** (free hostname): noip.com

---

## Security Enhancements

### 1. Rotate API Key

If your API key is compromised:

```bash
# Generate new key
NEW_KEY=$(openssl rand -hex 32)

# Update Vercel
vercel env rm API_KEY production
vercel env add API_KEY production <<< "${NEW_KEY}"

# Update .env
echo "API_KEY=${NEW_KEY}" > .env

# Update Arduino and reflash
```

### 2. Add IP Whitelist

Edit `api/command.js` and `api/status.js`:

```javascript
const ALLOWED_IPS = [
    '192.168.1.100',  // Your Arduino's local IP
    '203.0.113.42'     // Your home external IP
];

function authenticate(req) {
    const apiKey = req.headers['x-api-key'];
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    return apiKey === API_KEY && ALLOWED_IPS.includes(clientIp);
}
```

### 3. Rate Limiting

Add rate limiting to API endpoints:

```javascript
const rateLimit = {};

function checkRateLimit(ip) {
    const now = Date.now();
    const limit = 100; // requests per minute
    
    if (!rateLimit[ip]) {
        rateLimit[ip] = { count: 0, resetTime: now + 60000 };
    }
    
    if (now > rateLimit[ip].resetTime) {
        rateLimit[ip] = { count: 0, resetTime: now + 60000 };
    }
    
    rateLimit[ip].count++;
    return rateLimit[ip].count <= limit;
}
```

---

## Monitoring

### Vercel Analytics

Enable analytics in Vercel dashboard:
1. Project Settings → Analytics
2. Enable Web Analytics (free)
3. View visitor stats and performance

### Arduino Logging

Add remote logging to Arduino:

```cpp
void logToCloud(String message) {
    DynamicJsonDocument doc(256);
    doc["log"] = message;
    doc["timestamp"] = time(nullptr);
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    // Send to logging endpoint
    http.begin(wifiClient, String(API_HOST) + "/api/log");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-Key", API_KEY);
    http.POST(jsonString);
    http.end();
}
```

Create `api/log.js`:

```javascript
let logs = [];

export default async function handler(req, res) {
    if (req.method === 'POST') {
        logs.push(req.body);
        if (logs.length > 100) logs.shift(); // Keep last 100
        return res.status(200).json({ success: true });
    }
    
    if (req.method === 'GET') {
        return res.status(200).json(logs);
    }
}
```

---

## Troubleshooting Deployment

### Vercel Deployment Fails

```bash
# Clear cache and redeploy
rm -rf .vercel
vercel --prod
```

### API Endpoints Return 401 Unauthorized

- Check API key matches in all locations:
  - Vercel environment variable
  - Arduino sketch
  - Web interface (script.js)

### Arduino Can't Connect to API

- Verify URL is correct (no trailing slash)
- Check API key in Arduino sketch
- Test API manually:
  ```bash
  curl -H "X-API-Key: your-key" https://your-app.vercel.app/api/status
  ```

### Environment Variable Not Working

```bash
# Remove and re-add
vercel env rm API_KEY production
vercel env add API_KEY production

# Redeploy
vercel --prod
```

---

## Backup and Recovery

### Backup Configuration

```bash
# Backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/${DATE}"
mkdir -p "${BACKUP_DIR}"

cp .env "${BACKUP_DIR}/"
cp deployment_info.txt "${BACKUP_DIR}/" 2>/dev/null || true
cp arduino_config.txt "${BACKUP_DIR}/" 2>/dev/null || true

echo "Backup created: ${BACKUP_DIR}"
EOF

chmod +x backup.sh
./backup.sh
```

### Restore from Backup

```bash
# List backups
ls -la backups/

# Restore
cp backups/20250117_120000/.env .
vercel env add API_KEY production < backups/20250117_120000/.env
vercel --prod
```

---

## Cost Optimization

### Vercel Free Tier Limits

- Bandwidth: 100GB/month
- Serverless Functions: 100GB-hours/month
- Edge Functions: 500,000 invocations/month

### Estimated Usage

For this project:
- API calls: ~17,280/month (polling every 5 sec)
- Data transfer: ~30MB/month
- Well within free tier! 🎉

### If You Exceed Limits

- Increase poll interval to 10 seconds
- Use Vercel KV for persistent storage (still free tier)
- Add caching headers to reduce bandwidth

---

## Next Steps After Deployment

1. ✅ Test basic on/off control
2. ✅ Test schedule functionality
3. ✅ Leave running for 24 hours to verify stability
4. ✅ Add to home automation (optional)
5. ✅ Set up monitoring alerts (optional)

Congratulations! Your system is deployed and running! 🎉

