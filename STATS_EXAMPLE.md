# Statistics Endpoint Example Output

## GET /api/stats.js Response

```json
{
  "summary": {
    "totalLogins": 42,
    "totalCommands": 156,
    "logins24h": 8,
    "logins7d": 35,
    "commands24h": 23,
    "commands7d": 142,
    "commandTypeBreakdown": {
      "manual": 98,
      "schedule": 45,
      "cancel_schedule": 13
    }
  },
  "recentLogins": [
    {
      "timestamp": 1729615234567,
      "time": "22/10/2025, 14:27:14 CEST",
      "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)"
    },
    {
      "timestamp": 1729598754321,
      "time": "22/10/2025, 09:52:34 CEST",
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
    }
  ],
  "recentCommands": [
    {
      "timestamp": 1729615789012,
      "time": "22/10/2025, 14:36:29 CEST",
      "commandType": "sent",
      "commandData": {
        "type": "manual",
        "action": "on",
        "status": "waiting"
      }
    },
    {
      "timestamp": 1729615800123,
      "time": "22/10/2025, 14:36:40 CEST",
      "commandType": "executed",
      "commandData": {
        "action": "on",
        "previousState": "off"
      }
    },
    {
      "timestamp": 1729612345678,
      "time": "22/10/2025, 13:39:05 CEST",
      "commandType": "schedule_set",
      "commandData": {
        "action": "on",
        "scheduledDateTime": "2025-10-23T08:00:00"
      }
    },
    {
      "timestamp": 1729652400000,
      "time": "23/10/2025, 08:00:00 CEST",
      "commandType": "schedule_executed",
      "commandData": {
        "action": "on",
        "previousState": "off",
        "scheduledDateTime": "2025-10-23T08:00:00",
        "scheduleAction": "on"
      }
    }
  ],
  "storage": "vercel-kv"
}
```

**Note:** `"storage": "vercel-kv"` indicates Upstash Redis is configured. If you see `"storage": "in-memory"`, stats won't persist across cold starts - see [VERCEL_KV_SETUP.md](../VERCEL_KV_SETUP.md).

## Features

### Automatic Logging
- **Logins**: Tracked automatically when users successfully authenticate
- **Commands**: Tracked automatically when commands are sent via web interface
- No manual intervention required

### Data Retention
- Keeps last 1,000 login events
- Keeps last 1,000 command events
- Older events are automatically pruned

### Time Windows
- **24 hours**: Recent activity snapshot
- **7 days**: Weekly activity trends
- **All time**: Complete historical counts

### Command Types
The endpoint tracks different command types:
- `sent`: Command sent from web UI (status: waiting)
- `executed`: Manual command executed by Arduino
- `schedule_set`: Schedule was created/set (includes scheduled datetime)
- `schedule_executed`: Schedule was executed by Arduino (includes scheduled datetime)
- `schedule_cancelled`: Schedule was cancelled before execution (includes scheduled datetime)

## Example Queries

### Get Statistics
```bash
curl https://syrenvej-varmepumpe.vercel.app/api/stats.js \
  -H "X-API-Key: YOUR_API_KEY" | jq
```

### Get Summary Only
```bash
curl https://syrenvej-varmepumpe.vercel.app/api/stats.js \
  -H "X-API-Key: YOUR_API_KEY" | jq '.summary'
```

### Get Recent Logins
```bash
curl https://syrenvej-varmepumpe.vercel.app/api/stats.js \
  -H "X-API-Key: YOUR_API_KEY" | jq '.recentLogins'
```

### Get Recent Commands
```bash
curl https://syrenvej-varmepumpe.vercel.app/api/stats.js \
  -H "X-API-Key: YOUR_API_KEY" | jq '.recentCommands'
```

## Storage and Persistence

- **With Upstash Redis**: Stats persist permanently (recommended for production)
- **Without Upstash**: Stats stored in-memory (lost on cold starts)
- Check `"storage"` field in response to see which mode is active
- Setup Upstash: See [VERCEL_KV_SETUP.md](../VERCEL_KV_SETUP.md)

## Privacy Considerations

- Statistics are kept for operational monitoring
- User agents (browser/device info) are stored but not IP addresses
- Use DELETE endpoint to clear data if needed
- Only accessible with valid API key

