FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Create necessary directories and files
RUN mkdir -p public .next && \
    touch public/.gitkeep

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create necessary directories
RUN mkdir -p .next/static public

# Copy standalone server and dependencies
COPY --from=builder /app/.next/standalone .

# Copy static files
COPY --from=builder /app/.next/static ./.next/static

# Copy public files (if they exist)
COPY --from=builder /app/public .

EXPOSE 3000

# Start the application
CMD ["node", "server.js"] 