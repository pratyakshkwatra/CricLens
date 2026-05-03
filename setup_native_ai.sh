#!/bin/bash
# CricLens Native AI Setup for M5 Max (MPS Acceleration)

echo "🚀 Initializing Native AI Environment (MPS)..."

# Create venv if not exists
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate

# Install requirements with MPS-ready Torch
pip install --upgrade pip
pip install torch torchvision torchaudio
pip install -r vision/requirements.txt
pip install -r ocr/requirements.txt
pip install -r backend/requirements.txt

# Export environment variables for native services
export VISION_SERVICE_URL="http://localhost:5001"
export OCR_SERVICE_URL="http://localhost:5002"
export OLLAMA_HOST="http://localhost:11434"
export REDIS_URL="redis://localhost:6379/0"
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/criclens"
export DEVICE="mps"

echo "✅ Environment Ready. Run services with: python vision/service.py & python ocr/service.py & celery -A main.celery_app worker"
