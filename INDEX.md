# 📖 Documentation Index

Welcome to the Syrenvej6 Varmepumpe Controller documentation!

## 🚀 Getting Started

**New to the project?** Start here:

1. **[QUICKSTART.md](QUICKSTART.md)** ⭐ *Start here!*
   - 15-minute setup guide
   - Step-by-step with time estimates
   - Perfect for first-time users

2. **[README.md](README.md)**
   - Project overview
   - Features and capabilities
   - Architecture details

## 📚 Detailed Guides

### Deployment

- **[deploy.sh](deploy.sh)** - Automated deployment script (recommended!)
- **[DEPLOY.md](DEPLOY.md)** - Manual deployment guide
  - Vercel, Netlify, Railway
  - Custom domains
  - Security enhancements
  - Monitoring setup

### Hardware

- **[WIRING.md](WIRING.md)** - Complete wiring guide
  - Single relay diagrams
  - Multi-relay setup (4 channels)
  - ESP8266 and ESP32 pinouts
  - Heat pump connections
  - Safety warnings
  - Troubleshooting

## 🎯 By Task

### "I want to deploy this quickly"
→ Run `./deploy.sh` then follow [QUICKSTART.md](QUICKSTART.md)

### "I want to understand everything first"
→ Read [README.md](README.md) then [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)

### "I need to wire the hardware"
→ See [WIRING.md](WIRING.md)

### "Something's not working"
→ Check troubleshooting in [DEPLOY.md](DEPLOY.md) and [WIRING.md](WIRING.md)

### "I want to customize the system"
→ See [README.md](README.md) "Customization" section

### "I need multi-relay support"
→ Use `arduino/syrenvej_multi_relay.ino` and `public/multi-relay.html`

## 📁 Source Code

### Web Interface
- `public/index.html` - Single relay interface
- `public/multi-relay.html` - Multi-relay interface
- `public/styles.css` - Shared styling
- `public/script.js` - Single relay logic
- `public/multi-relay-script.js` - Multi-relay logic

### API Endpoints
- `api/command.js` - Command queue
- `api/status.js` - Status reporting

### Arduino Firmware
- `arduino/syrenvej_varmepumpe.ino` - Single relay
- `arduino/syrenvej_multi_relay.ino` - Multi-relay (4 channels)

### Configuration
- `vercel.json` - Vercel deployment config
- `package.json` - Node.js dependencies
- `.env.example` - Environment template
- `.gitignore` - Git ignore rules

## 🔍 Reference

### Complete Documentation
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Comprehensive project overview
  - Architecture details
  - Security features
  - Cost analysis
  - File structure
  - Statistics

### Quick Reference Tables

| Component | File | Purpose |
|-----------|------|---------|
| Single Relay UI | `public/index.html` | Web control interface |
| Multi-Relay UI | `public/multi-relay.html` | 4-relay control interface |
| Command API | `api/command.js` | Command queue endpoint |
| Status API | `api/status.js` | State reporting endpoint |
| Single Relay Firmware | `arduino/syrenvej_varmepumpe.ino` | ESP8266/ESP32 sketch |
| Multi-Relay Firmware | `arduino/syrenvej_multi_relay.ino` | 4-relay sketch |
| Deploy Script | `deploy.sh` | Automated deployment |

## 📊 Decision Tree

```
Do you have Arduino experience?
│
├─ Yes → Read README.md then deploy with ./deploy.sh
│
└─ No → Follow QUICKSTART.md step-by-step

Do you need multiple relays?
│
├─ Yes → Use syrenvej_multi_relay.ino + multi-relay.html
│
└─ No → Use syrenvej_varmepumpe.ino + index.html

Is this your first deployment?
│
├─ Yes → Use ./deploy.sh (automated)
│
└─ No → See DEPLOY.md for manual options

Do you need to wire hardware?
│
└─ Yes → See WIRING.md (includes safety info!)
```

## 🎓 Learning Path

**Beginner:**
1. Read QUICKSTART.md
2. Run deploy.sh
3. Follow step-by-step guide
4. Test with Serial Monitor

**Intermediate:**
1. Read README.md
2. Review WIRING.md
3. Customize Arduino pins
4. Add security features

**Advanced:**
1. Read PROJECT_SUMMARY.md
2. Study API architecture
3. Add custom endpoints
4. Implement monitoring

## 🆘 Help & Support

### Common Issues

| Problem | Solution |
|---------|----------|
| WiFi won't connect | Check SSID/password, use 2.4GHz WiFi |
| Relay doesn't click | Verify 5V power, check wiring |
| API returns 401 | API key mismatch, check all locations |
| Schedule not working | Check timezone, verify time sync |
| Can't deploy | Check Vercel CLI login |

### Where to Find Answers

- **WiFi/Connection issues** → [README.md](README.md) Troubleshooting
- **Deployment problems** → [DEPLOY.md](DEPLOY.md) Troubleshooting
- **Hardware issues** → [WIRING.md](WIRING.md) Troubleshooting
- **API errors** → [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) Testing section

## 🎯 Quick Commands

```bash
# Deploy (automated)
./deploy.sh

# Deploy (manual)
vercel --prod

# Test API
curl -H "X-API-Key: your-key" https://your-app.vercel.app/api/status

# Generate API key
openssl rand -hex 32

# Check Vercel logs
vercel logs

# Set environment variable
vercel env add API_KEY production
```

## 📞 Contact & Contribution

This is an open-source project. Feel free to:
- Customize for your needs
- Share improvements
- Report issues
- Suggest features

## 🎉 Success Checklist

After setup, you should have:
- [ ] Web interface accessible
- [ ] Arduino connected to WiFi
- [ ] Relay responding to commands
- [ ] Schedule working
- [ ] State persistent (survives reboot)
- [ ] API secured with key
- [ ] Serial Monitor showing logs

**All checked?** Congratulations! Your system is fully operational! 🚀

---

## 📄 All Documentation Files

1. **INDEX.md** - This file (navigation guide)
2. **QUICKSTART.md** - Fast 15-minute setup
3. **README.md** - Main documentation
4. **DEPLOY.md** - Deployment guide
5. **WIRING.md** - Hardware guide
6. **PROJECT_SUMMARY.md** - Complete overview

**Tip:** Open INDEX.md whenever you need to find something!

---

*Last updated: October 17, 2025*

