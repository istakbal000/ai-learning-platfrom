# AI Learning Platform

A production-quality backend system for an AI-powered learning platform that ingests educational PDFs and converts them into adaptive quizzes. Built with the MERN stack architecture.

## Overview

This platform simulates an AI learning system similar to Peblo, designed to:
- Ingest educational PDF documents
- Extract and process text content
- Generate adaptive quiz questions using OpenAI
- Track student performance
- Dynamically adjust difficulty based on learning progress

## System Architecture

### Data Pipeline

```
PDF Upload API
    ↓
Text Extraction (pdf-parse)
    ↓
Text Cleaning & Normalization
    ↓
Intelligent Chunking Engine
    ↓
MongoDB Storage (Content Chunks)
    ↓
LLM Quiz Generation (OpenAI)
    ↓
Quiz Question Storage
    ↓
Quiz Delivery API
    ↓
Student Answer API
    ↓
Adaptive Difficulty Engine
```

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB, Mongoose ORM
- **AI**: OpenAI GPT API
- **PDF Processing**: pdf-parse
- **Security**: Helmet, CORS, express-rate-limit
- **File Upload**: Multer

## Project Structure

```
ai-learning-platform/
├── src/
│   ├── config/
│   │   └── db.js              # Database configuration
│   ├── controllers/
│   │   ├── ingestController.js    # PDF upload & processing
│   │   ├── quizController.js      # Quiz management
│   │   └── answerController.js    # Answer submission & student management
│   ├── models/
│   │   ├── Source.js          # Educational source documents
│   │   ├── ContentChunk.js    # Processed text chunks
│   │   ├── QuizQuestion.js    # Generated quiz questions
│   │   ├── StudentAnswer.js   # Student responses
│   │   └── StudentProfile.js  # Adaptive learning profiles
│   ├── routes/
│   │   ├── ingestRoutes.js    # PDF upload endpoints
│   │   ├── quizRoutes.js      # Quiz endpoints
│   │   ├── answerRoutes.js    # Answer submission endpoints
│   │   └── studentRoutes.js   # Student profile endpoints
│   ├── services/
│   │   ├── pdfService.js      # PDF text extraction
│   │   ├── chunkService.js    # Content chunking & storage
│   │   ├── llmService.js      # OpenAI quiz generation
│   │   └── adaptiveService.js # Adaptive learning logic
│   ├── utils/
│   │   ├── textCleaner.js     # Text cleaning utilities
│   │   └── chunkText.js       # Text chunking algorithms
│   └── server.js              # Application entry point
├── uploads/                   # PDF upload directory
├── package.json
├── .env.example
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js >= 18.0.0
- MongoDB (local or Atlas)
- OpenAI API key

### Installation

1. **Clone and navigate to the project:**
```bash
cd ai-learning-platform
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment variables:**
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
OPENAI_API_KEY=your_openai_api_key_here
MONGO_URI=mongodb://localhost:27017/ai-learning-platform
PORT=5000
NODE_ENV=development
```

4. **Start the server:**

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Endpoints

### Content Ingestion

#### Upload PDF
```http
POST /api/ingest
Content-Type: multipart/form-data

Form Data:
- pdf: <PDF_FILE>
- title: "Introduction to Geometry"
- subject: "Math"
- grade: "5"
- topic: "Shapes"
```

**Response:**
```json
{
  "success": true,
  "message": "PDF processed successfully",
  "data": {
    "sourceId": "SRC17JH2K8LM",
    "title": "Introduction to Geometry",
    "subject": "Math",
    "grade": 5,
    "totalChunks": 8,
    "pageCount": 12,
    "quizGenerationStatus": "in_progress"
  }
}
```

#### List Sources
```http
GET /api/ingest?page=1&limit=10&subject=Math&grade=5
```

#### Check Processing Status
```http
GET /api/ingest/status/:sourceId
```

#### Delete Source
```http
DELETE /api/ingest/:sourceId
```

### Quiz Generation

#### Generate Quiz Questions
```http
POST /api/generate-quiz
Content-Type: application/json

{
  "sourceId": "SRC17JH2K8LM",
  "chunkId": "SRC17JH2K8LM_CH001",
  "count": 4
}
```

### Quiz Retrieval

#### Get Quiz Questions
```http
GET /api/quiz?topic=shapes&difficulty=easy&count=5&studentId=S001
```

**Response:**
```json
{
  "success": true,
  "data": {
    "questions": [
      {
        "questionId": "6571a2b3c4d5e6f7a8b9c0d1",
        "question": "How many sides does a triangle have?",
        "type": "MCQ",
        "options": ["2", "3", "4", "5"],
        "difficulty": "easy",
        "topic": "Shapes",
        "grade": 5
      }
    ],
    "total": 1,
    "difficultyUsed": "easy"
  }
}
```

#### Get Answer & Explanation
```http
GET /api/quiz/:questionId/answer
```

#### Get Available Topics
```http
GET /api/quiz/topics
```

#### Get Quiz Statistics
```http
GET /api/quiz/stats?topic=shapes&difficulty=easy
```

### Answer Submission

#### Submit Answer
```http
POST /api/submit-answer
Content-Type: application/json

{
  "studentId": "S001",
  "questionId": "6571a2b3c4d5e6f7a8b9c0d1",
  "selectedAnswer": "3",
  "timeSpent": 15
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isCorrect": true,
    "correctAnswer": "3",
    "explanation": "A triangle is a polygon with three edges and three vertices.",
    "feedback": "Correct! Well done!",
    "performance": {
      "currentDifficulty": "easy",
      "difficultyChanged": false,
      "correctStreak": 1,
      "wrongStreak": 0,
      "overallAccuracy": 85
    }
  }
}
```

### Student Management

#### Get Student Profile
```http
GET /api/student/:studentId/profile
```

#### Update Profile
```http
PUT /api/student/:studentId/profile
Content-Type: application/json

{
  "grade": 6,
  "subjects": ["Math", "Science"],
  "currentDifficulty": "medium"
}
```

#### Get Answer History
```http
GET /api/student/:studentId/history?page=1&limit=20&topic=shapes
```

#### Get Recommendations
```http
GET /api/student/:studentId/recommendations
```

**Response:**
```json
{
  "success": true,
  "data": {
    "currentDifficulty": "medium",
    "priorityTopics": ["Fractions", "Decimals"],
    "masteredTopics": ["Basic Addition", "Basic Subtraction"],
    "weakAreas": [...],
    "strongAreas": [...],
    "suggestedFocus": "Focus on: Fractions, Decimals"
  }
}
```

#### Get Performance Analytics
```http
GET /api/student/:studentId/analytics?days=30
```

#### Reset Progress
```http
POST /api/student/:studentId/reset
Content-Type: application/json

{
  "confirm": "RESET_CONFIRMED",
  "keepProfile": true
}
```

## Adaptive Difficulty System

The platform implements an intelligent adaptive learning system that adjusts question difficulty based on student performance.

### Difficulty Levels
- **Easy**: Basic comprehension questions
- **Medium**: Application and analysis questions
- **Hard**: Synthesis and evaluation questions

### Adjustment Rules

| Current Level | Correct Streak | New Level |
|---------------|----------------|-----------|
| Easy | 3 correct | Medium |
| Medium | 3 correct | Hard |
| Hard | 2 wrong | Medium |
| Medium | 2 wrong | Easy |

### Features
- **Streak Tracking**: Monitors consecutive correct/incorrect answers
- **Topic Analysis**: Identifies strong and weak subject areas
- **Personalized Recommendations**: Suggests focus areas based on performance
- **Difficulty History**: Tracks learning progression over time

## Database Schema

### Source
| Field | Type | Description |
|-------|------|-------------|
| sourceId | String | Unique identifier |
| title | String | Document title |
| subject | String | Subject category |
| grade | Number | Grade level (1-12) |
| filePath | String | Stored PDF path |
| totalChunks | Number | Number of chunks |

### ContentChunk
| Field | Type | Description |
|-------|------|-------------|
| chunkId | String | Unique chunk identifier |
| sourceId | String | Parent source reference |
| chunkIndex | Number | Position in document |
| topic | String | Content topic |
| text | String | Chunk text content |
| hasQuiz | Boolean | Quiz generated flag |

### QuizQuestion
| Field | Type | Description |
|-------|------|-------------|
| chunkId | String | Source chunk reference |
| question | String | Question text |
| type | String | MCQ/TRUE_FALSE/FILL_BLANK |
| options | Array | Answer options |
| answer | String | Correct answer |
| difficulty | String | easy/medium/hard |
| topic | String | Question topic |
| explanation | String | Answer explanation |
| accuracyRate | Number | Historical accuracy % |

### StudentProfile
| Field | Type | Description |
|-------|------|-------------|
| studentId | String | Unique student identifier |
| currentDifficulty | String | Adaptive difficulty level |
| correctStreak | Number | Consecutive correct answers |
| wrongStreak | Number | Consecutive wrong answers |
| totalAnswered | Number | Total questions attempted |
| totalCorrect | Number | Total correct answers |
| overallAccuracy | Number | Accuracy percentage |
| weakTopics | Array | Areas needing improvement |
| strongTopics | Array | Mastered topics |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| OPENAI_API_KEY | Yes | OpenAI API key for quiz generation |
| MONGO_URI | Yes | MongoDB connection string |
| PORT | No | Server port (default: 5000) |
| NODE_ENV | No | Environment (development/production) |
| CORS_ORIGIN | No | Allowed CORS origins |

## Security Features

- **Helmet.js**: Security headers
- **CORS**: Cross-origin request configuration
- **Rate Limiting**: API abuse prevention
- **Input Validation**: Request sanitization
- **File Size Limits**: 50MB PDF upload limit
- **File Type Validation**: PDF-only uploads

## Error Handling

The API uses consistent error response format:

```json
{
  "success": false,
  "message": "Human-readable error description",
  "error": "Technical error details (dev mode only)"
}
```

## License

MIT
