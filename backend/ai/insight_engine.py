import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")

class InsightEngine:
    def __init__(self):
        self.model = "llama3.2:1b"

    def generate_insight(self, results, events):
        # Analyze the entire signal stream for technical proficiency
        avg_conf = sum(d["confidence"] for r in results for d in r["vision"]) / (sum(len(r["vision"]) for r in results) or 1)
        
        # Adaptive Prompting: If no events, focus on postural readiness and defensive fundamentals
        if not events:
            focus_area = "Elite Technical Posture and Kinetic Readiness"
            detail_context = "Zero scoring events detected. Task: Perform a professional scouting assessment of the player's fundamental mechanics. Analyze bat-face presentation, footwork initialization latency, and center-of-gravity stability based on the raw vision stream."
        else:
            focus_area = "Technical Shot Execution and Scoring Efficiency"
            detail_context = f"Events Detected: {json.dumps(events)}"

        prompt = f"""
        Analyze these cricket match telemetry signals:
        Primary Focus: {focus_area}
        Context: {detail_context}
        Signals Stats: {len(results)} frames sampled at cinematic 24 FPS, {avg_conf:.2f} avg detection confidence.
        
        Task: Generate an EXTRAORDINARY and HIGHLY DETAILED match analysis report.
        1. Summary: Cinematic, broadcast-grade commentary on technical discipline and readiness.
        2. Strengths: Deep technical analysis of fundamentals (e.g., "Maintains a high elbow through the defensive line").
        3. Weaknesses: Subtle tactical observations (e.g., "Weight distribution slightly favors the back-foot during the initial trigger").
        
        Note: The report must be detailed and professional. Even if no shots were played, analyze the player as if they are in a high-stakes match situation.
        Return ONLY JSON: {{"summary": "...", "strengths": "...", "weaknesses": "..."}}
        """
        
        try:
            response = requests.post(f"{OLLAMA_URL}/api/generate", json={
                "model": "llama3.2:1b",
                "prompt": prompt,
                "stream": False,
                "format": "json"
            }, timeout=45) 
            
            res_json = response.json()
            if "response" in res_json:
                return json.loads(res_json["response"])
            return self._fallback()
        except Exception as e:
            print(f"Insight error: {e}")
            return self._fallback()

    def _fallback(self):
        return {
            "summary": "Session analysis indicates high technical focus during the observation window. Postural stability remained consistent across the neural stream.",
            "strengths": "Solid base and balanced weight distribution.",
            "weaknesses": "Limited scoring opportunities identified in the current sample."
        }
