#!/bin/bash

# Build and Deploy Script for cPanel
# This script builds the TypeScript project and prepares files for deployment

set -e  # Exit on error

echo "🚀 Starting build process..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Navigate to server directory
cd "$(dirname "$0")"

echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

echo -e "${YELLOW}🔨 Building TypeScript...${NC}"
npm run build

if [ ! -d "dist" ]; then
    echo "❌ Error: dist directory not found after build"
    exit 1
fi

echo -e "${YELLOW}📁 Creating deployment package...${NC}"

# Create deployment directory
DEPLOY_DIR="../deployment/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$DEPLOY_DIR"

# Copy necessary files
echo "Copying dist folder..."
cp -r dist "$DEPLOY_DIR/"

echo "Copying package files..."
cp package.json "$DEPLOY_DIR/"
cp package-lock.json "$DEPLOY_DIR/"

echo "Copying uploads directory (if exists)..."
if [ -d "uploads" ]; then
    cp -r uploads "$DEPLOY_DIR/"
fi

echo "Copying migrations (if exists)..."
if [ -d "migrations" ]; then
    cp -r migrations "$DEPLOY_DIR/"
fi

echo "Copying .env.example..."
cp .env.example "$DEPLOY_DIR/"

echo "Copying ecosystem.config.js (if exists)..."
if [ -f "ecosystem.config.js" ]; then
    cp ecosystem.config.js "$DEPLOY_DIR/"
fi

# Create logs directory
mkdir -p "$DEPLOY_DIR/logs"

# Create .gitkeep for logs
touch "$DEPLOY_DIR/logs/.gitkeep"

echo -e "${GREEN}✅ Build completed successfully!${NC}"
echo -e "${GREEN}📦 Deployment package created at: $DEPLOY_DIR${NC}"
echo ""
echo "Next steps:"
echo "1. Review files in $DEPLOY_DIR"
echo "2. Upload to your cPanel server"
echo "3. Create .env file with your production values"
echo "4. Run: npm install --production"
echo "5. Start your Node.js app in cPanel"

