#!/bin/sh
# Cloud Run entrypoint: start the yt-dlp PO-token provider (best-effort sidecar),
# then the app server. yt-dlp keeps working without the provider — YouTube just
# rejects tokenless requests more aggressively, so treat it as an enhancement.
if [ -f /opt/bgutil-pot-server/build/main.js ]; then
  node /opt/bgutil-pot-server/build/main.js --port 4416 &
fi
exec node server/index.js
