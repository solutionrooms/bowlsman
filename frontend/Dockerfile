FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Create necessary directories
RUN mkdir -p public .next && \
    touch public/.gitkeep

# For development, we'll mount the source code as a volume
# For production builds, this will copy the source files
COPY . .

EXPOSE 3000

# Default to development mode
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# Use development server by default
CMD ["npm", "run", "dev"] 