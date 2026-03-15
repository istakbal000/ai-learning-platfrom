const QuizQuestion = require('../models/QuizQuestion');
const chunkService = require('../services/chunkService');
const llmService = require('../services/llmService');
const adaptiveService = require('../services/adaptiveService');

/**
 * Quiz Controller
 * Handles quiz generation, retrieval, and management
 */

/**
 * POST /api/generate-quiz
 * Generate quiz questions for content chunks
 */
const generateQuiz = async (req, res) => {
  try {
    const { sourceId, chunkId, topic, count = 4 } = req.body;

    let chunks = [];
    let source = null;

    // Get chunks based on provided criteria
    if (chunkId) {
      // Generate for specific chunk
      const chunk = await chunkService.getChunkById(chunkId);
      if (!chunk) {
        return res.status(404).json({
          success: false,
          message: 'Chunk not found'
        });
      }
      chunks = [chunk];
      const Source = require('../models/Source');
      source = await Source.findOne({ sourceId: chunk.sourceId });
    } else if (sourceId) {
      // Generate for all chunks in source
      chunks = await chunkService.getChunksBySource(sourceId);
      if (chunks.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No chunks found for this source'
        });
      }
      const Source = require('../models/Source');
      source = await Source.findOne({ sourceId });
    } else if (topic) {
      // Generate for topic
      chunks = await chunkService.getChunksByTopic(topic, count);
      if (chunks.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No chunks found for this topic'
        });
      }
      const Source = require('../models/Source');
      source = await Source.findOne({ sourceId: chunks[0].sourceId });
    } else {
      // Generate for chunks without quizzes
      chunks = await chunkService.getChunksWithoutQuizzes(count);
      if (chunks.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No unprocessed chunks found'
        });
      }
      const Source = require('../models/Source');
      source = await Source.findOne({ sourceId: chunks[0].sourceId });
    }

    // Generate quizzes
    const results = await llmService.generateQuizzesForChunks(chunks, source);

    // Mark chunks as having quizzes
    const successfulChunkIds = results.success.map(r => r.chunkId);
    if (successfulChunkIds.length > 0) {
      await chunkService.markChunksAsQuizzed(successfulChunkIds);
    }

    res.status(201).json({
      success: true,
      message: 'Quiz generation completed',
      data: {
        successful: results.success.length,
        failed: results.failed.length,
        details: results
      }
    });
  } catch (error) {
    console.error('Quiz generation error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to generate quiz',
      error: error.message
    });
  }
};

/**
 * GET /api/quiz
 * Retrieve quiz questions with filtering
 */
const getQuiz = async (req, res) => {
  try {
    const {
      topic,
      difficulty,
      type,
      grade,
      count = 5,
      studentId,
      excludeAnswered = true
    } = req.query;

    // Build filter
    const filter = {};

    if (topic) {
      filter.topic = { $regex: topic, $options: 'i' };
    }

    if (difficulty) {
      filter.difficulty = difficulty;
    } else if (studentId) {
      // Use student's current difficulty if not specified
      const profile = await adaptiveService.getOrCreateProfile(studentId);
      filter.difficulty = profile.currentDifficulty;
    }

    if (type) {
      filter.type = type.toUpperCase();
    }

    if (grade) {
      filter.grade = parseInt(grade);
    }

    // Exclude previously answered questions if requested
    if (excludeAnswered && studentId) {
      const StudentAnswer = require('../models/StudentAnswer');
      const answeredQuestionIds = await StudentAnswer.find({ studentId })
        .distinct('questionId');
      filter._id = { $nin: answeredQuestionIds };
    }

    // Get questions
    let questions = await QuizQuestion.find(filter)
      .limit(parseInt(count))
      .lean();

    // If not enough questions found, try with easier difficulty
    if (questions.length < parseInt(count) && difficulty) {
      const difficulties = ['easy', 'medium', 'hard'];
      const currentIndex = difficulties.indexOf(difficulty);

      for (let i = currentIndex - 1; i >= 0 && questions.length < parseInt(count); i--) {
        const fallbackFilter = { ...filter, difficulty: difficulties[i] };
        const fallbackQuestions = await QuizQuestion.find(fallbackFilter)
          .limit(parseInt(count) - questions.length)
          .lean();
        questions = questions.concat(fallbackQuestions);
      }
    }

    // Format response (remove answer and explanation from response)
    const formattedQuestions = questions.map(q => ({
      questionId: q._id,
      question: q.question,
      type: q.type,
      options: q.options,
      difficulty: q.difficulty,
      topic: q.topic,
      grade: q.grade
    }));

    res.status(200).json({
      success: true,
      data: {
        questions: formattedQuestions,
        total: formattedQuestions.length,
        difficultyUsed: difficulty || (studentId ? 'student_adaptive' : 'mixed')
      }
    });
  } catch (error) {
    console.error('Get quiz error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve quiz',
      error: error.message
    });
  }
};

/**
 * GET /api/quiz/:questionId/answer
 * Get answer and explanation (for after submission or hints)
 */
const getAnswer = async (req, res) => {
  try {
    const { questionId } = req.params;

    const question = await QuizQuestion.findById(questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        questionId: question._id,
        answer: question.answer,
        explanation: question.explanation,
        difficulty: question.difficulty,
        topic: question.topic
      }
    });
  } catch (error) {
    console.error('Get answer error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve answer',
      error: error.message
    });
  }
};

/**
 * GET /api/quiz/topics
 * Get all available topics
 */
const getTopics = async (req, res) => {
  try {
    const topics = await QuizQuestion.distinct('topic');

    // Get question count per topic
    const topicStats = await QuizQuestion.aggregate([
      {
        $group: {
          _id: '$topic',
          count: { $sum: 1 },
          difficulties: { $addToSet: '$difficulty' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        topics: topicStats.map(t => ({
          name: t._id,
          questionCount: t.count,
          availableDifficulties: t.difficulties
        }))
      }
    });
  } catch (error) {
    console.error('Get topics error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve topics',
      error: error.message
    });
  }
};

/**
 * GET /api/quiz/stats
 * Get quiz statistics
 */
const getQuizStats = async (req, res) => {
  try {
    const { topic, difficulty } = req.query;

    const filter = {};
    if (topic) filter.topic = { $regex: topic, $options: 'i' };
    if (difficulty) filter.difficulty = difficulty;

    const stats = await QuizQuestion.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          byType: {
            $push: {
              k: '$type',
              v: '$$ROOT'
            }
          },
          byDifficulty: {
            $push: {
              k: '$difficulty',
              v: '$$ROOT'
            }
          },
          avgAccuracy: { $avg: '$accuracyRate' }
        }
      }
    ]);

    const difficultyCounts = await QuizQuestion.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$difficulty',
          count: { $sum: 1 }
        }
      }
    ]);

    const typeCounts = await QuizQuestion.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalQuestions: stats[0]?.total || 0,
        averageAccuracy: Math.round(stats[0]?.avgAccuracy || 0),
        byDifficulty: difficultyCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byType: typeCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Get quiz stats error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve quiz statistics',
      error: error.message
    });
  }
};

/**
 * DELETE /api/quiz/:questionId
 * Delete a quiz question
 */
const deleteQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;

    const question = await QuizQuestion.findByIdAndDelete(questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    console.error('Delete question error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete question',
      error: error.message
    });
  }
};

module.exports = {
  generateQuiz,
  getQuiz,
  getAnswer,
  getTopics,
  getQuizStats,
  deleteQuestion
};
