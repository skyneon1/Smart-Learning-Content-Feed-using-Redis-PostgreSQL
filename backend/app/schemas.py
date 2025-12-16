from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ContentBase(BaseModel):
    title: str
    url: str
    topic: str
    estimated_read_time: int

class ContentCreate(ContentBase):
    pass

class Content(ContentBase):
    id: str
    created_at: datetime
    score: Optional[float] = None # Calculated field for feed

    class Config:
        orm_mode = True

class InteractionCreate(BaseModel):
    user_id: str
    content_id: str
    time_spent: int
    scroll_depth: int
    skipped: bool = False

class UserCreate(BaseModel):
    username: str

class FeedResponse(BaseModel):
    items: List[Content]
    next_cursor: Optional[int] = None
