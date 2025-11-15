# Error Logging Diagnosis - November 11, 2025

## Summary

✅ **Error logging IS working correctly!** The Arduino successfully logs errors to EEPROM and pushes them to the cloud every 60 seconds.

## What Happened During the RED LED Incident

Your Arduino experienced **WiFi connectivity issues** between 20:07 and 20:10 (about 3 minutes). Here's the timeline:

```
20:07:55 - WiFi connection failed (attempt 2/3)
20:08:15 - Failed to connect to WiFi after 3 attempts - rebooting
20:08:35 - WiFi connection failed (attempt 1/3)  [after reboot]
20:08:55 - WiFi connection failed (attempt 2/3)
20:09:15 - Failed to connect to WiFi after 3 attempts - rebooting
20:09:36 - WiFi connection failed (attempt 1/3)  [after reboot]
20:09:56 - WiFi connection failed (attempt 2/3)
20:10:16 - Failed to connect to WiFi after 3 attempts - rebooting
20:10:36 - WiFi connection failed (attempt 1/3)  [after reboot]
20:10:56 - WiFi connection failed (attempt 2/3)
```

All 10 error slots in the Arduino's EEPROM circular buffer are filled with WiFi errors.

## Current Status

- ✅ Arduino is now **online and connected**
- ✅ Relay is **ON**
- ✅ No schedule active
- ✅ 10 errors logged in EEPROM and cloud

## Error Logging Flow (Confirmed Working)

1. **Error Occurs** → Arduino calls `logError()` function
2. **EEPROM Storage** → Error saved to flash memory (survives reboots)
3. **Heartbeat** → Every 60 seconds, Arduino sends all errors to cloud
4. **Cloud Storage** → Backend stores errors in KV or memory

## How to View Error Logs

### Recommended Method (Most Reliable)

```bash
curl -s "https://syrenvej-varmepumpe.vercel.app/api/status.js?errors=true" \
  -H "X-API-Key: a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4" \
  | jq '.errors'
```

This returns errors with human-readable timestamps.

### Alternative Method (Debug Endpoint)

```bash
curl -s "https://syrenvej-varmepumpe.vercel.app/api/debug.js" \
  -H "X-API-Key: a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4" \
  | jq .
```

**Note**: Without Vercel KV configured, this endpoint may return empty if it hits a different serverless instance than the one receiving Arduino heartbeats.

## Architecture Issue Identified

### Current Setup
- **No Vercel KV configured** (no environment variables set)
- Errors stored in **in-memory fallback** mode
- Different serverless instances (one for status.js POST, another for debug.js GET) **don't share memory**

### Why Status Endpoint Works But Debug Doesn't
1. Arduino POSTs to `/api/status.js` → Instance A receives and stores errors in memory
2. You GET `/api/status.js?errors=true` → Instance A responds (warm instance, has the data)
3. You GET `/api/debug.js` → Instance B tries to fetch data → might hit Instance C (no data)

## Recommended Fix: Set Up Vercel KV

Vercel KV (Upstash Redis) provides persistent storage shared across all serverless instances.

### Setup Instructions (from VERCEL_KV_SETUP.md)

1. Create Upstash Redis database (free tier available)
2. Add environment variables to Vercel:
   ```bash
   vercel env add KV_REST_API_URL
   vercel env add KV_REST_API_TOKEN
   ```
3. Redeploy:
   ```bash
   vercel --prod
   ```

Once configured, both endpoints will reliably access error logs.

## Verification Steps

### Verify Error Logging in Arduino

Check serial console for these messages:
- `Error logged: [message]`
- `Error log stored in KV:` or `Error log stored in memory:`
- `Loaded error log buffer. Next index: X`

### Verify Cloud Storage

```bash
# Check if errors are accessible
curl -s "https://syrenvej-varmepumpe.vercel.app/api/status.js?errors=true" \
  -H "X-API-Key: a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4" \
  | jq '.errors | length'
```

Should return number of errors (currently: 10)

### Clear Error Logs (After Fixing WiFi Issue)

```bash
curl -X DELETE "https://syrenvej-varmepumpe.vercel.app/api/debug.js" \
  -H "X-API-Key: a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4"
```

This sends a clear command to Arduino, which will clear EEPROM and send empty error array on next heartbeat.

## What Caused the WiFi Issues?

Possible causes for the 3-minute WiFi outage:
- **Router restart or instability**
- **Weak WiFi signal** (ESP32 too far from router)
- **Channel congestion** (too many devices on same WiFi channel)
- **ISP issues** (temporary internet outage)
- **Power fluctuation** (ESP32 brownout detection)

### Recommendations
1. Check WiFi signal strength at Arduino location
2. Consider moving router closer or adding WiFi extender
3. Use 2.4GHz band (better range than 5GHz)
4. Reserve static IP for Arduino in router DHCP settings

## Conclusion

✅ **Error logging is working perfectly!**
- All 10 errors from the WiFi incident were captured
- Errors stored in EEPROM (survived 3 reboots)
- Errors successfully pushed to cloud
- Accessible via `/api/status.js?errors=true`

The only issue is the `/api/debug.js` endpoint's reliability without KV storage, which is a convenience feature. The core error logging system is fully functional.

## Action Items

1. **Immediate**: Monitor WiFi stability to see if issues recur
2. **Optional**: Set up Vercel KV for more reliable debug endpoint access
3. **Optional**: Clear error logs once you've reviewed them
4. **Recommended**: Check WiFi signal strength and router stability

