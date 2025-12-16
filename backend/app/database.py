import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
import redis.asyncio as redis

# Postgres
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:password@db/learning_feed")

engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

# Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

async def get_redis():
    r = redis.from_url(REDIS_URL, decode_responses=True)
    try:
        yield r
    finally:
        await r.close()
