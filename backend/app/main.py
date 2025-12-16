from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.middleware.cors import CORSMiddleware
from . import database, models, schemas, ranking
from sqlalchemy import select, desc
import redis.asyncio as redis
from typing import List
from fastapi import WebSocket, WebSocketDisconnect

# WebSocket Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Handle broken pipes
                pass

manager = ConnectionManager()

app = FastAPI(title="Smart Learning Feed")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    async with database.engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)

@app.post("/seed")
async def seed_content(db: AsyncSession = Depends(database.get_db)):
    """Seeds the database with sample content."""
    res = await db.execute(select(models.Content))
    if res.scalars().first():
        return {"message": "Already seeded"}
        
    sample_content = [
        {"title": "Intro to Python FastApi", "topic": "python", "estimated_read_time": 300, "url": "https://fastapi.tiangolo.com/"},
        {"title": "Advanced React Hooks", "topic": "react", "estimated_read_time": 450, "url": "https://reactjs.org/docs/hooks-intro.html"},
        {"title": "Machine Learning Basics", "topic": "ml", "estimated_read_time": 600, "url": "https://scikit-learn.org/stable/"},
        {"title": "Redis for Caching", "topic": "backend", "estimated_read_time": 200, "url": "https://redis.io/"},
        {"title": "Docker Compose Guide", "topic": "devops", "estimated_read_time": 400, "url": "https://docs.docker.com/compose/"},
        {"title": "Asyncio in Python", "topic": "python", "estimated_read_time": 500, "url": "https://docs.python.org/3/library/asyncio.html"},
        {"title": "Postgres Indexing", "topic": "database", "estimated_read_time": 350, "url": "https://www.postgresql.org/docs/current/indexes.html"},
        {"title": "Tailwind CSS Tips", "topic": "frontend", "estimated_read_time": 180, "url": "https://tailwindcss.com/"},
        {"title": "Understanding Neural Networks", "topic": "ml", "estimated_read_time": 900, "url": "https://en.wikipedia.org/wiki/Neural_network"},
        {"title": "FastAPI Dependency Injection", "topic": "python", "estimated_read_time": 320, "url": "https://fastapi.tiangolo.com/tutorial/dependencies/"},
    ]
    
    for item in sample_content:
        db_item = models.Content(**item)
        db.add(db_item)
    
    await db.commit()
    return {"message": "Seeded content", "count": len(sample_content)}

@app.get("/feed", response_model=schemas.FeedResponse)
async def get_feed(
    user_id: str,
    cursor: int = Query(0, description="Pagination cursor (offset)"),
    limit: int = 5,
    db: AsyncSession = Depends(database.get_db),
    r: redis.Redis = Depends(database.get_redis)
):
    ranker = ranking.RankingService(db, r)
    items = await ranker.get_feed(user_id, limit, cursor)
    next_cursor = cursor + len(items) if items else None
    return {"items": items, "next_cursor": next_cursor}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.post("/track")
async def track_interaction(
    interaction: schemas.InteractionCreate,
    db: AsyncSession = Depends(database.get_db),
    r: redis.Redis = Depends(database.get_redis)
):
    db_interaction = models.Interaction(**interaction.dict())
    db.add(db_interaction)
    await db.commit()
    
    # Refresh to get timestamp and IDs
    await db.refresh(db_interaction)
    
    # Broadcast to dashboard
    # Need to fetch content title for display
    result = await db.execute(select(models.Content).where(models.Content.id == interaction.content_id))
    content = result.scalars().first()
    
    msg = {
        "type": "new_interaction",
        "data": {
            "id": str(db_interaction.id),
            "timestamp": db_interaction.timestamp.isoformat(),
            "topic": content.topic if content else "unknown",
            "content_title": content.title if content else "unknown",
            "time_spent": db_interaction.time_spent,
            "scroll_depth": db_interaction.scroll_depth
        }
    }
    await manager.broadcast(msg)
    
    ranker = ranking.RankingService(db, r)
    await ranker.process_interaction(
        interaction.user_id, 
        interaction.content_id, 
        interaction.time_spent, 
        interaction.scroll_depth
    )
    return {"status": "tracked"}

# --- Dashboard Endpoints ---

@app.get("/dashboard/interests/{user_id}")
async def get_user_interests_debug(
    user_id: str,
    r: redis.Redis = Depends(database.get_redis),
    db: AsyncSession = Depends(database.get_db) # unused but kept for consistency
):
    """Returns the raw interest scores from Redis for visualization."""
    ranker = ranking.RankingService(db, r)
    return await ranker.get_user_interests(user_id)

@app.get("/dashboard/recent-activity")
async def get_recent_activity(
    limit: int = 10,
    db: AsyncSession = Depends(database.get_db)
):
    """Returns the most recent interactions across all users for the dashboard."""
    # We need to join with Content to make it readable
    stmt = (
        select(models.Interaction, models.Content.title, models.Content.topic)
        .join(models.Content, models.Interaction.content_id == models.Content.id)
        .order_by(desc(models.Interaction.timestamp))
        .limit(limit)
    )
    result = await db.execute(stmt)
    
    # Format for frontend
    activities = []
    for interaction, title, topic in result:
        activities.append({
            "id": interaction.id,
            "user_id": interaction.user_id,
            "content_title": title,
            "topic": topic,
            "time_spent": interaction.time_spent,
            "scroll_depth": interaction.scroll_depth,
            "timestamp": interaction.timestamp
        })
        
    return activities
