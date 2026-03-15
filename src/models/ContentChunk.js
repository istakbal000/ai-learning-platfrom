// ============================================================
// ContentChunk Model - Bite-sized pieces of educational content
// ============================================================
// When we upload a PDF, we break it into smaller "chunks" (about 400-500 words).
// This makes it easier to generate focused quiz questions.
// Think of chunks as "study cards" from a textbook.

const mongoose = require('mongoose');

const contentChunkSchema = new mongoose.Schema({
  // Where did this chunk come from?
  sourceId: {
    type: String,
    required: [true, 'Need to know which document this came from'],
    index: true
  },
  
  // Position in the original document (0 = first chunk, 1 = second, etc.)
  chunkIndex: {
    type: Number,
    required: [true, 'Chunk index is required'],
    min: [0, 'Chunk index cannot be negative']
  },
  
  // A friendly readable ID like "SRC17JH2K8LM_CH001"
  chunkId: {
    type: String,
    unique: true,
    required: true
  },
  
  // What topic does this chunk cover?
  topic: {
    type: String,
    required: [true, 'Please specify a topic'],
    trim: true,
    maxlength: [100, 'Topic name is too long (max 100 characters)']
  },
  
  // The actual content - the heart of the chunk!
  text: {
    type: String,
    required: [true, 'Chunk needs text content'],
    minlength: [50, 'Text is too short (min 50 characters)'],
    maxlength: [5000, 'Text is too long (max 5000 characters)']
  },
  
  // Auto-calculated: how many words are in this chunk?
  wordCount: {
    type: Number,
    default: 0
  },
  
  // Have we created quiz questions for this chunk yet?
  hasQuiz: {
    type: Boolean,
    default: false
  },
  
  // When was this created/modified?
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Before saving, automatically update timestamps and word count
contentChunkSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  // Count words by splitting on whitespace
  this.wordCount = this.text.split(/\s+/).length;
  next();
});

// Indexes for fast lookups
contentChunkSchema.index({ sourceId: 1, chunkIndex: 1 }); // Get chunks in order
contentChunkSchema.index({ topic: 1 });                    // Find by topic
contentChunkSchema.index({ chunkId: 1 });                  // Find specific chunk
contentChunkSchema.index({ hasQuiz: 1 });                  // Find chunks needing quizzes

module.exports = mongoose.model('ContentChunk', contentChunkSchema);
