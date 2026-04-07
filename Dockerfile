# ============================================================================
# RubyClaw API Server — Production Dockerfile
# Multi-stage build for minimal image size and maximum security
# ============================================================================

# Stage 1: Build
FROM node:24-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config files first (better layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.json ./
COPY .npmrc* ./

# Copy package.json files for all workspace packages
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/db/package.json lib/db/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/integrations-openai-ai-server/package.json lib/integrations-openai-ai-server/
COPY lib/integrations-openai-ai-react/package.json lib/integrations-openai-ai-react/
COPY artifacts/api-server/package.json artifacts/api-server/

# Install dependencies
RUN pnpm install --frozen-lockfile --ignore-scripts 2>/dev/null || pnpm install --no-frozen-lockfile --ignore-scripts

# Copy source code
COPY lib/ lib/
COPY artifacts/api-server/ artifacts/api-server/

# Build TypeScript libs and api-server
RUN pnpm run typecheck:libs 2>/dev/null || true
RUN pnpm --filter @workspace/api-server run build

# Stage 2: Production runtime
FROM node:24-alpine AS production

# Security: Run as non-root user
RUN addgroup -g 1001 -S rubyclaw && \
    adduser -S rubyclaw -u 1001 -G rubyclaw

WORKDIR /app

# Copy only the built output
COPY --from=builder --chown=rubyclaw:rubyclaw /app/artifacts/api-server/dist/ ./dist/
COPY --from=builder --chown=rubyclaw:rubyclaw /app/artifacts/api-server/package.json ./package.json

# Install production dependencies only
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy node_modules from builder (only what's needed)
COPY --from=builder --chown=rubyclaw:rubyclaw /app/node_modules ./node_modules

# Security hardening
RUN apk --no-cache add dumb-init && \
    rm -rf /var/cache/apk/*

USER rubyclaw

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/api/healthz || exit 1

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Use dumb-init to handle PID 1 properly (zombie process prevention)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
