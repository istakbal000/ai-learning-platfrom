// ============================================================
// Answer Routes - Where Students Submit Their Answers ✏️
// ============================================================
// This simple route handles when students submit their answers to questions
// It triggers the adaptive learning system to update their progress

const express = require('express');
const answerController = require('../controllers/answerController');

const router = express.Router();

// POST /api/submit-answer - Submit an answer and get feedback
router.post('/', answerController.submitAnswer);

module.exports = router;
