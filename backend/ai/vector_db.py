import os
import chromadb
from dotenv import load_dotenv

load_dotenv()

class VectorDB:
    def __init__(self):
        self.client = chromadb.HttpClient(
            host=os.getenv("CHROMA_HOST", "chroma"),
            port=int(os.getenv("CHROMA_PORT", 8000))
        )
        self.collection = self.client.get_or_create_collection(name="cricket_events")

    def add_events(self, video_id, events):
        ids = [f"{video_id}_{e['timestamp']}" for e in events]
        documents = [f"At {e['timestamp']}s: {e['shot_type']} detected with {e['confidence']} confidence. Context: {e.get('ocr', '')}" for e in events]
        metadatas = [{"video_id": video_id, "timestamp": e['timestamp']} for e in events]
        
        self.collection.add(
            ids=ids,
            documents=documents,
            metadatas=metadatas
        )

    def query_events(self, query_text, n_results=5):
        return self.collection.query(
            query_texts=[query_text],
            n_results=n_results
        )
