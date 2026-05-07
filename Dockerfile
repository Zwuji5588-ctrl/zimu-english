FROM node:18-slim
WORKDIR /app
COPY . .
RUN cd backend && npm install && node build.js
EXPOSE 3001
CMD ["node", "backend/server.js"]
