# Deploying GoldenEye on DigitalOcean App Platform

**Backend only** — **FastAPI API + Celery worker (one container) + managed Redis** — on
DigitalOcean. The **frontend stays on Vercel** and calls this API over HTTPS; it is
deliberately *not* part of this spec.

## Why the wizard said "No components detected"

App Platform's auto-detector scans the repo **root** for `requirements.txt`, a
root `Dockerfile`, or `package.json`. This repo has none there — the Dockerfiles
are in `deploy/docker/`, the frontend's `package.json` is in `src/frontend/`, and
App Platform ignores `docker-compose.yml`. The fix is the App Spec at
[`.do/app.yaml`](../.do/app.yaml), which declares the component explicitly.

Two other things were also handled for you:

1. **The model is now committed.** `models/best.onnx` was `.gitignore`d and not on
   GitHub, so any build would have shipped an API with no weights. It is now
   force-added so the Docker build includes it.
2. **Web + worker share one container.** App Platform components do **not** share a
   filesystem, but video jobs read/write `uploads/` and `jobs/` on local disk. So
   `deploy/docker/start.sh` runs both the Celery worker and the web server in the
   same container. (Trade-off: it runs on a single instance. To scale the worker
   separately, move file I/O to DO Spaces / object storage — see "Scaling" below.)

## Prerequisites

- The changes above are pushed to `main` (done).
- A DigitalOcean account with billing enabled.
- Optional: the `doctl` CLI (`doctl auth init`).

## Deploy

### Option A — CLI
```bash
doctl apps create --spec .do/app.yaml
```

### Option B — Console
1. **Apps → Create App → Import from App Spec**.
2. Paste the contents of `.do/app.yaml` (or upload it).
3. Authorize the `NeuralMalkawii/GoldenEye` repo if prompted, then **Create**.

The first build takes a few minutes (it installs onnxruntime + OpenCV and copies
the model). When it's live you'll get a URL like
`https://goldeneye-xxxxx.ondigitalocean.app`.

## After it's live

1. **Point the frontend at the new API.** In Vercel, set
   `NEXT_PUBLIC_API_URL` to your App Platform URL and update the rewrite in
   `src/frontend/vercel.json`, then redeploy. (Today it points at the old Railway
   URL.)
2. **CORS.** `CORS_ORIGINS` in the spec is set to the Vercel production origin.
   Add any custom domain (comma-separated) and redeploy the app.
3. **Smoke test:** open `https://<app-url>/api/health` → should return `{"status": ...}`.

## Redis notes

- The spec attaches a managed Redis (`databases:` block) and binds
  `REDIS_URL = ${redis.DATABASE_URL}`, which is a **TLS `rediss://`** URL.
  `src/api/workers.py` now sets the Celery SSL options automatically for
  `rediss://` URLs.
- **If the create step rejects the dev-tier Redis** (some accounts only allow a
  managed cluster): create a **Valkey** database in the DO console, then either
  attach it to the app (keeps the `${redis.DATABASE_URL}` binding working) or set
  the `REDIS_URL` env var on the `api` component to the cluster's connection
  string. Remove the `databases:` block if you attach an existing cluster.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Build fails copying `models/` | Confirm `models/best.onnx` is on `main` (`git ls-files models/`). |
| API boots then crashes / OOM | Bump `instance_size_slug` to `basic-s` (more RAM). onnxruntime + OpenCV + worker need ≥1 GB. |
| Video upload never finishes | Check the runtime logs for the Celery line; verify `REDIS_URL` resolved (Settings → the `api` component → env vars). |
| Frontend calls fail (CORS) | Make sure `CORS_ORIGINS` exactly matches the Vercel origin (scheme + host, no trailing slash). |
| Health check failing | It hits `/api/health`; `initial_delay_seconds` is 30 to allow model load. Increase if cold start is slow. |

## Cost (rough)

- `api` service on `basic-xs`: ~$12/mo
- Managed Redis (Valkey), smallest: ~$15/mo

≈ **$25–30/mo**. To cut cost for a short demo, you can drop to `basic-xxs`
(512 MB — may OOM) and/or destroy the app between demos.

## Scaling (future)

To run the worker as a separate, independently-scalable component, move job I/O
off local disk: store uploads and results in **DO Spaces** (S3-compatible) and job
status in Redis instead of `jobs/*/meta.json`. Then split `api` and `worker` into
two components in the spec.
