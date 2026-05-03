#!/bin/bash
# CricLens All-in-One Launcher (Hybrid Native-Docker)
# This uses Docker for infra and Native for M5 Max GPU Acceleration

echo "🏏 Starting CricLens Pro Suite..."

# 1. Start Docker Infrastructure
echo "🐳 Starting Infrastructure (Postgres, Redis, Chroma, Nginx, Frontend)..."
docker-compose up -d --build db redis chroma nginx frontend api

# 2. Start Native AI Services (MPS Enabled)
echo "🚀 Starting Native AI Services on M5 Max GPU..."

if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install torch torchvision torchaudio
    pip install -r vision/requirements.txt
    pip install -r ocr/requirements.txt
    pip install -r backend/requirements.txt
else
    source venv/bin/activate
fi

# Function to kill all background processes on exit
cleanup() {
    echo "🛑 Shutting down..."
    kill $(jobs -p)
    docker-compose down
    exit
}
trap cleanup SIGINT

# Start AI Services in background
export DEVICE="mps"
export VISION_SERVICE_URL="http://localhost:5001"
export OCR_SERVICE_URL="http://localhost:5002"
export OLLAMA_HOST="http://localhost:11434"
export REDIS_URL="redis://localhost:6379/0"
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/criclens"
export CHROMA_HOST="localhost"

(cd vision && ../venv/bin/python service.py) &
(cd ocr && ../venv/bin/python service.py) &
(cd backend && ../venv/bin/celery -A main.celery_app worker --loglevel=info) &

echo "✨ System Live at http://localhost"
echo "Press Ctrl+C to stop all services."

# Keep script running
wait
