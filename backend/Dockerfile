# ─── HealthSaathi AI Backend Production Dockerfile ─────────────────────────────
# Multi-runtime image supporting Node.js 20, TypeScript, Python 3, and Tesseract OCR
FROM node:20-bookworm-slim

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

# 1. Install system utilities, Python 3, and Tesseract OCR with English, Hindi, Telugu models
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-hin \
    tesseract-ocr-tel \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 2. Copy dependency manifests
COPY package.json package-lock.json* ./
COPY ocr/requirements.txt ./ocr/requirements.txt

# 3. Install Node.js dependencies (including devDependencies required for tsc build)
RUN npm install --include=dev

# 4. Set up Python virtual environment and install OCR requirements
RUN python3 -m venv /app/ocr/.venv && \
    /app/ocr/.venv/bin/pip install --no-cache-dir --upgrade pip && \
    /app/ocr/.venv/bin/pip install --no-cache-dir -r ./ocr/requirements.txt

# 5. Copy full application source code
COPY . .

# 6. Compile TypeScript to JavaScript
RUN npm run build

# 7. Prune devDependencies to keep container image minimal
RUN npm prune --production

# 8. Set environment pointers for Python OCR runner
ENV PYTHON_PATH=/app/ocr/.venv/bin/python3
ENV TESSERACT_CMD=/usr/bin/tesseract

# Expose port (Cloud Run defaults to 8080)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health/live || exit 1

# Start production server
CMD ["node", "dist/server.js"]
