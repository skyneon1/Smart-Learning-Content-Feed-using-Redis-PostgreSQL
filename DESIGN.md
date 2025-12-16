# Smart Learning Content Feed - System Design

## 1. High-Level Architecture

```mermaid
graph TD
    User[User (Browser)] -->|HTTP GET /feed| API[FastAPI Backend]
    User -->|HTTP POST /track| API
    API -->|Read/Write| DB[(PostgreSQL)]
    API -->|Read/Write| Cache[(Redis)]
    
    subgraph Background
        API -.->|Async Update| Ranker[Ranking Worker]
        Ranker -->|Read Interactions| DB
        Ranker -->|Update Scores| Cache
    end
```

**Components:**
- **Frontend (React)**: Handles infinite scroll, behavior tracking (time on page, scroll depth), and rendering the feed.
- **Backend (FastAPI)**: Rest API for serving content and receiving telemetry.
- **PostgreSQL**: Persistent storage for users, content metadata, and raw interaction logs.
- **Redis**: 
    - **Feed Cache**: Stores pre-computed ranked lists of content IDs per user (`feed:{user_id}`).
    - **User Profile**: Stores dynamic interest scores (`user_interest:{user_id}`).

## 2. Database Schema (PostgreSQL)

### Users Table
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary Key |
| username | String | Unique username |
| created_at | Timestamp | |

### Content Table
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary Key |
| title | String | |
| url | String | |
| topic | String | e.g., "python", "react", "ml" |
| estimated_read_time | Integer | Seconds |
| created_at | Timestamp | |

### UserInteractions Table
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary Key |
| user_id | UUID | FK -> Users |
| content_id | UUID | FK -> Content |
| time_spent | Integer | Seconds spent interacting |
| scroll_depth | Integer | Percentage (0-100) |
| completion_rate | Float | Calculated (0.0 - 1.0) |
| timestamp | Timestamp | When interaction occurred |

## 3. Redis Data Structures

1. **User Interests** (Hash)
   Key: `user_interest:{user_id}`
   Fields: `{topic} -> {score}`
   *Used to quickly multiply content scores by user interest.*

2. **Pre-calculated Feed** (Sorted Set or List)
   Key: `feed:{user_id}`
   Values: `content_id`
   Score: `calculated_ranking_score`
   *Sorted set allows rapid retrieval of top components.*

## 4. Ranking Algorithm

**Formula:**
`score = 0.5 * completion_rate + 0.3 * normalized_time_spent + 0.2 * topic_interest`

- **Completion Rate**: `scroll_depth / 100` (capped at 1.0) or explicit "finished" action.
- **Normalized Time Spent**: `min(time_spent / estimated_read_time, 1.0)`
- **Topic Interest**: Current score for the content's topic from Redis.

**Updates:**
- When content is tracked, recalculate interest for that topic.
- Decay old interests slightly to allow new interests to emerge.

## 5. API Design

### `GET /feed`
**Query Params:**
- `cursor` (int, optional): Offset for pagination.
- `limit` (int, default=10): Number of items.

**Response:**
```json
{
  "items": [
    {
      "id": "...",
      "title": "...",
      "score": 0.85
    }
  ],
  "next_cursor": 10
}
```

### `POST /track`
**Body:**
```json
{
  "user_id": "...",
  "content_id": "...",
  "time_spent": 45,
  "scroll_depth": 80
}
```
