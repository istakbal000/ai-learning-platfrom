// ============================================================
// Quiz Routes - Managing Questions and Quiz Generation 🎯
// ============================================================
// These routes handle quiz questions: generating them, getting them,
// and checking answers

const express = require('express');
const quizController = require('../controllers/quizController');

const router = express.Router();

// ============================================================
// ROUTES
// ============================================================

// POST /api/generate-quiz - Use AI to create questions from content
router.post('/', quizController.generateQuiz);

// GET /api/quiz - Get quiz questions (with filters like topic, difficulty)
router.get('/', quizController.getQuiz);

// GET /api/quiz/topics - See all available topics we have questions for
router.get('/topics', quizController.getTopics);

// GET /api/quiz/stats - Get statistics about our question database
router.get('/stats', quizController.getQuizStats);

// GET /api/quiz/:questionId/answer - Get the correct answer (for after submission)
router.get('/:questionId/answer', quizController.getAnswer);

// DELETE /api/quiz/:questionId - Remove a question from the database
router.delete('/:questionId', quizController.deleteQuestion);

module.exports = router;
