# ===== Stage 1: Build React =====
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build React app
RUN npm run build

# ===== Stage 2: Run Flask =====
FROM python:3.11-slim

WORKDIR /app

# Copy requirements và cài đặt Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Flask server
COPY frontend_server.py .

# Copy static files từ stage 1
COPY --from=frontend-builder /app/static_build ./static_build

ENV PYTHONUNBUFFERED=1
ENV PORT=5000

EXPOSE 5000

CMD gunicorn frontend_server:app --bind 0.0.0.0:${PORT} --workers 2 --threads 4 --timeout 120
