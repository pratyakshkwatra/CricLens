import os
import subprocess
import uuid
import uvicorn
import json
import asyncio
import redis.asyncio as redis
from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from celery import Celery
from dotenv import load_dotenv

from db.models import SessionLocal, Video, init_db
from ai.vector_db import VectorDB
from ai.insight_engine import InsightEngine

load_dotenv()

from fastapi.middleware.cors import CORSMiddleware

# Redis Setup for Pub/Sub
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
redis_client = redis.from_url(REDIS_URL)

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, file_id: str, websocket: WebSocket):
        await websocket.accept()
        if file_id not in self.active_connections:
            self.active_connections[file_id] = []
        self.active_connections[file_id].append(websocket)

    def disconnect(self, file_id: str, websocket: WebSocket):
        if file_id in self.active_connections:
            self.active_connections[file_id].remove(websocket)

    async def broadcast(self, file_id: str, message: dict):
        if file_id in self.active_connections:
            for connection in self.active_connections[file_id]:
                await connection.send_json(message)

manager = ConnectionManager()

async def redis_listener():
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("telemetry")
    async for message in pubsub.listen():
        if message["type"] == "message":
            data = json.loads(message["data"])
            file_id = data.get("file_id")
            if file_id:
                await manager.broadcast(file_id, data)

# FastAPI App
app = FastAPI(title="CricLens API")

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(redis_listener())

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Celery Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
celery_app = Celery("criclens", broker=REDIS_URL, backend=REDIS_URL)
celery_app.conf.update(task_track_started=True)
import pipeline

init_db()

UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/history")
async def get_history():
    if not os.path.exists(OUTPUT_DIR):
        return []
    
    history = []
    for file_id in os.listdir(OUTPUT_DIR):
        if os.path.isdir(os.path.join(OUTPUT_DIR, file_id)):
            # Check for events.json to confirm processing
            events_path = os.path.join(OUTPUT_DIR, file_id, "events.json")
            if os.path.exists(events_path):
                history.append({
                    "id": file_id,
                    "processed": True
                })
    return history

@app.post("/upload")
async def upload_video(
    file: UploadFile = File(...),
    start: float = 0,
    end: float = None,
    is_turbo: bool = False
):
    file_id = str(uuid.uuid4())
    ext = file.filename.split('.')[-1]
    temp_path = os.path.join(UPLOAD_DIR, f"temp_{file_id}.{ext}")
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.{ext}")
    
    with open(temp_path, "wb") as buffer:
        buffer.write(await file.read())
        
    # Trim video using FFmpeg
    trim_cmd = ["ffmpeg", "-ss", str(start), "-i", temp_path]
    if end:
        trim_cmd.extend(["-to", str(end)])
    trim_cmd.extend(["-c", "copy", file_path])
    
    subprocess.run(trim_cmd, check=True)
    os.remove(temp_path)
    
    # Create DB record
    db = SessionLocal()
    video = Video(id=file_id, filename=file.filename)
    db.add(video)
    db.commit()
    db.close()
    
    # Trigger async pipeline
    task = celery_app.send_task("pipeline.process_video", args=[file_id, file_path, is_turbo])
    
    return {"id": file_id, "task_id": task.id, "status": "processing"}

@app.get("/status/{file_id}")
async def get_status(file_id: str):
    path = os.path.join(OUTPUT_DIR, file_id)
    if not os.path.exists(path):
        return {"status": "initializing", "progress": 10}
    
    # Check progress based on files
    has_frames = any(f.endswith(".jpg") for f in os.listdir(path))
    has_events = os.path.exists(os.path.join(path, "events.json"))
    has_insights = os.path.exists(os.path.join(path, "insights.json"))
    
    if has_insights:
        return {"status": "complete", "progress": 100}
    if has_events:
        return {"status": "synthesizing", "progress": 80, "step": "Insight Engine Generating Narrative"}
    if has_frames:
        return {"status": "processing", "progress": 40, "step": "Neural Vision & OCR Active"}
    
    return {"status": "extracting", "progress": 20, "step": "Frame Extraction & Audio Fusion"}

@app.websocket("/ws/{file_id}")
async def websocket_endpoint(websocket: WebSocket, file_id: str):
    await manager.connect(file_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(file_id, websocket)

@app.get("/events/{file_id}")
async def get_events(file_id: str):
    db = SessionLocal()
    video = db.query(Video).filter(Video.id == file_id).first()
    if not video:
        return {"error": "Video not found"}
    events = video.events
    insights = video.insights
    db.close()
    return {
        "events": events,
        "insights": {
            "summary": insights.summary if insights else "",
            "strengths": insights.strengths if insights else "",
            "weaknesses": insights.weaknesses if insights else ""
        }
    }

@app.get("/query")
async def query_match_history(q: str):
    vdb = VectorDB()
    results = vdb.query_events(q)
    return results

@app.post("/compare")
async def compare_performances(video_id_1: str, video_id_2: str):
    db = SessionLocal()
    v1 = db.query(Video).filter(Video.id == video_id_1).first()
    v2 = db.query(Video).filter(Video.id == video_id_2).first()
    
    if not v1 or not v2:
        return {"error": "Video(s) not found"}
        
    engine = InsightEngine()
    
    prompt = f"""
    Compare these two match performances:
    Match 1: {v1.insights.summary if v1.insights else "No data"}
    Match 2: {v2.insights.summary if v2.insights else "No data"}
    
    Provide a concise technical comparison of player behavior and key differences.
    """
    
    comparison = engine.model.generate_content(prompt).text if engine.model else "Analytic comparison pending."
    db.close()
    return {"comparison": comparison}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
