#!/bin/bash
# Simple build script for Railway

echo "🚀 Building ProConnect Health..."

# Install backend dependencies
cd backend
echo "📦 Installing backend dependencies..."
npm install --production

echo "✅ Build complete!"