#!/bin/bash

echo "🚀 ProConnect AI - Deployment Test Script"
echo "========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Test local first
echo -e "\n${YELLOW}Step 1: Testing Local Setup${NC}"
echo "------------------------------"

# Check if backend is running
echo "Testing backend health endpoint..."
BACKEND_RESPONSE=$(curl -s http://localhost:5001/api/health 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend is running locally${NC}"
    echo "Response: $BACKEND_RESPONSE"
else
    echo -e "${RED}❌ Backend is not running. Start it with: cd backend && npm run dev${NC}"
    exit 1
fi

# Check if frontend is running
echo -e "\nTesting frontend..."
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3007 2>/dev/null)
if [ "$FRONTEND_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ Frontend is running locally${NC}"
else
    echo -e "${RED}❌ Frontend is not running. Start it with: cd frontend && npm run dev${NC}"
    exit 1
fi

echo -e "\n${GREEN}✅ Local setup is working!${NC}"

# Production test (if URLs provided)
echo -e "\n${YELLOW}Step 2: Production Deployment Test${NC}"
echo "-------------------------------------"

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "To test production, run:"
    echo "./test-deployment.sh <backend-url> <frontend-url>"
    echo ""
    echo "Example:"
    echo "./test-deployment.sh https://proconnect-backend.up.railway.app https://proconnect-ai.vercel.app"
else
    BACKEND_URL=$1
    FRONTEND_URL=$2
    
    echo "Testing backend at: $BACKEND_URL"
    BACKEND_PROD=$(curl -s $BACKEND_URL/api/health 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Backend is live!${NC}"
        echo "Response: $BACKEND_PROD"
    else
        echo -e "${RED}❌ Backend is not accessible${NC}"
    fi
    
    echo -e "\nTesting frontend at: $FRONTEND_URL"
    FRONTEND_PROD=$(curl -s -o /dev/null -w "%{http_code}" $FRONTEND_URL 2>/dev/null)
    if [ "$FRONTEND_PROD" = "200" ]; then
        echo -e "${GREEN}✅ Frontend is live!${NC}"
    else
        echo -e "${RED}❌ Frontend is not accessible${NC}"
    fi
fi

echo -e "\n========================================="
echo -e "${GREEN}Test complete!${NC}"