// ============================================================
// Source Model - The "Parent Document"
// ============================================================
// This represents an uploaded PDF - like a textbook chapter or worksheet.
// Think of it as the "source of truth" for all the quiz content.

const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema({
  // Basic Info - What is this document?
  title: {
    type: String,
    required: [true, 'Please give this document a title'],
    trim: true,
    maxlength: [200, 'Title is too long (max 200 characters)']
  },
  
  // Categorization - Where does this fit?
  subject: {
    type: String,
    required: [true, 'Please specify a subject'],
    trim: true,
    enum: {
      values: ['Math', 'Science', 'English', 'History', 'Geography', 'Computer Science', 'Art', 'Music', 'Physical Education', 'Other'],
      message: '{VALUE} is not a recognized subject'
    }
  },
  
  grade: {
    type: Number,
    required: [true, 'Please specify the grade level'],
    min: [1, 'Grade must be at least 1'],
    max: [12, 'Grade cannot exceed 12']
  },
  
  // File Management
  filePath: {
    type: String,
    required: [true, 'File path is required']
  },
  
  sourceId: {
    type: String,
    unique: true,
    required: true,
    description: 'A friendly ID like "SRC17JH2K8LM" instead of MongoDB\'s long _id'
  },
  
  // Processing Status
  totalChunks: {
    type: Number,
    default: 0,
    description: 'How many text chunks we created from this PDF'
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

// Automatically update the "updatedAt" field whenever we save
sourceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Quick lookup indexes
sourceSchema.index({ subject: 1, grade: 1 }); // Find by subject & grade
sourceSchema.index({ sourceId: 1 });           // Find by our custom ID

module.exports = mongoose.model('Source', sourceSchema);
