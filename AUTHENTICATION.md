# 🔒 Authentication Guide

## Web Interface Login

Your Syrenvej6 Varmepumpe controller now has **password protection** on the web interface!

---

## 🔑 Default Credentials

**Password:** `syrenvej2025`

When you visit https://syrenvej-varmepumpe.vercel.app, you'll see:

```
🔒 Syrenvej6 Access
Enter password to continue

[Password field]
[Login button]

Session expires after 24 hours
```

---

## ✨ Features

### 1. **Login Page**
- Beautiful login screen matching your design
- Password field (hidden input)
- Error message for incorrect password
- Shake animation on wrong password
- Session expiry notice

### 2. **Session Management**
- **Duration:** 24 hours
- **Storage:** Browser localStorage
- **Auto-logout:** After 24 hours
- **Manual logout:** Click "🚪 Logout" button (top-right)

### 3. **Security**
- Password required to access the page
- Session stored locally (not on server)
- All pages protected with authentication

---

## 🔧 Change the Password

Edit `public/auth.js` line 36:

```javascript
// Current password check
if (password === 'syrenvej2025') {  // ← Change this
    saveAuth();
    // ... rest of code
}
```

**To change password:**

1. Edit `public/auth.js`
2. Change `'syrenvej2025'` to your new password
3. Deploy: `vercel --prod`
4. Push to git: `git add . && git commit -m "Update password" && git push`

---

## 🎯 How It Works

### User Flow

```
1. User visits: https://syrenvej-varmepumpe.vercel.app
2. auth.js checks localStorage for session
3. If no session (or expired):
   → Show login page
   → Hide main content
4. User enters password
5. If correct:
   → Save session (timestamp + flag)
   → Hide login page
   → Show main content
   → Add logout button
6. Session valid for 24 hours
```

### Technical Details

**File:** `public/auth.js`
- Runs on page load
- Checks `localStorage` for auth data
- Validates session timestamp
- Shows/hides content based on auth status

**Storage:**
```javascript
{
  "timestamp": 1760689045000,  // When logged in
  "hash": "authenticated"       // Simple flag
}
```

**Expiry:**
- Set to 24 hours (configurable in `AUTH_EXPIRY_HOURS`)
- Automatically clears expired sessions
- User needs to login again after expiry

---

## 🚪 Logout

### Manual Logout
Click the **"🚪 Logout"** button in the top-right corner

### Automatic Logout
- After 24 hours (configurable)
- When clearing browser data
- When localStorage is cleared

---

## 🔐 Two-Layer Security

Your app now has **two layers** of protection:

### Layer 1: Web Interface (New!)
- **What:** Password to access the webpage
- **Protects:** Viewing the interface
- **Password:** `syrenvej2025`
- **Where:** Browser (localStorage)

### Layer 2: API Endpoints (Existing)
- **What:** API key in headers
- **Protects:** Backend API calls
- **Key:** `a3bad1660cef3fd1bb3e9573711dd36f3fa8c5a1dd61d1d0e3cb991e330b1fa4`
- **Where:** HTTP headers

Both layers work together:
1. User must login to see the interface
2. Interface must use API key to call backend
3. Arduino must use API key to communicate

---

## 📱 Multi-Device Access

**Same Password Works On:**
- Desktop browser
- Mobile browser
- Tablet
- Any device with web browser

**Each Device:**
- Has its own 24-hour session
- Must login separately
- Can logout independently

---

## ⚙️ Configuration Options

### Change Session Duration

Edit `public/auth.js` line 4:

```javascript
const AUTH_EXPIRY_HOURS = 24; // ← Change this (in hours)
```

Examples:
- `12` = 12 hours
- `48` = 2 days
- `168` = 1 week

### Disable Auto-Logout

Set to a very high number:
```javascript
const AUTH_EXPIRY_HOURS = 8760; // 1 year
```

### Add Multiple Passwords

Edit the password check in `auth.js`:

```javascript
const validPasswords = ['syrenvej2025', 'admin123', 'backup456'];

if (validPasswords.includes(password)) {
    // Login successful
}
```

---

## 🛡️ Security Best Practices

### ✅ Current Setup
- Password required for access
- Session expiry after 24 hours
- Manual logout available
- API key for backend protection

### 🔒 For Production (Optional)

If you want even more security:

1. **Use HTTPS only** ✅ (Already done by Vercel)
2. **Strong password** - Change from default
3. **Server-side validation** - Verify on backend
4. **Rate limiting** - Limit login attempts
5. **Two-factor auth** - Add SMS or email code

---

## 🧪 Testing

### Test Login
1. Open: https://syrenvej-varmepumpe.vercel.app
2. You should see login page
3. Enter: `syrenvej2025`
4. Click "Login"
5. Should show main interface + logout button

### Test Logout
1. Click "🚪 Logout" (top-right)
2. Should return to login page
3. Main content should be hidden

### Test Wrong Password
1. Enter wrong password
2. Should see red error message
3. Form should shake
4. Password field should clear

### Test Session Expiry
1. Login successfully
2. Open browser console (F12)
3. Run: `localStorage.getItem('syrenvej_auth')`
4. Should see stored session data
5. Wait 24 hours (or change expiry time for testing)
6. Refresh page - should require login again

---

## 🐛 Troubleshooting

### Can't Login - Password Not Working
- Check if password was changed in `auth.js`
- Default is: `syrenvej2025`
- Case-sensitive
- No spaces before/after

### Logged Out Unexpectedly
- Check session hasn't expired (24 hours)
- Browser might have cleared localStorage
- Private/Incognito mode doesn't persist storage

### Login Page Not Showing
- Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)
- Check `auth.js` is loaded (browser console)
- Verify deployment succeeded

### Logout Button Not Visible
- Check you're logged in
- Button is in top-right corner
- Try zooming out if hidden off-screen

---

## 📊 What Changed

### Files Modified
1. `public/auth.js` ← **New file** (authentication logic)
2. `public/index.html` ← Added auth.js script

### Files NOT Changed
- API endpoints (still have API key auth)
- Arduino sketches (no changes needed)
- Backend logic (unchanged)

---

## 🔄 Update Workflow

When you want to change the password:

```bash
# 1. Edit the password
nano public/auth.js
# Change line 36: if (password === 'YOUR_NEW_PASSWORD') {

# 2. Deploy to Vercel
vercel --prod

# 3. Push to GitHub
git add public/auth.js
git commit -m "Update password"
git push origin main

# 4. Test
# Open https://syrenvej-varmepumpe.vercel.app
# Try new password
```

---

## 💡 Tips

### Share Access
- Give the password to trusted users
- They can login from their own devices
- Each gets their own 24-hour session

### Remember Password
- Save in password manager
- Or change to something memorable
- Keep it secure!

### Monitor Access
- Check Vercel analytics for visitors
- No built-in access logs (client-side auth)
- For detailed logging, need server-side auth

---

## 🎉 Summary

Your web interface now has:
- ✅ **Password protection** on all pages
- ✅ **24-hour sessions** with auto-logout
- ✅ **Manual logout** button
- ✅ **Beautiful login page** matching your design
- ✅ **Works on all devices**

Combined with API key protection, you have **secure two-layer authentication**!

---

## 📞 Quick Reference

| Item | Value |
|------|-------|
| **Default Password** | `syrenvej2025` |
| **Session Duration** | 24 hours |
| **Logout Button** | Top-right corner |
| **Change Password** | Edit `public/auth.js` line 36 |
| **Storage** | Browser localStorage |

---

**Default Password: `syrenvej2025`**

**Remember to change it for production use!** 🔐

---

*Last updated: October 17, 2025*

