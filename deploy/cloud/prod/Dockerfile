# Production multi-stage Dockerfile for validator service
FROM node:18-alpine AS builder

# Install build dependencies and Rust for BWS compilation
RUN apk add --no-cache curl bash jq wget tar gcc musl-dev

# Install Rust for building BWS from source (architecture-independent)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Build BWS from source for correct architecture
RUN wget -O bws-source.tar.gz https://github.com/bitwarden/sdk-sm/archive/refs/tags/bws-v1.0.0.tar.gz && \
    tar -xzf bws-source.tar.gz
WORKDIR /sdk-sm-bws-v1.0.0/crates/bws
RUN cargo build --release
WORKDIR /sdk-sm-bws-v1.0.0
RUN cp target/release/bws /usr/local/bin/bws
WORKDIR /
RUN rm -rf sdk-sm-bws-v1.0.0 bws-source.tar.gz

# Production stage - minimal runtime image
FROM node:18-alpine AS runtime

# Install runtime dependencies only
RUN apk add --no-cache curl bash jq dumb-init

# Copy BWS binary from builder stage
COPY --from=builder /usr/local/bin/bws /usr/local/bin/bws
RUN chmod +x /usr/local/bin/bws

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S validator -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Copy secret resolution script
COPY resolve-secret.sh /usr/local/bin/resolve-secret.sh
RUN chmod +x /usr/local/bin/resolve-secret.sh

# Set ownership and switch to non-root user
RUN chown -R validator:nodejs /app
USER validator

# Expose port
EXPOSE 5001

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5001/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "index.js"]