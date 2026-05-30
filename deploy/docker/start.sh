#!/bin/sh
# Single-container entrypoint for DigitalOcean App Platform.
#
# Runs the Celery worker AND the API web server in ONE container so they share
# the local filesystem (uploads/ and jobs/). App Platform does NOT share a
# filesystem between separate components, so a standalone worker component would
# write video results the API can never read. Co-locating them keeps async
# video jobs working on a single instance.
set -e

# Background: Celery worker (concurrency 1 to keep memory modest — each worker
# child loads its own copy of the ONNX model).
celery -A src.api.workers worker --loglevel=info --concurrency=1 &

# Foreground: the web server. App Platform injects $PORT (matches http_port).
exec uvicorn src.api.main:app --host 0.0.0.0 --port "${PORT:-8000}"
