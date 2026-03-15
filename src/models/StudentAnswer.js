// ============================================================
// StudentAnswer Model - A record of every answer a student gives
// ============================================================
// Every time a student answers a question, we save it here.
// This lets us track progress, see patterns, and adapt difficulty.

const mongoose = require('mongoose');

const studentAnswerSchema = new mongoose.Schema({
  // Who answered?
  studentId: {
    type: String,
    required: [true, 'Student ID is required'],
    index: true
  },
  
  // Which question did they answer?
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QuizQuestion',
    required: [true, 'Question ID is required'],
    index: true
  },
  
  // What did they choose?
  selectedAnswer: {
    type: String,
    required: [true, 'Selected answer is required']
  },
  
  // Did they get it right?
  isCorrect: {
    type: Boolean,
    required: [true, 'Need to know if answer was correct']
  },
  
  // How long did they take? (in seconds)
  timeSpentSeconds: {
    type: Number,
    min: [0, 'Time cannot be negative'],
    default: 0
  },
  
  // What difficulty level was this question when they answered it?
  difficultyAtTime: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    required: [true, 'Need to track difficulty at time of answering']
  },
  
  // Is this their first attempt at this question? Or second? Third?
  attemptNumber: {
    type: Number,
    default: 1
  },
  
  // Did they use a hint to help answer?
  hintUsed: {
    type: Boolean,
    default: false
  },
  
  // Which study session was this part of?
  sessionId: {
    type: String,
    index: true,
    description: 'Groups answers from the same study session together'
  },
  
  // When did they answer?
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Quick lookup indexes
studentAnswerSchema.index({ studentId: 1, createdAt: -1 });  // Recent answers first
studentAnswerSchema.index({ studentId: 1, questionId: 1 });  // Find specific answer
studentAnswerSchema.index({ sessionId: 1 });                // Get all answers from a session

module.exports = mongoose.model('StudentAnswer', studentAnswerSchema);
