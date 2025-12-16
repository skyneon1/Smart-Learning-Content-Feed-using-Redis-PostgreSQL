from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from .database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    username = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Content(Base):
    __tablename__ = "content"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String)
    url = Column(String)
    topic = Column(String, index=True)
    estimated_read_time = Column(Integer) # In seconds
    created_at = Column(DateTime, default=datetime.utcnow)

class Interaction(Base):
    __tablename__ = "interactions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    content_id = Column(String, ForeignKey("content.id"))
    
    time_spent = Column(Integer) # In seconds
    scroll_depth = Column(Integer) # Percentage 0-100
    completion_rate = Column(Float) # 0.0 to 1.0
    
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User")
    content = relationship("Content")
