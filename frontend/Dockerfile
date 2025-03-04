FROM node:20-alpine

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies
RUN npm install

# Source code will be mounted from the host - we copy it for linting purposes
# if manually building without volume mounts
COPY . .

# Run ESLint to catch syntax errors early
RUN npm run lint -- --max-warnings=0 || (echo "ESLint found errors, please fix them before building" && exit 1)

# Set development environment to handle syntax errors more gracefully
ENV NODE_ENV=development

EXPOSE 3000

# Add linting check before starting the development server
CMD ["sh", "-c", "npm run lint || (echo 'Warning: ESLint found issues. You should fix them.') && npm run dev"] 