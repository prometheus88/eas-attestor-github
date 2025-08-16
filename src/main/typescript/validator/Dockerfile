FROM node:18-alpine

# Install curl for health checks and Rust for building BWS
RUN apk add --no-cache curl bash jq wget tar gcc musl-dev

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Build BWS from source for correct architecture
RUN wget -O bws-source.tar.gz https://github.com/bitwarden/sdk-sm/archive/refs/tags/bws-v1.0.0.tar.gz && \
    tar -xzf bws-source.tar.gz
WORKDIR sdk-sm-bws-v1.0.0/crates/bws
RUN cargo build --release
RUN ls -la target/release/
RUN find . -name "bws" -type f
RUN cp target/release/bws /usr/local/bin/
WORKDIR /
RUN rm -rf sdk-sm-bws-v1.0.0 bws-source.tar.gz

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

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5001/health || exit 1

CMD ["node", "index.js"]
