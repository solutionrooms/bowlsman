FROM node:20-alpine

# Add a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

WORKDIR /app

# Copy package files
COPY --chown=nextjs:nodejs package*.json ./

# Install dependencies with correct permissions
RUN npm install && \
    chown -R nextjs:nodejs /app

# Copy source with correct permissions
COPY --chown=nextjs:nodejs . .

# Switch to non-root user
USER nextjs

EXPOSE 3000

# Use production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Add build-time environment variables
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build the application
RUN npm run build

# Remove development dependencies
RUN npm prune --production

CMD ["npm", "start"] 