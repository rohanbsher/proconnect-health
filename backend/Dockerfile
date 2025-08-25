FROM node:18-alpine

WORKDIR /app

# Copy package.json only
COPY package.json ./

# Install dependencies (npm install will generate package-lock.json)
RUN npm install --production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Start the app
CMD ["npm", "start"]