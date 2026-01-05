#!/bin/bash

# MLO Dashboard - Development Environment Setup Script
# This script sets up and starts the development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   MLO Dashboard - Environment Setup   ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check for Node.js
echo -e "${YELLOW}Checking prerequisites...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js 20+ first.${NC}"
    echo "Download from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}Node.js version 20+ required. Current version: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm $(npm -v)${NC}"

# Check for PostgreSQL (optional for initial setup)
if command -v psql &> /dev/null; then
    echo -e "${GREEN}✓ PostgreSQL available${NC}"
else
    echo -e "${YELLOW}⚠ PostgreSQL not found. Using SQLite for development.${NC}"
fi

echo ""

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env file with defaults...${NC}"
    cat > .env << 'EOF'
# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mlo_dashboard
# For SQLite development: DATABASE_URL=file:./dev.db

# Authentication
JWT_SECRET=dev-secret-key-change-in-production-min-32-chars
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=30d

# Encryption (32 bytes base64)
ENCRYPTION_KEY=YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY=

# File Storage (S3-compatible)
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=mlo-documents
S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio123

# Application URLs
FRONTEND_URL=http://localhost:5173
API_URL=http://localhost:3000

# Environment
NODE_ENV=development
PORT=3000
VITE_PORT=5173
EOF
    echo -e "${GREEN}✓ .env file created${NC}"
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi

echo ""

# Function to install dependencies
install_deps() {
    local dir=$1
    local name=$2

    if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
        echo -e "${YELLOW}Installing $name dependencies...${NC}"
        cd "$dir"
        npm install
        cd ..
        echo -e "${GREEN}✓ $name dependencies installed${NC}"
    fi
}

# Install root dependencies if package.json exists
if [ -f "package.json" ]; then
    echo -e "${YELLOW}Installing root dependencies...${NC}"
    npm install
    echo -e "${GREEN}✓ Root dependencies installed${NC}"
fi

# Install frontend dependencies
install_deps "frontend" "Frontend"

# Install backend dependencies
install_deps "backend" "Backend"

echo ""

# Database setup
setup_database() {
    if [ -d "backend" ] && [ -f "backend/prisma/schema.prisma" ]; then
        echo -e "${YELLOW}Setting up database...${NC}"
        cd backend

        # Generate Prisma client
        npx prisma generate

        # Run migrations (if database is available)
        if npx prisma db push 2>/dev/null; then
            echo -e "${GREEN}✓ Database schema applied${NC}"
        else
            echo -e "${YELLOW}⚠ Could not connect to database. Run 'npx prisma db push' manually.${NC}"
        fi

        cd ..
    fi
}

setup_database

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}          Setup Complete!              ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}To start the development servers:${NC}"
echo ""
echo -e "  ${YELLOW}Option 1: Start everything (recommended)${NC}"
echo "    npm run dev"
echo ""
echo -e "  ${YELLOW}Option 2: Start servers separately${NC}"
echo "    Terminal 1 (Backend):  cd backend && npm run dev"
echo "    Terminal 2 (Frontend): cd frontend && npm run dev"
echo ""
echo -e "${GREEN}Access the application:${NC}"
echo "  Frontend: http://localhost:5173"
echo "  Backend API: http://localhost:3000"
echo "  API Health: http://localhost:3000/health"
echo ""
echo -e "${GREEN}Default test credentials:${NC}"
echo "  Email: admin@example.com"
echo "  Password: password123"
echo ""
echo -e "${YELLOW}Note: On first run, you may need to seed the database:${NC}"
echo "  cd backend && npm run seed"
echo ""

# Check if we should start servers
if [ "$1" == "--start" ] || [ "$1" == "-s" ]; then
    echo -e "${YELLOW}Starting development servers...${NC}"
    npm run dev
fi
