# Stage 1: Build the Next.js frontend
FROM node:20-alpine AS builder
WORKDIR /app/client

# Install frontend dependencies
COPY client/package*.json ./
RUN npm ci

# Copy frontend source code
COPY client/ ./

# Build the frontend (static export)
RUN npm run build

# Stage 2: Setup the Node.js backend
FROM node:20-alpine
WORKDIR /app

# Install backend dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend source code
COPY server.js ./

# Copy the built frontend into the backend's public directory
COPY --from=builder /app/client/out ./public

# Expose ports: 3000 (web), 1935 (RTMP), 8000 (HTTP-FLV)
EXPOSE 3000 1935 8000

# Start the server
CMD ["node", "server.js"]
