# Vercel KV Setup Instructions

## Problem Solved

The UI was showing "Waiting for first connection..." even though the Arduino successfully reported status. This was caused by Vercel's serverless functions being **stateless** - in-memory variables reset on each cold start.

## Solution: Vercel KV Storage

We've implemented **Vercel KV** (persistent key-value storage) to maintain state across all function invocations.

## Setup Steps

### 1. Install Dependencies Locally (Optional)

```bash
npm install
```

### 2. Create Vercel KV Database

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your project (`syrenvej-varmepumpe`)
3. Go to the **Storage** tab
4. Click **Create Database**
5. Select **KV** (Key-Value Store)
6. Give it a name (e.g., `syrenvej-kv`)
7. Click **Create**
8. **Connect to Project** - select your project from the dropdown
9. Vercel will automatically set the required environment variables

### 3. Redeploy (Automatic)

The code has already been pushed to GitHub, so Vercel will automatically redeploy with KV support.

## Verification

After KV is set up and the deployment completes:

1. Open the web UI
2. You should see the connection status change from "Waiting for first connection..." to "Connected" (green) once the Arduino reports status
3. The status will persist across page reloads and serverless cold starts

## How It Works

### Storage Keys

- `arduino:state` - Stores `{ relayState, schedule, lastUpdate }`
- `arduino:command` - Stores pending commands from the UI

### API Endpoints

- **POST /api/status.js** - Arduino reports state → stored in KV
- **GET /api/status.js** - UI fetches state → reads from KV (always available)
- **POST /api/command.js** - UI sends command → stored in KV
- **GET /api/command.js** - Arduino polls for commands → reads from KV

## Vercel KV Free Tier

- **30 MB storage**
- **100,000 commands/month**
- More than enough for this project (state is <1 KB)

## Troubleshooting

If the UI still shows "Waiting for first connection...":

1. Check that KV database is created and connected to the project
2. Check Vercel deployment logs for errors
3. Verify the Arduino is successfully POSTing (check Arduino serial console)
4. Wait 60 seconds for the Arduino's next heartbeat

## Alternative: Manual Environment Variables

If automatic connection doesn't work, you can manually add these environment variables in Vercel project settings:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`

(These should be automatically provided by Vercel when you connect the KV database)

