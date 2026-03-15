// ============================================================
// Student Routes - Everything About the Student 👨‍🎓👩‍🎓
// ============================================================
// These routes let students (or teachers) view and manage student data:
// - View their profile and progress
// - See their answer history
// - Get personalized recommendations
// - View analytics about their learning

const express = require('express');
const answerController = require('../controllers/answerController');

const router = express.Router();

// ============================================================
// ROUTES
// ============================================================

// GET /api/student/:studentId/profile - View student profile
router.get('/:studentId/profile', answerController.getStudentProfile);

// PUT /api/student/:studentId/profile - Update student settings
router.put('/:studentId/profile', answerController.updateProfile);

// GET /api/student/:studentId/history - See all past answers
router.get('/:studentId/history', answerController.getStudentHistory);

// GET /api/student/:studentId/recommendations - Get study suggestions
router.get('/:studentId/recommendations', answerController.getRecommendations);

// GET /api/student/:studentId/analytics - View detailed stats
router.get('/:studentId/analytics', answerController.getAnalytics);

// POST /api/student/:studentId/reset - Clear all progress (with confirmation)
router.post('/:studentId/reset', answerController.resetProgress);

module.exports = router;
