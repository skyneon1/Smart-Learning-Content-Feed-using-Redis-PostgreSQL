# Smart Learning Content Feed

## Overview

A high-performance, adaptive content feed engine built with **FastAPI**, **Redis**, and **PostgreSQL**. The system implements a real-time ranking algorithm using Redis Sorted Sets to personalize content based on user interaction metrics (scroll depth, time spent). It features a generic interaction tracking system, WebSocket-based real-time analytics dashboard, and a responsive **React/MUI** frontend, all containerized via Docker for scalable deployment.

## Key Features

-   **Adaptive Ranking Algorithm**: Utilizing a weighted formula (`Score = 0.5 * Completion Rate + 0.3 * Normalized Time Spent + 0.2 * Topic Interest`), the system continuously refines content ranking based on actual user behavior.
-   **Real-Time Analytics Dashboard**: Powered by WebSockets, the dashboard provides a live view of user interactions, showing active reading sessions, engagement scores, and shifting interest graphs as they happen.
-   **High-Performance Backend**: Built with **FastAPI**, the backend leverages **Redis** for high-speed caching and ranking operations (using Sorted Sets) and **PostgreSQL** for robust data persistence.
-   **Responsive Frontend**: A modern React-based interface ensures a smooth reading experience across devices, with unobtrusive engagement tracking running in the background.
-   **Containerized Architecture**: Fully Dockerized setup (Backend, Frontend, Database, Redis) ensures consistent deployment and easy scalability.

## Architecture & Technology Stack

-   **Backend**: Python, FastAPI, SQLAlchemy (Async), Pydantic.
-   **Database**: PostgreSQL (Data), Redis (Caching & Ranking).
-   **Frontend**: React, Vite, Material UI (MUI).
-   **Real-Time**: WebSocket (via FastAPI), Redis Pub/Sub.
-   **DevOps**: Docker, Docker Compose.

## Getting Started

### Prerequisites

-   Docker & Docker Compose
-   Node.js & npm (for local frontend dev)
-   Python 3.9+ (for local backend dev)

### Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/skyneon1/Smart-Learning-Content-Feed-using-Redis-PostgreSQL.git
    cd smart-learning-content-feed
    ```

2.  **Start with Docker**
    The easiest way to run the full stack is via Docker Compose:
    ```bash
    docker-compose up --build
    ```
    This will spin up:
    -   Backend API at `http://localhost:8000`
    -   Frontend App at `http://localhost:5173` (or configured port)
    -   Postgres & Redis services

3.  **Seed Data**
    To populate the database with initial sample content:
    ```bash
    curl -X POST http://localhost:8000/seed
    ```

## Usage

1.  **Navigate to the Feed**: Open the frontend application. The feed will initially be neutral or randomized.
2.  **Interact with Content**: Click on articles, scroll through them, and spend time reading. The system tracks your `scroll_depth` and `time_spent`.
3.  **Watch the Adaptation**: Return to the feed (or click refresh/next). The ranking will update to prioritize topics you engaged with deeply (e.g., if you spent 5 minutes reading about "Python", Python articles will move up).
4.  **Monitor Dashboard**: Open the `/dashboard` route to see your interactions being logged in real-time and your interest graph evolving.

## License

This project is open-source and available under the MIT License.
