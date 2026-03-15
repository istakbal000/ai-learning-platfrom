# 🤖 AI Learning Platform

An intelligent, adaptive quiz generation system powered by Google Gemini AI. Upload educational PDFs and automatically generate personalized quizzes that adapt to each student's learning progress.

## ✨ Features

- **📄 PDF Upload & Processing** - Upload educational PDFs, extract text, and break into manageable chunks
- **🎯 AI-Powered Quiz Generation** - Uses Google Gemini to create MCQ, True/False, and Fill-in-the-blank questions
- **🧠 Adaptive Learning** - Difficulty automatically adjusts based on student performance
- **📊 Student Analytics** - Track progress, streaks, and identify weak/strong topics
- **🔒 Secure & Scalable** - Rate limiting, CORS protection, and MongoDB for data storage

## 🚀 Quick Start

### Prerequisites

- Node.js (v18+)
- MongoDB Atlas account or local MongoDB instance
- Google Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/istakbal000/ai-learning-platfrom.git
   cd ai-learning-platfrom
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your credentials:
   ```
   PORT=3000
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/ai-learning
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Start the server**
   ```bash
   npm start
   ```

The API will be running at `http://localhost:3000`

## 📚 API Documentation

### Core Endpoints

#### PDF Upload & Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ingest` | Upload a PDF file |
| GET | `/api/ingest` | List all uploaded PDFs |
| GET | `/api/ingest/status/:sourceId` | Check processing status |
| DELETE | `/api/ingest/:sourceId` | Delete a PDF and its content |

#### Quiz Generation & Retrieval
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/generate-quiz` | Generate quiz questions from chunks |
| GET | `/api/quiz` | Get quiz questions (with filters) |
| GET | `/api/quiz/topics` | Get available topics |
| GET | `/api/quiz/stats` | Get quiz statistics |
| GET | `/api/quiz/:questionId/answer` | Get answer & explanation |
| DELETE | `/api/quiz/:questionId` | Delete a question |

#### Answer Submission
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/submit-answer` | Submit an answer and get feedback |

#### Student Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/student/:studentId/profile` | Get student profile |
| PUT | `/api/student/:studentId/profile` | Update student settings |
| GET | `/api/student/:studentId/history` | Get answer history |
| GET | `/api/student/:studentId/recommendations` | Get personalized recommendations |
| GET | `/api/student/:studentId/analytics` | Get performance analytics |
| POST | `/api/student/:studentId/reset` | Reset student progress |

## 🎯 Example Usage

### Upload a PDF
```bash
curl -X POST http://localhost:3000/api/ingest \
  -F "pdf=@/path/to/your/file.pdf" \
  -F "title=Introduction to Biology" \
  -F "subject=Biology" \
  -F "grade=10"
```

### Get a Quiz
```bash
curl "http://localhost:3000/api/quiz?studentId=student123&subject=Biology&difficulty=medium"
```

### Submit an Answer
```bash
curl -X POST http://localhost:3000/api/submit-answer \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "student123",
    "questionId": "question456",
    "selectedAnswer": "B",
    "timeSpent": 45
  }'
```

### Get Student Recommendations
```bash
curl "http://localhost:3000/api/student/student123/recommendations"
```

## 🏗️ Project Structure

```
ai-learning-platform/
├── src/
│   ├── config/
│   │   └── db.js              # MongoDB connection
│   ├── controllers/
│   │   ├── ingestController.js # PDF upload logic
│   │   ├── quizController.js # Quiz generation
│   │   └── answerController.js # Answer handling
│   ├── models/
│   │   ├── Source.js          # PDF documents
│   │   ├── ContentChunk.js    # Text chunks
│   │   ├── QuizQuestion.js    # Generated questions
│   │   ├── StudentAnswer.js   # Student responses
│   │   └── StudentProfile.js  # Student progress
│   ├── routes/
│   │   ├── ingestRoutes.js    # Upload routes
│   │   ├── quizRoutes.js      # Quiz routes
│   │   ├── answerRoutes.js    # Answer routes
│   │   └── studentRoutes.js   # Student routes
│   ├── services/
│   │   ├── pdfService.js      # PDF text extraction
│   │   ├── chunkService.js    # Text chunking
│   │   ├── llmService.js      # Gemini AI integration
│   │   └── adaptiveService.js # Adaptive learning logic
│   ├── utils/
│   │   ├── textCleaner.js     # Text cleaning utilities
│   │   └── chunkText.js       # Smart text chunking
│   └── server.js              # Express app setup
├── uploads/                   # PDF storage
├── .env.example              # Environment template
├── .gitignore                # Git ignore rules
├── package.json              # Dependencies
└── README.md                 # This file
```

## 🧠 How Adaptive Learning Works

1. **Difficulty Levels**: Easy → Medium → Hard
2. **Progress Tracking**: 
   - 3 correct answers in a row → Level up! ⬆️
   - 2 wrong answers in a row → Level down ⬇️
3. **Topic Analysis**: Identifies strong (80%+ accuracy) and weak (<50% accuracy) topics
4. **Personalized Recommendations**: Suggests focus areas based on weak topics

## 🛠️ Technologies Used

- **Backend**: Node.js, Express.js
- **Database**: MongoDB, Mongoose
- **AI**: Google Gemini API
- **PDF Processing**: pdf-parse
- **Security**: Helmet, CORS, express-rate-limit
- **File Upload**: Multer

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3000) | No |
| `MONGO_URI` | MongoDB connection string | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | Yes |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

---

Built with ❤️ for adaptive learning
