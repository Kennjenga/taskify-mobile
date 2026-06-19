FROM node:18-alpine as builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Set API URL environment variable for compile-time injection
# For Docker Compose, the backend is accessed via 'backend' hostname,
# but since the mobile/web browser client runs on the user's host machine,
# it should point to http://localhost:3000.
ENV EXPO_PUBLIC_API_URL=http://localhost:3000

# Export static HTML/JS web build
RUN npx expo export --platform web

FROM node:18-alpine

WORKDIR /app

# Install simple static server globally
RUN npm install -g serve

# Copy compiled files from builder stage
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 8081

# Serve the static website
CMD ["serve", "-s", "dist", "-l", "8081"]
