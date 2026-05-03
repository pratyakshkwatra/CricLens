import os
import io
import json
import base64
import cv2
import torch
import uvicorn
import numpy as np
from fastapi import FastAPI, UploadFile, File
from ultralytics import YOLO
from PIL import Image
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="CricLens Vision Service")

# Device configuration
DEVICE = os.getenv("DEVICE", "cpu")
if DEVICE == "mps":
    if torch.backends.mps.is_available():
        print("🚀 Neural Acceleration Active: Using Mac GPU.")
    else:
        print("⚠️ MPS requested but not available. Falling back to CPU.")
        DEVICE = "cpu"
elif DEVICE == "cuda" and not torch.cuda.is_available():
    print("CUDA not available, falling back to CPU")
    DEVICE = "cpu"

print(f"Using device: {DEVICE}")

# Load RT-DETR-l (High Speed / High Accuracy Balance)
yolo_model = YOLO("rtdetr-l.pt").to(DEVICE)

@app.post("/detect")
async def detect_objects(
    file: UploadFile = File(...),
    prev_balls: str = None
):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    img_h, img_w = img.shape[:2]
    img_area = img_h * img_w
    
    # Cricket labels mapping (from COCO)
    COCO_MAP = {
        "person": "player",
        "sports ball": "ball",
        "baseball bat": "bat",
        "baseball glove": "glove"
    }
    
    results = yolo_model(img, verbose=False, conf=0.15) # Lower threshold for better recall
    detections = []
    ball_center = None
    annotated_img = img.copy()
    
    for r in results:
        for box in r.boxes:
            cls = int(box.cls[0])
            raw_label = yolo_model.names[cls]
            label = COCO_MAP.get(raw_label, raw_label)
            conf = float(box.conf[0])
            bbox = box.xyxy[0].tolist()
            
            # Filter out ghost detections (>80% area)
            x1, y1, x2, y2 = map(int, bbox)
            box_area = (x2 - x1) * (y2 - y1)
            if box_area > 0.8 * img_area: continue
            
            # Only track relevant cricket objects
            if label not in ["player", "ball", "bat"]: continue
            
            detections.append({
                "class": label,
                "confidence": conf,
                "bbox": bbox
            })
            
            color = (135, 230, 163) # Lime for players
            if label == "ball":
                color = (0, 255, 255) # Cyber Yellow
                ball_center = [int((x1 + x2) / 2), int((y1 + y2) / 2)]
            elif label == "bat":
                color = (255, 0, 255) # Magenta
            
            # Neural Glow effect
            mask_overlay = np.zeros_like(annotated_img)
            cv2.rectangle(mask_overlay, (x1, y1), (x2, y2), color, -1)
            kernel = np.ones((5,5), np.uint8)
            glow_mask = cv2.dilate(mask_overlay, kernel, iterations=2)
            cv2.addWeighted(annotated_img, 1.0, glow_mask, 0.2, 0, annotated_img)
            cv2.addWeighted(annotated_img, 1.0, mask_overlay, 0.3, 0, annotated_img)
            
            # Border & Label
            cv2.rectangle(annotated_img, (x1, y1), (x2, y2), color, 2)
            label_text = label.upper()
            (tw, th), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)
            cv2.rectangle(annotated_img, (x1, y1 - th - 10), (x1 + tw, y1), color, -1)
            cv2.putText(annotated_img, label_text, (x1, y1 - 5), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0,0,0), 1, cv2.LINE_AA)
            
    # Encode annotated image (Downscale for telemetry performance)
    preview_img = cv2.resize(annotated_img, (640, int(640 * img_h / img_w)))
    _, buffer = cv2.imencode('.jpg', preview_img, [cv2.IMWRITE_JPEG_QUALITY, 70])
    img_str = base64.b64encode(buffer).decode('utf-8')
            
    return {
        "detections": detections,
        "ball_center": ball_center,
        "annotated_image": f"data:image/jpeg;base64,{img_str}"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5001)
