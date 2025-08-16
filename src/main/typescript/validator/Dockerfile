# Build BWS from source in a separate stage
FROM alpine:latest as bws-builder
RUN apk add --no-cache curl bash wget tar gcc musl-dev

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Build BWS
RUN wget -O bws-source.tar.gz https://github.com/bitwarden/sdk-sm/archive/refs/tags/bws-v1.0.0.tar.gz && \
    tar -xzf bws-source.tar.gz
WORKDIR sdk-sm-bws-v1.0.0
RUN cargo build --release --bin bws

# Main application stage
FROM node:18-alpine

# Install basic utilities
RUN apk add --no-cache curl bash jq

# Copy BWS binary from builder stage
COPY --from=bws-builder /sdk-sm-bws-v1.0.0/target/release/bws /usr/local/bin/bws

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Copy secret resolution script from the build context
COPY resolve-secret.sh /usr/local/bin/resolve-secret.sh
RUN chmod +x /usr/local/bin/resolve-secret.sh

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S validator -u 1001

# Change ownership
RUN chown -R validator:nodejs /app
USER validator

EXPOSE 8080

# Remove healthcheck since Cloud Run manages health checks

CMD ["node", "index.js"]