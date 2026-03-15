const adaptiveService = require('../services/adaptiveService');
const StudentAnswer = require('../models/StudentAnswer');

/**
 * Answer Controller
 * Handles student answer submissions and adaptive learning
 */

/**
 * POST /api/submit-answer
 * Submit an answer and get adaptive feedback
 */
const submitAnswer = async (req, res) => {
  try {
    const { studentId, questionId, selectedAnswer, timeSpent } = req.body;

    // Validate required fields
    if (!studentId || !questionId || selectedAnswer === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: studentId, questionId, and selectedAnswer are required'
      });
    }

    // Process the answer through adaptive service
    const result = await adaptiveService.processAnswer(
      studentId,
      questionId,
      selectedAnswer,
      timeSpent || 0
    );

    res.status(200).json({
      success: true,
      data: {
        isCorrect: result.isCorrect,
        correctAnswer: result.correctAnswer,
        explanation: result.explanation,
        feedback: result.feedback,
        performance: {
          currentDifficulty: result.currentDifficulty,
          difficultyChanged: result.difficultyChanged,
          newDifficulty: result.newDifficulty,
          correctStreak: result.correctStreak,
          wrongStreak: result.wrongStreak,
          overallAccuracy: result.overallAccuracy
        }
      }
    });
  } catch (error) {
    console.error('Submit answer error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to process answer',
      error: error.message
    });
  }
};

/**
 * GET /api/student/:studentId/history
 * Get student's answer history
 */
const getStudentHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { page = 1, limit = 20, topic, difficulty } = req.query;

    // Build filter
    const filter = { studentId };

    // Get answers with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const answers = await StudentAnswer.find(filter)
      .populate({
        path: 'questionId',
        select: 'question topic difficulty type'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await StudentAnswer.countDocuments(filter);

    // Filter by topic/difficulty if specified (post-query filter due to population)
    let filteredAnswers = answers;
    if (topic) {
      filteredAnswers = answers.filter(a =>
        a.questionId && a.questionId.topic?.toLowerCase().includes(topic.toLowerCase())
      );
    }
    if (difficulty) {
      filteredAnswers = filteredAnswers.filter(a =>
        a.questionId && a.questionId.difficulty === difficulty
      );
    }

    res.status(200).json({
      success: true,
      data: {
        history: filteredAnswers.map(a => ({
          answerId: a._id,
          question: a.questionId?.question,
          topic: a.questionId?.topic,
          difficulty: a.difficultyAtTime,
          type: a.questionId?.type,
          selectedAnswer: a.selectedAnswer,
          correctAnswer: a.isCorrect,
          timeSpent: a.timeSpentSeconds,
          answeredAt: a.createdAt
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredAnswers.length,
          pages: Math.ceil(filteredAnswers.length / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get student history error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve student history',
      error: error.message
    });
  }
};

/**
 * GET /api/student/:studentId/profile
 * Get student's adaptive learning profile
 */
const getStudentProfile = async (req, res) => {
  try {
    const { studentId } = req.params;

    const profile = await adaptiveService.getOrCreateProfile(studentId);

    res.status(200).json({
      success: true,
      data: {
        studentId: profile.studentId,
        currentDifficulty: profile.currentDifficulty,
        grade: profile.grade,
        subjects: profile.subjects,
        performance: {
          totalAnswered: profile.totalAnswered,
          totalCorrect: profile.totalCorrect,
          overallAccuracy: profile.overallAccuracy,
          currentStreak: profile.correctStreak,
          bestStreak: Math.max(profile.correctStreak, 5)
        },
        topics: {
          weakAreas: profile.weakTopics,
          strongAreas: profile.strongTopics
        },
        difficultyHistory: profile.difficultyHistory,
        lastActiveAt: profile.lastActiveAt,
        createdAt: profile.createdAt
      }
    });
  } catch (error) {
    console.error('Get student profile error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve student profile',
      error: error.message
    });
  }
};

/**
 * GET /api/student/:studentId/recommendations
 * Get personalized learning recommendations
 */
const getRecommendations = async (req, res) => {
  try {
    const { studentId } = req.params;

    const recommendations = await adaptiveService.getRecommendations(studentId);

    res.status(200).json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('Get recommendations error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve recommendations',
      error: error.message
    });
  }
};

/**
 * GET /api/student/:studentId/analytics
 * Get detailed performance analytics
 */
const getAnalytics = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { days = 30 } = req.query;

    const analytics = await adaptiveService.getPerformanceAnalytics(studentId);

    res.status(200).json({
      success: true,
      data: {
        ...analytics,
        timeWindow: `${days} days`
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve analytics',
      error: error.message
    });
  }
};

/**
 * PUT /api/student/:studentId/profile
 * Update student profile settings
 */
const updateProfile = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { grade, subjects, currentDifficulty } = req.body;

    const StudentProfile = require('../models/StudentProfile');

    const profile = await StudentProfile.findOne({ studentId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    // Update allowed fields
    if (grade !== undefined) profile.grade = grade;
    if (subjects !== undefined) profile.subjects = subjects;
    if (currentDifficulty !== undefined) {
      profile.adjustDifficulty(currentDifficulty, 'Manual update by user');
    }

    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        studentId: profile.studentId,
        currentDifficulty: profile.currentDifficulty,
        grade: profile.grade,
        subjects: profile.subjects
      }
    });
  } catch (error) {
    console.error('Update profile error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

/**
 * POST /api/student/:studentId/reset
 * Reset student learning progress (with confirmation)
 */
const resetProgress = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { confirm, keepProfile = false } = req.body;

    if (!confirm || confirm !== 'RESET_CONFIRMED') {
      return res.status(400).json({
        success: false,
        message: 'Confirmation required. Send confirm: "RESET_CONFIRMED" to proceed.'
      });
    }

    // Delete all answers
    await StudentAnswer.deleteMany({ studentId });

    // Reset or delete profile
    const StudentProfile = require('../models/StudentProfile');
    if (keepProfile) {
      await StudentProfile.updateOne(
        { studentId },
        {
          $set: {
            currentDifficulty: 'easy',
            correctStreak: 0,
            wrongStreak: 0,
            totalAnswered: 0,
            totalCorrect: 0,
            overallAccuracy: 0,
            weakTopics: [],
            strongTopics: [],
            difficultyHistory: []
          }
        }
      );
    } else {
      await StudentProfile.deleteOne({ studentId });
    }

    res.status(200).json({
      success: true,
      message: keepProfile
        ? 'Progress reset successfully. Profile preserved.'
        : 'Progress and profile deleted successfully.'
    });
  } catch (error) {
    console.error('Reset progress error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to reset progress',
      error: error.message
    });
  }
};

module.exports = {
  submitAnswer,
  getStudentHistory,
  getStudentProfile,
  getRecommendations,
  getAnalytics,
  updateProfile,
  resetProgress
};
