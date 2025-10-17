# Git Setup for Personal GitHub

## 🎯 Goal
Set up this project to use your **personal GitHub** account while keeping your **company GitHub** as the default for other projects.

---

## 🚀 Quick Setup (Automated)

Run the setup script:

```bash
./setup-git.sh
```

This will:
1. Initialize Git repository
2. Set local Git config (personal account - this project only)
3. Add GitHub remote
4. Create initial commit

---

## 📋 Manual Setup (Step by Step)

### Step 1: Initialize Git

```bash
cd /Users/felixn/git/syrenvej/syrenvej.ino/cloud
git init
```

### Step 2: Configure LOCAL Git (This Project Only)

**Important:** Use `git config` WITHOUT `--global` flag!

```bash
# Set your PERSONAL GitHub username and email (local to this project)
git config user.name "YourPersonalUsername"
git config user.email "your.personal@email.com"
```

This won't affect your company GitHub settings!

### Step 3: Verify Configuration

```bash
# Check LOCAL config (this project)
git config user.name
git config user.email

# Check GLOBAL config (company - should be unchanged)
git config --global user.name
git config --global user.email
```

### Step 4: Create Repository on GitHub

1. Go to: https://github.com/new
2. Repository name: `syrenvej-varmepumpe` (or your choice)
3. Make it **Private** or **Public**
4. **Don't** initialize with README (we already have files)
5. Click "Create repository"

### Step 5: Add Remote

```bash
# Replace YOUR_USERNAME with your personal GitHub username
git remote add origin https://github.com/YOUR_USERNAME/syrenvej-varmepumpe.git
```

### Step 6: Initial Commit

```bash
# Stage all files
git add .

# Create initial commit
git commit -m "Initial commit: Syrenvej6 Varmepumpe Controller"

# Set main branch
git branch -M main

# Push to GitHub
git push -u origin main
```

---

## 🔐 Authentication Options

### Option 1: Personal Access Token (Recommended)

GitHub no longer accepts passwords for HTTPS. Use a Personal Access Token:

#### Create Token:
1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. Note: "Syrenvej Varmepumpe Project"
4. Expiration: Choose duration (90 days, 1 year, etc.)
5. Select scopes: ✅ **repo** (full control of private repositories)
6. Click **"Generate token"**
7. **Copy the token** (you won't see it again!)

#### Use Token:
When pushing, Git will ask for credentials:
```
Username: your_personal_username
Password: [paste your token here]
```

#### Cache Token (So You Don't Need to Enter It Every Time):
```bash
# Cache for 1 hour
git config --local credential.helper 'cache --timeout=3600'

# Or use macOS Keychain (permanent)
git config --local credential.helper osxkeychain
```

### Option 2: SSH Key (More Secure, Permanent)

#### Generate SSH Key for Personal Account:
```bash
# Generate key with identifiable name
ssh-keygen -t ed25519 -C "your.personal@email.com" -f ~/.ssh/id_ed25519_personal

# Start SSH agent
eval "$(ssh-agent -s)"

# Add to SSH agent
ssh-add ~/.ssh/id_ed25519_personal
```

#### Add to GitHub:
1. Copy public key:
```bash
cat ~/.ssh/id_ed25519_personal.pub | pbcopy
```

2. Go to: https://github.com/settings/ssh/new
3. Title: "Personal MacBook"
4. Paste key
5. Click "Add SSH key"

#### Use SSH Remote:
```bash
# Change remote to SSH
git remote set-url origin git@github.com:YOUR_USERNAME/syrenvej-varmepumpe.git
```

#### Configure SSH for Multiple Accounts:
Create/edit `~/.ssh/config`:

```bash
# Company GitHub (default)
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_company

# Personal GitHub
Host github-personal
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_personal
```

Then use:
```bash
git remote set-url origin git@github-personal:YOUR_USERNAME/syrenvej-varmepumpe.git
```

---

## 🔍 Verify Setup

### Check Your Configuration:

```bash
# Show LOCAL config (this project only)
git config --local --list

# Should show your personal email/name
git config user.name
git config user.email

# Check GLOBAL config (company - should be unchanged)
git config --global user.name
git config --global user.email
```

### Test Push:

```bash
# Make a small change
echo "# Test" >> TEST.md
git add TEST.md
git commit -m "Test commit"
git push

# Check on GitHub - should appear under your personal account
```

---

## 📁 .gitignore

Already configured in `.gitignore`:

```gitignore
node_modules/
.vercel/
.env
.env.local
*.log
.DS_Store
deployment_info.txt
arduino_config.txt
backups/
```

**Important files to keep secret:**
- `.env` - Contains API key
- `deployment_info.txt` - Contains deployment details
- `arduino_config.txt` - Contains your configuration

These are automatically ignored!

---

## 🔄 Daily Workflow

### Making Changes:

```bash
# Check status
git status

# Stage files
git add .

# Commit with message
git commit -m "Your commit message"

# Push to personal GitHub
git push
```

### Pull Changes:

```bash
git pull origin main
```

---

## 🎨 .git/config File

After setup, your local `.git/config` should look like:

```ini
[core]
	repositoryformatversion = 0
	filemode = true
	bare = false
	logallrefupdates = true
	ignorecase = true
	precomposeunicode = true

[user]
	name = YourPersonalUsername
	email = your.personal@email.com

[remote "origin"]
	url = https://github.com/YourPersonalUsername/syrenvej-varmepumpe.git
	fetch = +refs/heads/*:refs/remotes/origin/*

[branch "main"]
	remote = origin
	merge = refs/heads/main
```

**Key point:** `[user]` section is LOCAL, won't affect other projects!

---

## ⚠️ Common Issues & Solutions

### Issue: Commits Show Company Email

**Solution:** You forgot to set local config:
```bash
git config user.email "your.personal@email.com"
git config user.name "YourPersonalUsername"
```

### Issue: Pushing to Wrong Account

**Solution:** Check remote URL:
```bash
git remote -v

# If wrong, update:
git remote set-url origin https://github.com/YOUR_PERSONAL/repo.git
```

### Issue: Permission Denied

**Solution:** 
- HTTPS: Use Personal Access Token (not password)
- SSH: Verify key is added to correct account

### Issue: Credential Helper Uses Wrong Account

**Solution:** Clear cached credentials:
```bash
# macOS Keychain
git credential-osxkeychain erase
host=github.com
protocol=https
[Press Enter twice]

# Or remove from Keychain Access app
```

---

## 🎯 Best Practices

### 1. Keep Secrets Secret
- Never commit `.env` files
- Keep API keys in environment variables
- Use `.gitignore` properly

### 2. Good Commit Messages
```bash
# Good
git commit -m "Add multi-relay support to web interface"

# Bad
git commit -m "fix stuff"
```

### 3. Commit Often
- Small, focused commits
- Easier to track changes
- Easier to revert if needed

### 4. Use Branches (Optional)
```bash
# Create feature branch
git checkout -b feature/new-feature

# Work on feature...
git add .
git commit -m "Add new feature"

# Merge back to main
git checkout main
git merge feature/new-feature
git push
```

---

## 📊 Git Workflow Summary

```
┌─────────────────────────────────────┐
│    Your Computer                    │
│  ┌───────────────────────────────┐  │
│  │  Working Directory            │  │
│  │  /cloud/                      │  │
│  │  - Edit files here            │  │
│  └───────────┬───────────────────┘  │
│              │ git add               │
│  ┌───────────▼───────────────────┐  │
│  │  Staging Area                 │  │
│  │  - Files ready to commit      │  │
│  └───────────┬───────────────────┘  │
│              │ git commit            │
│  ┌───────────▼───────────────────┐  │
│  │  Local Repository (.git)      │  │
│  │  - Commit history             │  │
│  │  - Local config (personal!)   │  │
│  └───────────┬───────────────────┘  │
└──────────────┼───────────────────────┘
               │ git push
               │
┌──────────────▼───────────────────────┐
│  GitHub (Personal Account)           │
│  https://github.com/YOU/repo         │
│  - Remote repository                 │
│  - Backup & collaboration            │
└──────────────────────────────────────┘
```

---

## ✅ Quick Reference

| Command | Purpose |
|---------|---------|
| `git config user.name "Name"` | Set local username |
| `git config user.email "email"` | Set local email |
| `git status` | Check current status |
| `git add .` | Stage all changes |
| `git commit -m "msg"` | Commit changes |
| `git push` | Push to remote |
| `git pull` | Pull from remote |
| `git log` | View commit history |
| `git remote -v` | View remote URLs |

---

## 🎉 You're All Set!

After following this guide, you'll have:
- ✅ Git repository initialized
- ✅ Personal GitHub account configured (local only)
- ✅ Company GitHub unchanged (global)
- ✅ Remote repository connected
- ✅ Ready to push your code!

**Next step:** Run `./setup-git.sh` or follow manual steps above!

---

*For more help, see: https://docs.github.com/en/authentication*

