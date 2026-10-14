# ─── Stage 1: Build Vite React SPA ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Install dependencies
RUN npm ci || npm install

# Copy application source
COPY . .

# Build production bundle
RUN npm run build

# ─── Stage 2: Production Nginx Server ──────────────────────────────────────────
FROM nginx:alpine AS runner

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
