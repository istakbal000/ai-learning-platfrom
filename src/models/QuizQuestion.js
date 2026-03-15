// ============================================================
// QuizQuestion Model - The actual questions students answer
// ============================================================
// These are the AI-generated questions that students see.
// Each question is linked to a specific chunk of content.

const mongoose = require('mongoose');

const quizQuestionSchema = new mongoose.Schema({
  // Link back to where this question came from
  chunkId: {
    type: String,
    required: [true, 'Need to know which content chunk this came from'],
    index: true
  },
  sourceId: {
    type: String,
    required: [true, 'Need to know which document this came from'],
    index: true
  },
  
  // The question itself - what students read
  question: {
    type: String,
    required: [true, 'A question needs text!'],
    trim: true,
    minlength: [10, 'Question is too short (min 10 characters)'],
    maxlength: [500, 'Question is too long (max 500 characters)']
  },
  
  // What type of question is this?
  type: {
    type: String,
    required: [true, 'Question type is required'],
    enum: {
      values: ['MCQ', 'TRUE_FALSE', 'FILL_BLANK'],
      message: '{VALUE} is not a recognized question type. Use MCQ, TRUE_FALSE, or FILL_BLANK'
    }
  },
  
  // Answer options - varies by question type
  // MCQ: ['A', 'B', 'C', 'D'] | True/False: ['True', 'False'] | Fill-blank: []
  options: {
    type: [String],
    validate: {
      validator: function(options) {
        // Multiple choice needs 2-6 options
        if (this.type === 'MCQ') {
          return options && options.length >= 2 && options.length <= 6;
        }
        // True/False always has exactly 2 options
        if (this.type === 'TRUE_FALSE') {
          return options && options.length === 2;
        }
        // Fill-in-the-blank has no options (student writes answer)
        return true;
      },
      message: 'Invalid number of options for this question type'
    }
  },
  
  // The correct answer - what we're looking for
  answer: {
    type: String,
    required: [true, 'Every question needs a correct answer']
  },
  
  // How hard is this question?
  difficulty: {
    type: String,
    required: [true, 'Difficulty is required'],
    enum: {
      values: ['easy', 'medium', 'hard'],
      message: '{VALUE} is not a valid difficulty. Use easy, medium, or hard'
    },
    index: true
  },
  
  // What topic does this cover?
  topic: {
    type: String,
    required: [true, 'Topic is required'],
    trim: true,
    index: true
  },
  
  // What grade level is this for?
  grade: {
    type: Number,
    required: [true, 'Grade level is required'],
    min: [1, 'Grade must be at least 1'],
    max: [12, 'Grade cannot exceed 12']
  },
  
  // Helpful explanation shown after answering
  explanation: {
    type: String,
    trim: true,
    maxlength: [1000, 'Explanation is too long (max 1000 characters)'],
    description: 'Why is this the correct answer? Educational feedback for students'
  },
  
  // Analytics: How students are doing on this question
  timesAsked: {
    type: Number,
    default: 0,
    description: 'How many times has this question been asked?'
  },
  timesCorrect: {
    type: Number,
    default: 0,
    description: 'How many times has it been answered correctly?'
  },
  accuracyRate: {
    type: Number,
    default: 0,
    min: [0, 'Accuracy must be at least 0%'],
    max: [100, 'Accuracy cannot exceed 100%']
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Before saving, update the timestamp and calculate accuracy percentage
quizQuestionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  // Calculate accuracy rate: (correct answers / total attempts) * 100
  if (this.timesAsked > 0) {
    this.accuracyRate = Math.round((this.timesCorrect / this.timesAsked) * 100);
  }
  next();
});

// Indexes for common queries
quizQuestionSchema.index({ topic: 1, difficulty: 1 });  // "Give me easy math questions"
quizQuestionSchema.index({ grade: 1, difficulty: 1 }); // "Give me hard questions for 5th grade"
quizQuestionSchema.index({ chunkId: 1 });               // "Show me all questions from this chunk"

module.exports = mongoose.model('QuizQuestion', quizQuestionSchema);
