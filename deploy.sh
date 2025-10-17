#!/bin/bash

# Syrenvej6 Varmepumpe - Deployment Helper Script
# This script helps you deploy the project to Vercel with proper configuration

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   Syrenvej6 Varmepumpe - Deployment Helper               ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Function to generate secure API key
generate_api_key() {
    if command -v openssl &> /dev/null; then
        openssl rand -hex 32
    else
        # Fallback if openssl is not available
        cat /dev/urandom | LC_ALL=C tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1
    fi
}

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
fi

# Check if we're in the correct directory
if [ ! -f "vercel.json" ]; then
    echo -e "${RED}Error: vercel.json not found. Please run this script from the cloud/ directory.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}\n"

# Step 1: Generate API Key
echo -e "${BLUE}Step 1: Generate API Key${NC}"
if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠ .env file already exists${NC}"
    read -p "Do you want to generate a new API key? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        GENERATE_NEW=true
    else
        GENERATE_NEW=false
        API_KEY=$(grep API_KEY .env | cut -d '=' -f2)
    fi
else
    GENERATE_NEW=true
fi

if [ "$GENERATE_NEW" = true ]; then
    API_KEY=$(generate_api_key)
    echo "API_KEY=${API_KEY}" > .env
    echo -e "${GREEN}✓ New API key generated and saved to .env${NC}"
fi

echo -e "API Key: ${YELLOW}${API_KEY}${NC}"
echo -e "${YELLOW}⚠ Save this key securely! You'll need it for the Arduino configuration.${NC}\n"

# Step 2: Deploy to Vercel
echo -e "${BLUE}Step 2: Deploy to Vercel${NC}"
echo "This will deploy your project to Vercel..."
echo

# Check if already logged in
if ! vercel whoami &> /dev/null; then
    echo -e "${YELLOW}You need to login to Vercel first${NC}"
    vercel login
fi

# Deploy the project
echo -e "\nDeploying..."
DEPLOYMENT_OUTPUT=$(vercel --prod --yes 2>&1)
DEPLOYMENT_URL=$(echo "$DEPLOYMENT_OUTPUT" | grep -oP 'https://[^\s]+\.vercel\.app' | head -1)

if [ -z "$DEPLOYMENT_URL" ]; then
    # Try alternative extraction
    DEPLOYMENT_URL=$(echo "$DEPLOYMENT_OUTPUT" | grep "Production:" | grep -oP 'https://[^\s]+')
fi

echo -e "${GREEN}✓ Deployed successfully!${NC}"
echo -e "Deployment URL: ${GREEN}${DEPLOYMENT_URL}${NC}\n"

# Step 3: Set environment variable on Vercel
echo -e "${BLUE}Step 3: Configure API Key on Vercel${NC}"
echo "Setting environment variable..."

# Extract project name from deployment URL
PROJECT_NAME=$(basename $(pwd))

vercel env add API_KEY production <<< "${API_KEY}" || true

echo -e "${GREEN}✓ Environment variable configured${NC}\n"

# Step 4: Generate Arduino configuration
echo -e "${BLUE}Step 4: Generate Arduino Configuration${NC}"

cat > arduino_config.txt << EOF
/*
 * Arduino Configuration for Syrenvej6 Varmepumpe
 * Generated on: $(date)
 * 
 * Copy these values into your Arduino sketch:
 */

const char* WIFI_SSID = "YOUR_WIFI_SSID";          // ← Update with your WiFi name
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";  // ← Update with your WiFi password
const char* API_HOST = "${DEPLOYMENT_URL}";
const char* API_KEY = "${API_KEY}";

// Pin Configuration
const int RELAY_PIN = D1;  // GPIO5 on ESP8266

// For multi-relay setup:
const int RELAY_PINS[] = {D1, D2, D5, D6};  // GPIO5, GPIO4, GPIO14, GPIO12
EOF

echo -e "${GREEN}✓ Arduino configuration saved to: arduino_config.txt${NC}"
echo -e "${YELLOW}⚠ Remember to update your WiFi credentials!${NC}\n"

# Step 5: Update web interface API key
echo -e "${BLUE}Step 5: Update Web Interface${NC}"

# Update API key in script.js
if [ -f "public/script.js" ]; then
    sed -i.bak "s/const API_KEY = 'change-me-in-production'/const API_KEY = '${API_KEY}'/" public/script.js
    rm public/script.js.bak 2>/dev/null || true
    echo -e "${GREEN}✓ Updated public/script.js${NC}"
fi

# Update API key in multi-relay-script.js
if [ -f "public/multi-relay-script.js" ]; then
    sed -i.bak "s/const API_KEY = 'change-me-in-production'/const API_KEY = '${API_KEY}'/" public/multi-relay-script.js
    rm public/multi-relay-script.js.bak 2>/dev/null || true
    echo -e "${GREEN}✓ Updated public/multi-relay-script.js${NC}"
fi

# Redeploy with updated files
echo -e "\nRedeploying with updated configuration..."
vercel --prod --yes > /dev/null 2>&1

echo -e "${GREEN}✓ Web interface updated${NC}\n"

# Summary
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                  Deployment Complete! 🎉                  ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}Next Steps:${NC}"
echo -e "1. ${GREEN}Web Interface:${NC} ${DEPLOYMENT_URL}"
echo -e "2. ${GREEN}Arduino Config:${NC} Copy values from arduino_config.txt"
echo -e "3. ${GREEN}Update WiFi:${NC} Add your WiFi credentials in Arduino sketch"
echo -e "4. ${GREEN}Flash Arduino:${NC} Upload the sketch to your ESP8266/ESP32"
echo -e "5. ${GREEN}Wire Hardware:${NC} See WIRING.md for connection diagrams"
echo ""
echo -e "${YELLOW}Important Files:${NC}"
echo -e "  • arduino_config.txt - Arduino configuration"
echo -e "  • .env - API key (keep secret!)"
echo -e "  • WIRING.md - Hardware connection guide"
echo ""
echo -e "${GREEN}Testing:${NC}"
echo -e "1. Open ${DEPLOYMENT_URL} in your browser"
echo -e "2. Flash and power on your Arduino"
echo -e "3. Check Arduino serial monitor (115200 baud)"
echo -e "4. Toggle the relay from web interface"
echo ""
echo -e "${BLUE}Support:${NC}"
echo -e "  If you encounter issues, check README.md troubleshooting section"
echo ""

# Save deployment info
cat > deployment_info.txt << EOF
Deployment Information
=====================

Date: $(date)
URL: ${DEPLOYMENT_URL}
API Key: ${API_KEY}

Web Interfaces:
- Single Relay: ${DEPLOYMENT_URL}
- Multi Relay: ${DEPLOYMENT_URL}/multi-relay.html

API Endpoints:
- Command: ${DEPLOYMENT_URL}/api/command
- Status: ${DEPLOYMENT_URL}/api/status

Vercel Project: https://vercel.com/dashboard

Notes:
- Keep this file secure (contains API key)
- Added to .gitignore automatically
EOF

echo "deployment_info.txt" >> .gitignore 2>/dev/null || true
echo "arduino_config.txt" >> .gitignore 2>/dev/null || true

echo -e "${GREEN}✓ Deployment info saved to: deployment_info.txt${NC}"
echo -e "${YELLOW}⚠ Keep deployment_info.txt secure - it contains your API key${NC}"
echo ""

