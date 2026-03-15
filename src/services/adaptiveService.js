// ============================================================
// Adaptive Learning Service - The Brain Behind Smart Quizzes 🧠
// ============================================================
// This service makes the platform "smart" by:
// - Tracking how students perform
// - Adjusting difficulty based on their progress
// - Identifying weak and strong topics
// - Providing personalized recommendations

const StudentProfile = require('../models/StudentProfile');
const StudentAnswer = require('../models/StudentAnswer');
const QuizQuestion = require('../models/QuizQuestion');

// Settings that control when difficulty changes
const ADAPTIVE_CONFIG = {
  easyToMediumThreshold: 3,    // Get 3 right at easy → move to medium
  mediumToHardThreshold: 3,  // Get 3 right at medium → move to hard
  hardToMediumThreshold: 2,    // Get 2 wrong at hard → drop to medium
  mediumToEasyThreshold: 2,    // Get 2 wrong at medium → drop to easy
  maxStreak: 5                 // Cap streak tracking
};

/**
 * Find a student's profile or create one if they're new
 * Every student needs a profile to track their learning journey
 * 
 * @param {string} studentId - The student's unique ID
 * @param {Object} initialData - Info like grade level to set up the profile
 * @returns {Promise<Object>} The student's profile (existing or new)
 */
const getOrCreateProfile = async (studentId, initialData = {}) => {
  try {
    // Try to find existing profile
    let profile = await StudentProfile.findOne({ studentId });

    // If no profile exists, create a new one
    if (!profile) {
      profile = new StudentProfile({
        studentId,
        // Choose starting difficulty based on grade, or default to easy
        currentDifficulty: initialData.grade 
          ? determineInitialDifficulty(initialData.grade) 
          : 'easy',
        grade: initialData.grade || null,
        subjects: initialData.subjects || [],
        // Fresh start - no streaks yet
        correctStreak: 0,
        wrongStreak: 0,
        totalAnswered: 0,
        totalCorrect: 0,
        overallAccuracy: 0,
        difficultyHistory: []  // Track how difficulty has changed over time
      });

      await profile.save();
    }

    return profile;
  } catch (error) {
    throw new Error(`Couldn't get or create profile: ${error.message}`);
  }
};

/**
 * Pick a starting difficulty based on the student's grade
 * Younger students start easy, older students start medium
 * 
 * @param {number} grade - School grade (1-12)
 * @returns {string} Starting difficulty level
 */
const determineInitialDifficulty = (grade) => {
  if (grade <= 2) return 'easy';      // Grades 1-2: Start easy
  if (grade <= 5) return 'easy';      // Grades 3-5: Still easy
  if (grade <= 8) return 'medium';    // Grades 6-8: Medium
  return 'medium';                    // Grades 9-12: Medium
};

/**
 * Handle a student answering a question - the heart of adaptive learning
 * This function:
 * 1. Checks if the answer is correct
 * 2. Records the answer in history
 * 3. Updates streaks and stats
 * 4. Adjusts difficulty if needed
 * 5. Returns helpful feedback for the student
 * 
 * @param {string} studentId - Who answered
 * @param {string} questionId - Which question they answered
 * @param {string} selectedAnswer - What they chose
 * @param {number} timeSpent - How long they took (in seconds)
 * @returns {Promise<Object>} Results, feedback, and any difficulty changes
 */
const processAnswer = async (studentId, questionId, selectedAnswer, timeSpent = 0) => {
  try {
    // Step 1: Get the question details
    const question = await QuizQuestion.findById(questionId);
    if (!question) {
      throw new Error('Question not found');
    }

    // Step 2: Get or create the student's profile
    const profile = await getOrCreateProfile(studentId, { grade: question.grade });

    // Step 3: Check if they got it right (case-insensitive comparison)
    const isCorrect = selectedAnswer.trim().toLowerCase() === question.answer.trim().toLowerCase();

    // Step 4: Record this answer in history
    const studentAnswer = new StudentAnswer({
      studentId,
      questionId,
      selectedAnswer,
      isCorrect,
      timeSpentSeconds: timeSpent,
      difficultyAtTime: profile.currentDifficulty,  // What difficulty was this?
      attemptNumber: await getAttemptCount(studentId, questionId) + 1
    });
    await studentAnswer.save();

    // Step 5: Update question stats (how many got this right/wrong)
    question.timesAsked += 1;
    if (isCorrect) {
      question.timesCorrect += 1;
    }
    await question.save();

    // Step 6: Update the student's profile
    profile.updateStreak(isCorrect);  // Update their streaks
    profile.lastActiveAt = new Date();  // Mark them as active now

    // Step 7: Should we change difficulty based on their performance?
    const difficultyChange = evaluateDifficultyChange(profile);
    if (difficultyChange.shouldChange) {
      profile.adjustDifficulty(difficultyChange.newDifficulty, difficultyChange.reason);
    }

    await profile.save();

    // Step 8: Track their performance on this specific topic
    await updateTopicTracking(profile, question.topic, isCorrect);

    // Return everything the student needs to know
    return {
      isCorrect,
      correctAnswer: question.answer,
      explanation: question.explanation,
      currentDifficulty: profile.currentDifficulty,
      difficultyChanged: difficultyChange.shouldChange,
      newDifficulty: difficultyChange.newDifficulty,
      correctStreak: profile.correctStreak,
      wrongStreak: profile.wrongStreak,
      overallAccuracy: profile.overallAccuracy,
      feedback: generateFeedback(isCorrect, profile.correctStreak, profile.wrongStreak)
    };
  } catch (error) {
    throw new Error(`Failed to process answer: ${error.message}`);
  }
};

/**
 * Count how many times a student has tried to answer a specific question
 * This helps us track if it's their first attempt or a retry
 * 
 * @param {string} studentId - Who answered
 * @param {string} questionId - Which question
 * @returns {Promise<number>} How many attempts so far
 */
const getAttemptCount = async (studentId, questionId) => {
  const count = await StudentAnswer.countDocuments({ studentId, questionId });
  return count;
};

/**
 * Decide if a student should move up or down in difficulty
 * Based on their current streak of correct or wrong answers
 * 
 * Rules:
 * - Get 3 right in a row at easy → move to medium
 * - Get 3 right in a row at medium → move to hard
 * - Get 2 wrong in a row at hard → drop to medium
 * - Get 2 wrong in a row at medium → drop to easy
 * 
 * @param {Object} profile - Student's current profile with streak info
 * @returns {Object} Decision about whether to change difficulty
 */
const evaluateDifficultyChange = (profile) => {
  const current = profile.currentDifficulty;
  const correctStreak = profile.correctStreak;
  const wrongStreak = profile.wrongStreak;

  // Moving UP in difficulty (they're doing well!)
  if (current === 'easy' && correctStreak >= ADAPTIVE_CONFIG.easyToMediumThreshold) {
    return {
      shouldChange: true,
      newDifficulty: 'medium',
      reason: `Great job! ${correctStreak} correct answers in a row - moving up to medium!`
    };
  }

  if (current === 'medium' && correctStreak >= ADAPTIVE_CONFIG.mediumToHardThreshold) {
    return {
      shouldChange: true,
      newDifficulty: 'hard',
      reason: `Excellent! ${correctStreak} correct answers in a row - moving up to hard!`
    };
  }

  // Moving DOWN in difficulty (they need more practice)
  if (current === 'hard' && wrongStreak >= ADAPTIVE_CONFIG.hardToMediumThreshold) {
    return {
      shouldChange: true,
      newDifficulty: 'medium',
      reason: `Let's practice more at medium level before trying hard again`
    };
  }

  if (current === 'medium' && wrongStreak >= ADAPTIVE_CONFIG.mediumToEasyThreshold) {
    return {
      shouldChange: true,
      newDifficulty: 'easy',
      reason: `Let's build confidence back up at easy level`
    };
  }

  // No change needed - keep at current level
  return {
    shouldChange: false,
    newDifficulty: current,
    reason: null
  };
};

/**
 * Create encouraging feedback based on how the student is doing
 * Different messages for correct vs wrong, and for streaks
 * 
 * @param {boolean} isCorrect - Did they get it right?
 * @param {number} correctStreak - How many right in a row
 * @param {number} wrongStreak - How many wrong in a row
 * @returns {string} Friendly feedback message
 */
const generateFeedback = (isCorrect, correctStreak, wrongStreak) => {
  if (isCorrect) {
    // They're on a roll!
    if (correctStreak >= 5) {
      return '🔥 Outstanding! You\'re on fire! Keep up the amazing work!';
    }
    if (correctStreak >= 3) {
      return '⭐ Great job! You\'re on a roll!';
    }
    return '✅ Correct! Well done!';
  } else {
    // Encourage them to keep trying
    if (wrongStreak >= 3) {
      return '💪 Don\'t worry, keep trying! You\'ll get it next time.';
    }
    return '🤔 Not quite right. Let\'s try another one!';
  }
};

/**
 * Keep track of which topics a student is good at vs struggling with
 * This helps us give personalized recommendations later
 * 
 * @param {Object} profile - Student profile to update
 * @param {string} topic - Which topic they just answered a question about
 * @param {boolean} isCorrect - Did they get it right?
 */
const updateTopicTracking = async (profile, topic, isCorrect) => {
  try {
    // Get all their previous answers
    const answers = await StudentAnswer.find({
      studentId: profile.studentId
    }).populate('questionId');

    // Filter to just answers about this specific topic
    const topicAnswers = answers.filter(a =>
      a.questionId && a.questionId.topic === topic
    );

    // Calculate their accuracy on this topic
    const totalAttempts = topicAnswers.length;
    const correctAttempts = topicAnswers.filter(a => a.isCorrect).length;
    const accuracy = totalAttempts > 0 
      ? Math.round((correctAttempts / totalAttempts) * 100) 
      : 0;

    // Remove from both lists first (we'll re-add if needed)
    profile.weakTopics = profile.weakTopics.filter(t => t.topic !== topic);
    profile.strongTopics = profile.strongTopics.filter(t => t.topic !== topic);

    // After 3+ attempts, classify as weak or strong
    if (totalAttempts >= 3) {
      if (accuracy < 50) {
        // Less than 50% correct = weak area
        profile.weakTopics.push({ topic, attempts: totalAttempts, accuracy });
      } else if (accuracy >= 80) {
        // 80%+ correct = strong area
        profile.strongTopics.push({ topic, attempts: totalAttempts, accuracy });
      }
    }

    await profile.save();
  } catch (error) {
    console.error('⚠️  Topic tracking update failed:', error.message);
  }
};

/**
 * Give personalized study recommendations based on what the student needs
 * Suggests topics to focus on and which ones they've mastered
 * 
 * @param {string} studentId - Who needs recommendations
 * @returns {Promise<Object>} Personalized advice for the student
 */
const getRecommendations = async (studentId) => {
  try {
    const profile = await getOrCreateProfile(studentId);

    // Find their weakest topics (need the most practice)
    const priorityTopics = profile.weakTopics
      .sort((a, b) => a.accuracy - b.accuracy)  // Lowest accuracy first
      .slice(0, 3)  // Top 3 weakest
      .map(t => t.topic);

    // Find topics they've already mastered
    const masteredTopics = profile.strongTopics
      .filter(t => t.accuracy >= 90)  // 90%+ is mastered
      .map(t => t.topic);

    return {
      currentDifficulty: profile.currentDifficulty,
      priorityTopics,           // Focus on these
      masteredTopics,           // Don't waste time on these
      weakAreas: profile.weakTopics,
      strongAreas: profile.strongTopics,
      suggestedFocus: priorityTopics.length > 0
        ? `📚 Focus on: ${priorityTopics.join(', ')}`
        : '✨ Keep practicing at your current level!'
    };
  } catch (error) {
    throw new Error(`Failed to generate recommendations: ${error.message}`);
  }
};

/**
 * Get detailed analytics about a student's performance
 * Shows stats, trends, and progress over time
 * 
 * @param {string} studentId - Who to analyze
 * @returns {Promise<Object>} Complete performance analytics
 */
const getPerformanceAnalytics = async (studentId) => {
  try {
    const profile = await getOrCreateProfile(studentId);

    // Look at the last 30 days of activity
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentAnswers = await StudentAnswer.find({
      studentId,
      createdAt: { $gte: thirtyDaysAgo }
    }).sort({ createdAt: -1 });

    // Track daily activity
    const dailyActivity = {};
    recentAnswers.forEach(answer => {
      const date = answer.createdAt.toISOString().split('T')[0];
      if (!dailyActivity[date]) {
        dailyActivity[date] = { answered: 0, correct: 0 };
      }
      dailyActivity[date].answered += 1;
      if (answer.isCorrect) {
        dailyActivity[date].correct += 1;
      }
    });

    // Calculate accuracy at each difficulty level
    const difficultyStats = {
      easy: { total: 0, correct: 0 },
      medium: { total: 0, correct: 0 },
      hard: { total: 0, correct: 0 }
    };

    recentAnswers.forEach(answer => {
      const diff = answer.difficultyAtTime;
      if (difficultyStats[diff]) {
        difficultyStats[diff].total += 1;
        if (answer.isCorrect) {
          difficultyStats[diff].correct += 1;
        }
      }
    });

    // Build the analytics report
    return {
      overallStats: {
        totalAnswered: profile.totalAnswered,
        totalCorrect: profile.totalCorrect,
        accuracy: profile.overallAccuracy,
        currentStreak: profile.correctStreak,
        bestStreak: Math.max(profile.correctStreak, 5)
      },
      difficultyBreakdown: {
        easy: {
          ...difficultyStats.easy,
          accuracy: difficultyStats.easy.total > 0
            ? Math.round((difficultyStats.easy.correct / difficultyStats.easy.total) * 100)
            : 0
        },
        medium: {
          ...difficultyStats.medium,
          accuracy: difficultyStats.medium.total > 0
            ? Math.round((difficultyStats.medium.correct / difficultyStats.medium.total) * 100)
            : 0
        },
        hard: {
          ...difficultyStats.hard,
          accuracy: difficultyStats.hard.total > 0
            ? Math.round((difficultyStats.hard.correct / difficultyStats.hard.total) * 100)
            : 0
        }
      },
      recentActivity: dailyActivity,  // Day-by-day breakdown
      weakTopics: profile.weakTopics,
      strongTopics: profile.strongTopics,
      learningTrajectory: profile.difficultyHistory  // How they've progressed
    };
  } catch (error) {
    throw new Error(`Failed to generate analytics: ${error.message}`);
  }
};

// Export all our functions for use in other parts of the app
module.exports = {
  getOrCreateProfile,
  processAnswer,
  getRecommendations,
  getPerformanceAnalytics,
  evaluateDifficultyChange,
  ADAPTIVE_CONFIG
};
