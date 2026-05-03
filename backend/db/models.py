from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import datetime
import os

Base = declarative_base()

class Video(Base):
    __tablename__ = "videos"
    id = Column(String, primary_key=True)
    filename = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default="processing")
    
    events = relationship("Event", back_populates="video")
    insights = relationship("Insight", back_populates="video", uselist=False)

class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True)
    video_id = Column(String, ForeignKey("videos.id"))
    timestamp = Column(Float)
    shot_type = Column(String)
    ball_type = Column(String, nullable=True)
    runs = Column(Integer, default=0)
    confidence = Column(Float)
    vision_img = Column(String)
    ocr_img = Column(String)
    
    video = relationship("Video", back_populates="events")

class Insight(Base):
    __tablename__ = "insights"
    id = Column(Integer, primary_key=True)
    video_id = Column(String, ForeignKey("videos.id"))
    summary = Column(Text)
    strengths = Column(Text)
    weaknesses = Column(Text)
    
    video = relationship("Video", back_populates="insights")

# DB Setup
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)
