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
      "time": "2025-10-22T14:27:14.567Z",
      "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)"
    },
    {
      "timestamp": 1729598754321,
      "time": "2025-10-22T09:52:34.321Z",
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
    }
  ],
  "recentCommands": [
    {
      "timestamp": 1729615789012,
      "time": "2025-10-22T14:36:29.012Z",
      "commandType": "manual",
      "commandData": {
        "type": "manual",
        "action": "on"
      }
    },
    {
      "timestamp": 1729612345678,
      "time": "2025-10-22T13:39:05.678Z",
      "commandType": "schedule",
      "commandData": {
        "type": "schedule",
        "action": "on",
        "dateTime": "2025-10-23T08:00:00"
      }
    }
  ],
  "storage": "vercel-kv"
}
```

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
- `manual`: Direct relay ON/OFF commands
- `schedule`: Scheduled relay actions
- `cancel_schedule`: Schedule cancellations
- `clear_errors`: Error log clearing (from debug endpoint)

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

## Privacy Considerations

- Statistics are kept for operational monitoring
- User agents (browser/device info) are stored but not IP addresses
- Use DELETE endpoint to clear data if needed
- Only accessible with valid API key

