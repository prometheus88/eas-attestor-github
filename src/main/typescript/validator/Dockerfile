FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code (includes HTML files copied by build process)
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S validator -u 1001

# Change ownership
RUN chown -R validator:nodejs /app
USER validator

EXPOSE 8080

CMD ["node", "index.js"]