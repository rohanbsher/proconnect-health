#!/bin/bash

# ProConnect AI - Local Testing Script
echo "🚀 ProConnect AI - Local Testing Script"
echo "======================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Node.js is installed
echo "Checking Node.js version..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js installed: $NODE_VERSION"
else
    echo -e "${RED}✗${NC} Node.js not installed. Please install Node.js 18+"
    exit 1
fi

# Check if npm is installed
echo "Checking npm version..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} npm installed: $NPM_VERSION"
else
    echo -e "${RED}✗${NC} npm not installed"
    exit 1
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
echo "=========================="

# Root dependencies
echo "Installing root dependencies..."
npm install

# Backend dependencies
echo "Installing backend dependencies..."
cd backend && npm install && cd ..

# Frontend dependencies
echo "Installing frontend dependencies..."
cd frontend && npm install && cd ..

# Test backend health endpoint
echo ""
echo "Testing Backend..."
echo "=================="
cd backend
echo "Starting backend server..."
npm run dev &
BACKEND_PID=$!
sleep 5

# Check if backend is running
if curl -s http://localhost:5000/api/health > /dev/null; then
    echo -e "${GREEN}✓${NC} Backend health check passed!"
    HEALTH_RESPONSE=$(curl -s http://localhost:5000/api/health)
    echo "Response: $HEALTH_RESPONSE"
else
    echo -e "${RED}✗${NC} Backend health check failed"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Test jobs endpoint
if curl -s http://localhost:5000/api/jobs > /dev/null; then
    echo -e "${GREEN}✓${NC} Jobs endpoint working!"
else
    echo -e "${RED}✗${NC} Jobs endpoint failed"
fi

# Kill backend for now
kill $BACKEND_PID 2>/dev/null
cd ..

echo ""
echo "======================================="
echo -e "${GREEN}✅ Local testing complete!${NC}"
echo ""
echo "To run the full application:"
echo "  npm run dev"
echo ""
echo "Then open: http://localhost:3000"
echo ""
echo "Ready for deployment! Check DEPLOYMENT.md for instructions."