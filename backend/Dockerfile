FROM python:3.12-slim AS python-builder
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


FROM node:20-alpine AS node-builder
WORKDIR /app
COPY dashboard/package.json dashboard/package-lock.json ./dashboard/
RUN cd dashboard && npm ci
COPY dashboard/ ./dashboard/
RUN cd dashboard && npm run build


FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=shaasthi_backend.settings \
    GUNICORN_WORKERS=4 \
    GUNICORN_LOG_LEVEL=info \
    HOME=/app
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=python-builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=python-builder /usr/local/bin /usr/local/bin
COPY --from=node-builder /app/dashboard/static/dashboard/ /app/dashboard/static/dashboard/

COPY . .
RUN addgroup --system --gid 1001 django \
    && adduser --system --uid 1001 --ingroup django django \
    && mkdir -p /app/staticfiles /app/media /app/logs \
    && chown -R django:django /app
USER django
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -sf http://localhost:8000/health/ || exit 1
CMD ["python", "-m", "scripts.start"]
