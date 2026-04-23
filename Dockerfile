# ─── Stage 1: Build frontend ────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

RUN corepack enable && corepack prepare pnpm@latest --activate \
    && pnpm config set store-dir /tmp/pnpm-store

WORKDIR /build/ui

COPY traffic-bot-ui/package.json traffic-bot-ui/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY traffic-bot-ui/ ./
# No VITE_API_URL → relative /api calls (same origin as backend)
RUN pnpm build \
    && rm -rf /tmp/pnpm-store node_modules


# ─── Stage 2: Python backend ─────────────────────────────────────────────────
FROM python:3.11-slim

# System dependencies for Chromium (used by nodriver)
# Let apt resolve chromium's own dependencies automatically
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    xvfb \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python deps
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Backend source (main.py uses: Path(__file__).parent.parent / "frontend/dist")
# So frontend/dist must be at /app/frontend/dist when running from /app/backend
COPY backend/ ./backend/

# Built frontend goes to /app/frontend/dist (matches the path in main.py)
COPY --from=frontend-builder /build/ui/dist ./frontend/dist/

# Persistent data volume for SQLite
VOLUME ["/data"]
ENV DATABASE_PATH=/data/traffic_bot.db
ENV SECRET_KEY=change-this-in-production
ENV PYTHONUNBUFFERED=1
ENV BROWSER_HEADLESS=true
ENV CHROME_BIN=/bin/chromium
ENV DISPLAY=:99

EXPOSE 8000

# Script de démarrage : lance Xvfb (virtual display) puis uvicorn
COPY backend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

WORKDIR /app/backend
CMD ["/docker-entrypoint.sh"]
