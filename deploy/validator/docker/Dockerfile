FROM node:20-slim

WORKDIR /app

# Install bws for Bitwarden secrets
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Bitwarden Secrets Manager CLI (optional - skipped for now)
# RUN curl -L -o bws.zip "https://github.com/bitwarden/sdk/releases/latest/download/bws-x86_64-unknown-linux-gnu.zip" \
#     && unzip bws.zip \
#     && chmod +x bws \
#     && mv bws /usr/local/bin/ \
#     && rm bws.zip

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-5001}/health || exit 1

# Run as non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 5001

CMD ["npm", "start"]