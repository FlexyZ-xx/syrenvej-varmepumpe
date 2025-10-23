# Vercel KV Setup Instructions (Optional but Recommended)

## Current Status: App Works Without KV

The app now uses a **hybrid storage approach**:
- ✅ **Works immediately** with in-memory storage (no setup required)
- ⚠️ **Serverless state loss** may occur during cold starts
- ✅ **Automatically upgrades** to persistent storage when KV is added

## Why Add Vercel KV?

Without KV, the UI may occasionally show "Waiting for first connection..." due to serverless cold starts losing in-memory state. KV solves this by persisting state across all function invocations.

## Setup Steps

### 1. Install Dependencies Locally (Optional)

```bash
npm install
```

### 2. Create Upstash Redis Database (KV Storage)

Vercel now uses **Upstash Redis** for KV (Key-Value) storage:

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your project (`syrenvej-varmepumpe`)
3. Go to the **Storage** tab
4. Click **Create Database**
5. Click on **"Upstash"** to expand options
6. Select **"Upstash for Redis"** and click **"Create"**
7. Authorize Upstash integration if prompted
8. Create database:
   - Name: `syrenvej-redis` (or any name you like)
   - Region: Choose closest to you (or default)
   - Click **"Create"**
9. **Connect to Project** - select your project from the dropdown
10. Click **"Connect"**

### 3. Verify Environment Variables

After connecting, verify these environment variables are set in your Vercel project (Settings → Environment Variables):

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`

If they're missing, add them manually from the Upstash dashboard.

### 4. Redeploy (Automatic)

Vercel will automatically redeploy after connecting Upstash. If not, trigger manually:

```bash
git commit --allow-empty -m "Trigger redeploy for Upstash KV"
git push origin main
```

## Verification

After Upstash Redis is set up and the deployment completes:

1. Verify storage type:
```bash
curl https://syrenvej-varmepumpe.vercel.app/api/stats.js \
  -H "X-API-Key: YOUR_API_KEY" | grep storage
```
Should show: `"storage": "vercel-kv"` (not "in-memory")

2. Open the web UI
3. You should see the connection status change from "Waiting for first connection..." to "Connected" (green) once the Arduino reports status
4. The status will persist across page reloads and serverless cold starts

## How It Works

### Storage Keys

- `arduino:state` - Stores `{ relayState, schedule, lastUpdate }`
- `arduino:command` - Stores pending commands from the UI
- `arduino:error_log` - Stores error logs from Arduino
- `arduino:stats` - Stores login and command statistics

### API Endpoints

- **POST /api/status.js** - Arduino reports state → stored in KV
- **GET /api/status.js** - UI fetches state → reads from KV (always available)
- **POST /api/command.js** - UI sends command → stored in KV, logs to stats
- **GET /api/command.js** - Arduino polls for commands → reads from KV
- **GET /api/debug.js** - Retrieve error logs → reads from KV
- **DELETE /api/debug.js** - Clear error logs → sends command to Arduino
- **GET /api/stats.js** - Retrieve login/command statistics → reads from KV
- **POST /api/stats.js** - Log events (automatic from UI) → stored in KV
- **DELETE /api/stats.js** - Clear statistics → stored in KV

## Upstash Redis Free Tier

- **10,000 requests/day** (300,000/month)
- **256 MB storage**
- **Max 100 KB per request**
- More than enough for this project (state is <1 KB per request)
- No credit card required

## Troubleshooting

### Stats show "in-memory" instead of "vercel-kv"

The environment variables are missing or incorrect:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Verify these three variables exist:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`
3. If missing, add them manually from your Upstash dashboard
4. Trigger a redeploy after adding variables

### UI shows "Waiting for first connection..."

1. Check that Upstash Redis is created and connected to the project
2. Check Vercel deployment logs for errors
3. Verify the Arduino is successfully POSTing (check Arduino serial console)
4. Wait 60 seconds for the Arduino's next heartbeat

### Getting Upstash Credentials Manually

If you need to find your Upstash credentials:

1. Go to Upstash Console: https://console.upstash.com/
2. Select your Redis database
3. Click "Details" tab
4. Copy the REST API credentials:
   - `UPSTASH_REDIS_REST_URL` → Use as `KV_REST_API_URL`
   - `UPSTASH_REDIS_REST_TOKEN` → Use as `KV_REST_API_TOKEN`

