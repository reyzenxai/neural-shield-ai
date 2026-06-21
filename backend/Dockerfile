# --- Build stage: install all deps and compile TypeScript ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Runtime stage: production deps + compiled output only ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
# Winston file transports write here; ensure the directory exists.
RUN mkdir -p logs && addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 5000
# Hosts (Railway/Render/Fly) inject PORT at runtime; the app listens on it.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- "http://localhost:${PORT:-5000}/api/health" || exit 1

CMD ["node", "dist/server.js"]
