# Python slim + uvicorn, non-root user
FROM python:3.11-slim AS base

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*

# Install requirements first for layer caching
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend /app

# Drop privileges
RUN useradd -u 1001 -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
ENV PORT=8000

# NOTE: If later you need to serve the built React frontend statically from the same container,
# you could add a build stage and copy build/ into /app/static, then serve via an ASGI middleware.
# For now API only.

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
