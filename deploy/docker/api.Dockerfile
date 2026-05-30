FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ src/
COPY models/ models/
COPY deploy/docker/start.sh ./start.sh

# The app is imported by path (src.api.main:app) from /app, not installed as a package.
ENV PYTHONPATH=/app
EXPOSE 8000
# Default (local / docker-compose): web only. App Platform overrides this with
# `sh start.sh` (web + Celery worker in one container) via run_command.
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
