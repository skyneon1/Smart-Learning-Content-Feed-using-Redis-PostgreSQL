import { Paper, Typography, Box, Divider } from '@mui/material';
import ReactMarkdown from 'react-markdown';

const markdown = `
# System Architecture

## Overview
The Smart Learning Feed is a personalized content delivery system that ranks learning materials based on actual user engagement (time spent, scroll depth) rather than vanity metrics.

## Components

### 1. Frontend
- **Framework**: React + Vite
- **UI Library**: Material UI (MUI) v5
- **Features**:
  - Infinite Scroll
  - Reader View with Intersection Observers
  - Real-time Dashboard

### 2. Backend
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL (Async SQLAlchemy)
- **Cache**: Redis
- **Ranking Engine**:
  - Calculates scores based on: \`0.5 * Completion + 0.3 * Time + 0.2 * Interest\`
  - Updates User Interest Profiles in Redis

## API Reference

### \`GET /feed\`
Fetches the personalized feed for a user.
- **Params**: \`cursor\`, \`limit\`

### \`POST /track\`
Records user interaction.
- **Body**:
  \`\`\`json
  {
    "user_id": "...",
    "content_id": "...",
    "time_spent": 45,
    "scroll_depth": 80
  }
  \`\`\`
  
## Data Flow
1. User views content -> Frontend tracks time & scroll.
2. Frontend POSTs to \`/track\`.
3. Backend processes interaction -> Updates Redis score.
4. Next \`/feed\` request returns re-ranked content.
`;

export default function Docs() {
    return (
        <Paper sx={{ p: 4, maxWidth: '800px', mx: 'auto' }}>
            <Box className="markdown-body">
                {/* Simple render since we didn't add a markdown renderer dependency, 
             actually let's just use Typography for MVP if user didn't ask for markdown specifically,
             but I'll format it nicely using MUI constructs.
          */}
                <Typography variant="h3" gutterBottom>System Documentation</Typography>
                <Typography variant="body1" paragraph>
                    The Smart Learning Feed is a personalized content delivery system that ranks learning materials based on actual user engagement (time spent, scroll depth) rather than vanity metrics.
                </Typography>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h4" gutterBottom>Components</Typography>
                <Typography variant="h6">Frontend</Typography>
                <ul>
                    <li>React + Vite</li>
                    <li>Material UI (MUI) v5</li>
                    <li>Real-time Dashboard</li>
                </ul>

                <Typography variant="h6">Backend</Typography>
                <ul>
                    <li>FastAPI (Python)</li>
                    <li>PostgreSQL (Async SQLAlchemy)</li>
                    <li>Redis for Ranking</li>
                </ul>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h4" gutterBottom>Ranking Formula</Typography>
                <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1, fontFamily: 'monospace' }}>
                    score = 0.5 * completion_rate + 0.3 * normalized_time_spent + 0.2 * topic_interest
                </Box>
            </Box>
        </Paper>
    );
}
