import cv2
import base64
import uvicorn
import numpy as np
import pytesseract
from fastapi import FastAPI, UploadFile, File
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="CricLens OCR Service")

@app.post("/extract")
async def extract_text(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Preprocessing: Focused ROI (Lower 15%) + Speed Optimization
    h, w = img.shape[:2]
    # More aggressive crop to just the likely scoreboard zone
    scoreboard_area = img[int(h*0.85):h, 0:w]
    # Downscale for faster OCR without losing digit clarity
    scoreboard_area = cv2.resize(scoreboard_area, None, fx=0.5, fy=0.5)
    
    gray = cv2.cvtColor(scoreboard_area, cv2.COLOR_BGR2GRAY)
    _, gray = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY_INV) 
    
    # Get bounding box data and text (Oem 1 = LSTM fast mode)
    custom_config = r'--oem 1 --psm 6'
    lines = []
    try:
        d = pytesseract.image_to_data(gray, config=custom_config, output_type=pytesseract.Output.DICT)
        n_boxes = len(d['level'])
        for i in range(n_boxes):
            conf = int(d['conf'][i])
            text = d['text'][i].strip()
            if conf > 40 and text: # Lower threshold for scoreboard digits
                lines.append(text)
    except Exception as e:
        print(f"OCR Data Error: {e}")

    # Full image pass for general context (lower priority)
    full_text = ""
    try:
        full_text = pytesseract.image_to_string(img)
    except Exception as e:
        print(f"OCR String Error: {e}")
    
    return {
        "raw_text": full_text,
        "lines": lines,
        "scoreboard_hints": lines,
        "annotated_image": "pending" # Removed for speed
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5002)
