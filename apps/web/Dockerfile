# syntax=docker/dockerfile:1

FROM oven/bun:1.3.13 AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/

RUN bun install --frozen-lockfile

FROM oven/bun:1.3.13 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules

COPY package.json bun.lock turbo.json tsconfig.json ./
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
COPY packages/ui ./packages/ui

# Browser-facing API origin, baked in at build time.
# Local compose: http://localhost:3001
# Production:    https://api.toss.bramsuurd.nl
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=${VITE_API_URL}
RUN cd apps/web && bun run build

FROM nginx:1.27-alpine AS runner

RUN apk add --no-cache curl

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
