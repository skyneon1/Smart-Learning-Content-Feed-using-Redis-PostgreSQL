from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from . import models
import redis.asyncio as redis
import json

class RankingService:
    def __init__(self, db: AsyncSession, redis: redis.Redis):
        self.db = db
        self.redis = redis

    async def update_user_interest(self, user_id: str, topic: str, score_delta: float):
        """
        Updates the user's interest score for a specific topic.
        """
        key = f"user_interest:{user_id}"
        # Increment score for the topic
        await self.redis.hincrbyfloat(key, topic, score_delta)

    async def get_user_interests(self, user_id: str):
        key = f"user_interest:{user_id}"
        interests = await self.redis.hgetall(key)
        # Convert values to float
        return {k: float(v) for k, v in interests.items()}

    async def calculate_score(self, content: models.Content, interests: dict) -> float:
        """
        score = 0.5 * completion_rate + 0.3 * normalized_time_spent + 0.2 * topic_interest
        
        Since this function generates feed likely BEFORE interaction, 
        we rely mostly on topic interest for ranking NEW content.
        
        However, if we are re-ranking tracked content or using collaborative filtering, we'd use more.
        
        For the 'Feed Generation' step (showing items):
        Score = Base Score + (Topic Interest * Weight)
        
        Let's interpret the User's formula for *historical* interaction scoring (to update profile)
        vs *predictive* scoring (to rank feed).
        
        The user said: "Feed ranking adapts automatically per user."
        
        Let's assume Predictive Score for feed generation:
        Predictive Score = Topic Interest Score (from Redis)
        
        Wait, the user gave a specific formula:
        score = 0.5 * completion_rate + 0.3 * normalized_time_spent + 0.2 * topic_interest
        
        This formula relies on interaction metrics (`completion_rate`, `time_spent`) which don't exist for UNSEEN content.
        Maybe they mean: Use this formula to *grade* an interaction, and then use that grade to update the Topic Interest?
        
        OR, maybe they mean: Rank content based on *similar* users?
        
        Let's re-read: "Rank content based on user learning behavior... Feed ranking adapts automatically."
        
        Standard approach:
        1. When User interacts -> Calculate Interaction Score using the formula.
        2. Use Interaction Score to update Topic Interest.
        3. Rank Feed using Topic Interest (for unseen content).
        
        I will implement:
        1. `process_interaction`: Uses formula to calculate a 'Quality Score' of the interaction.
           Then updates Topic Interest.
        2. `generate_feed`:
           Score = Topic Interest * 1.0 (Simple predictive model).
           (Can add Recency weight too).
        """
        topic_score = interests.get(content.topic, 0.0)
        # Simple predictive score: Topic Interest + Recency (bonus)
        return topic_score

    async def process_interaction(self, user_id: str, content_id: str, time_spent: int, scroll_depth: int):
        # Fetch content to get details
        result = await self.db.execute(select(models.Content).where(models.Content.id == content_id))
        content = result.scalars().first()
        if not content:
            return

        # 1. Calculate Interaction Score
        # Completion Rate (0-1.0)
        completion_rate = min(scroll_depth / 100.0, 1.0)
        
        # Normalized Time Spent (0-1.0)
        # Cap at estimated_read_time * 1.5 to avoid idling
        est_time = content.estimated_read_time or 60
        norm_time = min(time_spent / est_time, 1.5)
        norm_time = min(norm_time, 1.0) # Clamp to 1.0 for formula consistency if desired
        
        # Topic Interest (Current)
        interests = await self.get_user_interests(user_id)
        current_topic_interest = interests.get(content.topic, 0.5) # Default 0.5 neutral
        
        # Formula from User
        interaction_score = (0.5 * completion_rate) + (0.3 * norm_time) + (0.2 * current_topic_interest)
        
        # 2. Update Topic Interest
        # If interaction score is high, boost topic. If low, lower it.
        # We'll simple add (Score - 0.5) * LearningRate
        delta = (interaction_score - 0.5) * 0.1
        await self.update_user_interest(user_id, content.topic, delta)
        
        # 3. Trigger Feed Re-ranking (Async usually, but we'll call it here for MVP)
        await self.generate_feed(user_id)

    async def generate_feed(self, user_id: str):
        """
        Fetches all content, ranks based on current interests, saves to Redis.
        """
        # Fetch all content
        result = await self.db.execute(select(models.Content))
        all_content = result.scalars().all()
        
        interests = await self.get_user_interests(user_id)
        
        scored_content = []
        for c in all_content:
            # Predictive Score = Topic Interest
            score = interests.get(c.topic, 0.0)
            scored_content.append({
                "id": c.id,
                "score": score
            })
            
        # Sort by score desc
        scored_content.sort(key=lambda x: x["score"], reverse=True)
        
        # Store in Redis Sorted Set
        key = f"feed:{user_id}"
        
        # Clear old feed (for MVP simplicity)
        await self.redis.delete(key)
        
        # Add to ZSET
        # ZADD key score member
        # redis-py zadd expects mapping {member: score}
        if scored_content:
            mapping = {item["id"]: item["score"] for item in scored_content}
            await self.redis.zadd(key, mapping)

    async def get_feed(self, user_id: str, limit: int = 10, offset: int = 0):
        key = f"feed:{user_id}"
        # ZREVRANGE to get highest scores first
        content_ids = await self.redis.zrange(key, start=offset, end=offset+limit-1, desc=True)
        
        if not content_ids:
            # If empty, generate feed once
            await self.generate_feed(user_id)
            content_ids = await self.redis.zrange(key, start=offset, end=offset+limit-1, desc=True)
            
        if not content_ids:
            return []
            
        # Fetch Content details from Postgres
        # Order must be preserved. SQL 'IN' clause doesn't guarantee order.
        stmt = select(models.Content).where(models.Content.id.in_(content_ids))
        result = await self.db.execute(stmt)
        contents = result.scalars().all()
        
        # Re-sort in python to match ZSET order
        content_map = {c.id: c for c in contents}
        ordered_content = []
        for cid in content_ids:
            if cid in content_map:
                c = content_map[cid]
                # Attach the score for visualization
                c.score = await self.redis.zscore(key, cid)
                ordered_content.append(c)
                
        return ordered_content
