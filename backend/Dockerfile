# ── Stage 1: Install all dependencies ────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package*.json ./
# Install everything (including devDeps) for the build stage
RUN npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retries 5 \
 && npm ci

# ── Stage 2: Build TypeScript ─────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Stage 3: Production runner (minimal image) ────────────────────────────────
FROM node:22-alpine AS production
RUN apk add --no-cache dumb-init
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 appuser

# Copy only compiled output + prod dependencies
COPY package*.json ./
RUN npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retries 5 \
 && npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder --chown=appuser:nodejs /app/dist ./dist

USER appuser

EXPOSE 5000

# dumb-init handles SIGTERM/SIGINT properly in containers
CMD ["dumb-init", "node", "dist/index.js"]

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/v1/health || exit 1

# ── Stage 4: Development ──────────────────────────────────────────────────────
FROM deps AS development
WORKDIR /app
COPY . .
CMD ["npm", "run", "dev"]
