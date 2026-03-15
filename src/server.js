// Welcome to the AI Learning Platform! 🎓
// This is the main entry point - think of it as the "front desk" of our educational API.

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// Import our helpers
const { connectDB, disconnectDB } = require('./config/db');
const ingestRoutes = require('./routes/ingestRoutes');
const quizRoutes = require('./routes/quizRoutes');
const answerRoutes = require('./routes/answerRoutes');
const studentRoutes = require('./routes/studentRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Make sure we have a folder to store uploaded PDFs
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads folder');
}

// Security setup - helmet adds protective headers
app.use(helmet());

// Allow frontend apps to connect to our API
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting - prevent abuse (100 requests per 15 minutes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Whoa! Too many requests. Please slow down a bit.'
  }
});
app.use('/api/', limiter);

// Stricter limits for quiz generation (it's more expensive)
const quizLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Quiz generation limit reached. Take a break and try again later!'
  }
});
app.use('/api/generate-quiz', quizLimiter);

// Parse JSON and form data
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    message: 'All systems go! 🚀',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime() / 60)} minutes`
  });
});

// API Routes
app.use('/api/ingest', ingestRoutes);
app.use('/api/generate-quiz', quizRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/submit-answer', answerRoutes);
app.use('/api/student', studentRoutes);

// Friendly welcome page at the root
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'AI Learning Platform API',
    version: '1.0.0',
    description: 'Transform educational PDFs into adaptive quizzes using AI',
    status: 'online',
    endpoints: {
      ingest: {
        url: '/api/ingest',
        method: 'POST',
        description: 'Upload and process PDF files'
      },
      generateQuiz: {
        url: '/api/generate-quiz',
        method: 'POST',
        description: 'Generate quiz questions from content'
      },
      getQuiz: {
        url: '/api/quiz',
        method: 'GET',
        description: 'Retrieve quiz questions'
      },
      submitAnswer: {
        url: '/api/submit-answer',
        method: 'POST',
        description: 'Submit student answers'
      },
      studentProfile: {
        url: '/api/student/:id',
        method: 'GET',
        description: 'View student progress and analytics'
      }
    }
  });
});

// 404 handler - when someone visits a URL we don't have
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Oops! We couldn't find ${req.originalUrl}. Did you type it correctly?`,
    hint: 'Visit / to see available endpoints'
  });
});

// Error handler - catch any problems and respond nicely
app.use((err, req, res, next) => {
  console.error('💥 Error:', err.message);

  // Special handling for file upload issues
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'That file is too big! Please upload a PDF smaller than 50MB.'
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected field name. When uploading, use "pdf" as the field name.'
    });
  }

  // Generic error response
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Something went wrong on our end. Please try again.',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      tip: 'This detailed error only shows in development mode'
    })
  });
});

// Start the server and connect to our database
const startServer = async () => {
  try {
    // First, make sure we can talk to MongoDB
    await connectDB();

    // Then start listening for requests
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════╗
║           🎓 AI Learning Platform Server 🎓              ║
╠══════════════════════════════════════════════════════════╣
║  Port:        ${PORT}                                     ║
║  Environment: ${process.env.NODE_ENV || 'development'}                    ║
║  Database:    MongoDB                                    ║
╠══════════════════════════════════════════════════════════╣
║  Available Endpoints:                                    ║
║  • POST /api/ingest          → Upload PDF                ║
║  • GET  /api/quiz            → Get quiz questions        ║
║  • POST /api/submit-answer   → Submit answers            ║
║  • GET  /api/student/:id     → View student profiles     ║
╚══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Clean up gracefully when the server shuts down
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Cleaning up...`);
  await disconnectDB();
  console.log('👋 Goodbye!');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Catch any unexpected errors so the server doesn't crash mysteriously
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Promise Rejection:', reason);
  process.exit(1);
});

// Let's get this party started!
startServer();
