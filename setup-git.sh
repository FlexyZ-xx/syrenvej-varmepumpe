#!/bin/bash

# Setup Git for Personal GitHub Account (Local Config Only)
# This won't affect your company GitHub settings

set -e

echo "🔧 Setting up Git for Personal GitHub (this project only)"
echo ""

# Initialize git if not already done
if [ ! -d .git ]; then
    echo "Initializing Git repository..."
    git init
    echo "✓ Git repository initialized"
else
    echo "✓ Git repository already exists"
fi

# Prompt for personal GitHub details
echo ""
echo "Enter your PERSONAL GitHub details:"
read -p "GitHub username: " GITHUB_USER
read -p "GitHub email: " GITHUB_EMAIL
read -p "Repository name (default: syrenvej-varmepumpe): " REPO_NAME
REPO_NAME=${REPO_NAME:-syrenvej-varmepumpe}

echo ""
echo "Configuring LOCAL Git settings (won't affect other projects)..."

# Set local git config (only for this project)
git config user.name "$GITHUB_USER"
git config user.email "$GITHUB_EMAIL"

echo "✓ Local Git user configured:"
echo "  Name: $GITHUB_USER"
echo "  Email: $GITHUB_EMAIL"

# Add remote if it doesn't exist
if ! git remote | grep -q origin; then
    echo ""
    echo "Adding remote..."
    git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git"
    echo "✓ Remote added: https://github.com/$GITHUB_USER/$REPO_NAME.git"
else
    echo ""
    echo "⚠ Remote 'origin' already exists:"
    git remote get-url origin
fi

# Create .gitignore if not exists
if [ ! -f .gitignore ]; then
    cat > .gitignore << 'EOF'
node_modules/
.vercel/
.env
.env.local
*.log
.DS_Store
deployment_info.txt
arduino_config.txt
backups/
EOF
    echo "✓ .gitignore created"
fi

# Initial commit
if [ -z "$(git log 2>/dev/null)" ]; then
    echo ""
    echo "Creating initial commit..."
    git add .
    git commit -m "Initial commit: Syrenvej6 Varmepumpe Controller

- Web interface (single and multi-relay)
- API endpoints with authentication
- Arduino firmware (ESP8266/ESP32)
- Complete documentation
- Automated deployment script
- Wiring diagrams
"
    echo "✓ Initial commit created"
else
    echo ""
    echo "✓ Repository already has commits"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Git Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Create repository on GitHub:"
echo "   https://github.com/new"
echo "   Repository name: $REPO_NAME"
echo ""
echo "2. Push to GitHub:"
echo "   git push -u origin main"
echo ""
echo "   (or if it asks for 'master'):"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "3. If prompted for credentials, use:"
echo "   Username: $GITHUB_USER"
echo "   Password: [Personal Access Token - NOT your password]"
echo ""
echo "📝 To create a Personal Access Token:"
echo "   1. Go to: https://github.com/settings/tokens"
echo "   2. Click 'Generate new token (classic)'"
echo "   3. Select scopes: 'repo' (full control)"
echo "   4. Copy the token and use it as password"
echo ""
echo "🔍 Verify local config (this project only):"
echo "   git config user.name"
echo "   git config user.email"
echo ""
echo "🔍 Check global config (company account - unchanged):"
echo "   git config --global user.name"
echo "   git config --global user.email"
echo ""

