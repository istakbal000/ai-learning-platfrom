// ============================================================
// StudentProfile Model - Everything about a student's learning journey
// ============================================================
// This is like a report card + learning diary combined.
// It tracks what they're good at, what needs work, and how we should adapt.

const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema({
  // Student identification
  studentId: {
    type: String,
    unique: true,
    required: [true, 'Student ID is required'],
    index: true
  },
  
  // Adaptive Learning: What difficulty are they currently at?
  currentDifficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'easy',
    description: 'Questions start easy and get harder as student improves'
  },
  
  // Basic info
  grade: {
    type: Number,
    min: [1, 'Grade must be at least 1'],
    max: [12, 'Grade cannot exceed 12']
  },
  
  subjects: [{
    type: String,
    enum: ['Math', 'Science', 'English', 'History', 'Geography', 'Computer Science', 'Art', 'Music', 'Physical Education', 'Other']
  }],
  
  // Performance Tracking
  correctStreak: {
    type: Number,
    default: 0,
    min: [0, 'Streak cannot be negative'],
    description: 'How many questions in a row they got right'
  },
  wrongStreak: {
    type: Number,
    default: 0,
    min: [0, 'Streak cannot be negative'],
    description: 'How many questions in a row they got wrong'
  },
  totalAnswered: {
    type: Number,
    default: 0
  },
  totalCorrect: {
    type: Number,
    default: 0
  },
  overallAccuracy: {
    type: Number,
    default: 0,
    min: [0, 'Accuracy must be at least 0%'],
    max: [100, 'Accuracy cannot exceed 100%']
  },
  
  // Learning Journey: How has difficulty changed over time?
  difficultyHistory: [{
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard']
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    reason: String
  }],
  
  // Activity Tracking
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  
  // Topic Analysis: What are they good at? What needs work?
  preferredSubjects: [{
    subject: String,
    score: {
      type: Number,
      min: 0,
      max: 100
    }
  }],
  weakTopics: [{
    topic: String,
    attempts: Number,
    accuracy: Number
  }],
  strongTopics: [{
    topic: String,
    attempts: Number,
    accuracy: Number
  }],
  
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

// Before saving, update timestamp and calculate accuracy
studentProfileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  // Calculate overall accuracy percentage
  if (this.totalAnswered > 0) {
    this.overallAccuracy = Math.round((this.totalCorrect / this.totalAnswered) * 100);
  }
  next();
});

// Helper method: Update streak when student answers a question
studentProfileSchema.methods.updateStreak = function(isCorrect) {
  if (isCorrect) {
    this.correctStreak += 1;  // Add to correct streak
    this.wrongStreak = 0;     // Reset wrong streak
  } else {
    this.wrongStreak += 1;    // Add to wrong streak
    this.correctStreak = 0;   // Reset correct streak
  }
  this.totalAnswered += 1;
  if (isCorrect) {
    this.totalCorrect += 1;
  }
};

// Helper method: Change difficulty level with tracking
studentProfileSchema.methods.adjustDifficulty = function(newDifficulty, reason) {
  if (this.currentDifficulty !== newDifficulty) {
    // Record the change in history
    this.difficultyHistory.push({
      difficulty: newDifficulty,
      changedAt: new Date(),
      reason: reason
    });
    this.currentDifficulty = newDifficulty;
  }
};

// Indexes for quick lookups
studentProfileSchema.index({ studentId: 1 });          // Find student by ID
studentProfileSchema.index({ currentDifficulty: 1 }); // Find all students at a difficulty level

module.exports = mongoose.model('StudentProfile', studentProfileSchema);
