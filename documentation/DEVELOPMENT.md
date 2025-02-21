# Development

## Architecture

### Frontend

- Single page application (HTML/JavaScript)
- Tailwind CSS for styling
- Marked.js for markdown rendering
- No build process

### Backend

- Express.js server
- API proxy for Perplexity and Anthropic
- Server-Sent Events (SSE) for progress updates during the research process
- Queue-based request management

### External Services

- Perplexity API for company research queries
- Anthropic API (Claude) for generating the synthesized report

## Core Features

1. Batched query processing with progress updates
2. Exponential backoff for API rate limiting
3. Server-side queue management
4. Real-time progress updates via SSE
5. Markdown-based report generation

## Key Components

### Query System

- Processes multiple Perplexity queries in sequence
- Handles rate limiting and retries

### Progress Tracking

- SSE-based real-time updates
- Shows query progress and the last completed query

### Report Generation

- Combines Perplexity responses
- Formats output in markdown

## Development Status

- Working frontend and backend
- Very basic

## Configuration

### Environment Variables

- `PORT`: set to 5001 by default
- `PERPLEXITY_API_KEY`
- `ANTHROPIC_API_KEY`

### API Endpoints

- `/api/perplexity/batch`: POST endpoint for batched Perplexity queries
- `/api/perplexity/stream`: GET endpoint for SSE progress updates
- `/api/anthropic`: POST endpoint for Claude report generation

## Setup Instructions

### Prerequisites

- Node.js (version TBD)
- `npm`
- Perplexity API key
- Anthropic API key

### Local Development Setup

1. Clone the repository
2. Create a `.env` file in the root directory (see "Environment Variables" above)
3. Install dependencies in `backend`: `npm install`
4. Start the development server: `npm run dev`
5. Start the frontend: `live-server --port=3000`

## Project Structure

Generated with `tree --gitignore`.

```plaintext
.
├── README.md
├── backend
│   ├── controllers
│   │   └── apiController.js
│   ├── middleware
│   │   └── validation.js
│   ├── package-lock.json
│   ├── package.json
│   ├── routes
│   │   └── api.js
│   └── server.js
├── documentation
│   ├── CHANGELOG.md
│   ├── DEVELOPMENT.md
│   └── ROADMAP.md
└── frontend
    └── index.html
```
