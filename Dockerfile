# Nanas Block Research LM — Cloud Run container
# Node 24 (node:sqlite auth), ffmpeg + yt-dlp for media ingestion, local ONNX embedder.
FROM node:24-slim

# System deps: ffmpeg (audio/video) + yt-dlp standalone binary (YouTube transcripts).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies (full, build needs tsc/vite which live in devDependencies).
COPY package*.json ./
RUN npm ci

# App source + production build (tsc + vite -> dist).
COPY . .
RUN npm run build

ENV NODE_ENV=production \
    PORT=8080 \
    YTDLP_PATH=/usr/local/bin/yt-dlp \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    STORAGE_DIR=/app/.data/sourcestudio

EXPOSE 8080
CMD ["node", "server/index.js"]
