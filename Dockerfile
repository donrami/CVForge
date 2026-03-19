# ============================================
# CVForge Dockerfile
# Multi-stage build for production optimization
# ============================================

# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --only=production

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the Vite app
RUN npm run build

# Stage 3: Production
FROM node:22-alpine AS runner
WORKDIR /app

# Install required system dependencies:
# - LaTeX for PDF compilation only
# Removed: graphicsmagick, poppler-utils, tesseract-ocr (now using Gemini Vision)
RUN apk add --no-cache \
    texlive \
    texlive-luatex \
    texlive-xetex \
    texmf-dist \
    && rm -rf /var/cache/apk/*

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 cvforge

# Copy built application
COPY --from=builder --chown=cvforge:nodejs /app/dist ./dist
COPY --from=builder --chown=cvforge:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=cvforge:nodejs /app/package.json ./package.json
COPY --from=builder --chown=cvforge:nodejs /app/prisma ./prisma
COPY --from=builder --chown=cvforge:nodejs /app/server.ts ./server.ts
COPY --from=builder --chown=cvforge:nodejs /app/server ./server
COPY --from=builder --chown=cvforge:nodejs /app/tsconfig.json ./tsconfig.json

# Create required directories with correct permissions
RUN mkdir -p context generated uploads uploads/certificates uploads/temp \
    && chown -R cvforge:nodejs context generated uploads

USER cvforge

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start the server
CMD ["node", "--import", "tsx", "server.ts"]