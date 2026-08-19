# ===== Stage 1: Build React =====
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build


# ===== Stage 2: Run Flask =====
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY frontend_server.py .

COPY --from=frontend-builder /app/static_build ./static_build

ENV PYTHONUNBUFFERED=1

CMD gunicorn frontend_server:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120
