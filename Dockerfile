FROM node:18-slim

WORKDIR /app

# Copy dependency files first (for Docker layer caching)
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install

# Copy all source files
COPY . .

# Build frontend (generates dist/index.html)
RUN cd backend && node build.js

VOLUME /app/backend/data

EXPOSE 3001

CMD ["node", "backend/server.js"]
