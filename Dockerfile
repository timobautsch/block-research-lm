# Block Research LM — Cloud Run container
# Node 24 (node:sqlite auth), ffmpeg + yt-dlp for media ingestion, local ONNX embedder.
FROM node:24-slim

# Deno: yt-dlp's JS-challenge runtime (>= 2.3.0 required since yt-dlp 2026.06.09).
# yt-dlp only enables Deno by default — the Node in this image is NOT picked up —
# and without a JS runtime YouTube extraction is degraded/deprecated.
COPY --from=denoland/deno:bin-2.3.3 /deno /usr/local/bin/deno

# bgutil PO-token provider server 1.3.1 (self-contained Node app, run with our
# Node 24). Mints the proof-of-origin tokens YouTube requires; the matching yt-dlp
# plugin below auto-discovers it on 127.0.0.1:4416 and forwards YTDLP_PROXY to it
# per-request, so token minting and downloads share one egress IP. Plugin and
# server MUST stay on the same version — the plugin refuses mismatched majors.
COPY --from=brainicism/bgutil-ytdlp-pot-provider:1.3.1 /app /opt/bgutil-pot-server

# System deps: ffmpeg (audio/video) + yt-dlp standalone binary (YouTube transcripts)
# + bgutil PO-token plugin zip (loaded from /etc/yt-dlp/plugins by the standalone
# binary). yt-dlp is pinned so it moves together with the plugin/provider versions.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
  && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/download/2026.06.09/yt-dlp_linux -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && mkdir -p /etc/yt-dlp/plugins \
  && curl -fsSL -o /etc/yt-dlp/plugins/bgutil-ytdlp-pot-provider.zip \
    https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/download/1.3.1/bgutil-ytdlp-pot-provider.zip \
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
CMD ["sh", "scripts/docker-start.sh"]
