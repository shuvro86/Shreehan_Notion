FROM node:22-bookworm-slim AS web
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./frontend/
WORKDIR /app/frontend
RUN npm ci
WORKDIR /app
COPY frontend/app ./frontend/app
COPY frontend/public ./frontend/public
COPY frontend/next.config.ts frontend/postcss.config.mjs frontend/tsconfig.json frontend/next-env.d.ts ./frontend/
COPY data ./data
WORKDIR /app/frontend
RUN npm run build

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS runtime
WORKDIR /app
ENV PYTHONUNBUFFERED=1 UV_LINK_MODE=copy DATABASE_PATH=/app/storage/shreehan.db APP_STATIC_DIR=/app/out NOTION_SYNC_DIR=/app/storage/notion-sync OCR_MODEL_DIR=/usr/share/tesseract-ocr/5/tessdata OCR_CACHE_DIR=/app/storage/ocr-cache
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils tesseract-ocr-eng tesseract-ocr-ben && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev
COPY --from=web /usr/local/bin/node /usr/local/bin/node
COPY --from=web /app/frontend/node_modules ./node_modules
COPY --from=web /app/frontend/package.json ./package.json
COPY backend ./backend
COPY data ./data
COPY server ./server
COPY scripts/sync-notion.mjs scripts/prepare-unseen.mjs scripts/container-start.sh ./scripts/
COPY --from=web /app/frontend/out ./out
VOLUME ["/app/storage"]
EXPOSE 8000
CMD ["sh", "scripts/container-start.sh"]
