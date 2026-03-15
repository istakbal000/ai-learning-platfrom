// ============================================================
// Chunk Service - Break big documents into bite-sized pieces
// ============================================================
// When a PDF is uploaded, this service:
// 1. Cleans the extracted text
// 2. Breaks it into chunks (400-500 words each)
// 3. Saves chunks to the database
// 4. Links them back to the original source

const { v4: uuidv4 } = require('uuid');
const { smartChunk, cleanText } = require('../utils/chunkText');
const { extractTopics } = require('../utils/textCleaner');
const Source = require('../models/Source');
const ContentChunk = require('../models/ContentChunk');

/**
 * Main function: Process a PDF's text and save it as chunks
 * This is the heart of our content ingestion pipeline
 * 
 * @param {string} text - Raw text extracted from PDF
 * @param {Object} sourceData - Info about the PDF (title, subject, grade, etc.)
 * @returns {Promise<Object>} The saved source and all its chunks
 */
const processAndStoreChunks = async (text, sourceData) => {
  try {
    // Step 1: Clean up the text (remove weird characters, extra spaces, etc.)
    const cleanedText = cleanText(text);

    // Step 2: Create a unique ID for this source document
    // We use timestamp + base36 to make it short but unique
    const sourceId = `SRC${Date.now().toString(36).toUpperCase()}`;

    // Step 3: Save the source document info
    const source = new Source({
      sourceId,
      title: sourceData.title,
      subject: sourceData.subject,
      grade: sourceData.grade,
      filePath: sourceData.filePath
    });

    // Step 4: Break the text into manageable chunks
    // Each chunk is about 400-500 words - perfect for quiz generation
    const chunks = smartChunk(cleanedText, {
      minChunkSize: 400,
      maxChunkSize: 500,
      overlapWords: 50  // Slight overlap helps with context
    });

    // Step 5: Create ContentChunk documents for each piece
    const contentChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Try to auto-detect the topic, or fall back to provided topic or "General"
      const detectedTopics = extractTopics(chunk.text);
      const topic = detectedTopics[0] || sourceData.topic || 'General';

      const contentChunk = new ContentChunk({
        sourceId,
        chunkIndex: chunk.index,
        chunkId: `${sourceId}_CH${String(chunk.index).padStart(3, '0')}`,
        topic,
        text: chunk.text
      });

      contentChunks.push(contentChunk);
    }

    // Step 6: Update source with how many chunks we created
    source.totalChunks = contentChunks.length;

    // Step 7: Save everything to the database
    await source.save();
    await ContentChunk.insertMany(contentChunks);

    return {
      source,
      chunks: contentChunks,
      totalChunks: contentChunks.length
    };
  } catch (error) {
    throw new Error(`Failed to process chunks: ${error.message}`);
  }
};

/**
 * Get all chunks from a specific source (like all pieces of a textbook chapter)
 * 
 * @param {string} sourceId - Which source to get chunks from
 * @returns {Promise<Array>} All chunks in order
 */
const getChunksBySource = async (sourceId) => {
  try {
    const chunks = await ContentChunk.find({ sourceId })
      .sort({ chunkIndex: 1 })  // Sort in original order
      .lean();  // Return plain objects (faster)

    return chunks;
  } catch (error) {
    throw new Error(`Failed to get chunks: ${error.message}`);
  }
};

/**
 * Get a single specific chunk by its ID
 * 
 * @param {string} chunkId - The chunk's unique ID (e.g., "SRC17JH2K8LM_CH001")
 * @returns {Promise<Object>} The chunk content
 */
const getChunkById = async (chunkId) => {
  try {
    const chunk = await ContentChunk.findOne({ chunkId });

    if (!chunk) {
      throw new Error(`Can't find chunk: ${chunkId}`);
    }

    return chunk;
  } catch (error) {
    throw new Error(`Failed to get chunk: ${error.message}`);
  }
};

/**
 * Find chunks that haven't been turned into quizzes yet
 * This helps us know what content still needs AI processing
 * 
 * @param {number} limit - Max number of chunks to return
 * @returns {Promise<Array>} Chunks waiting for quiz generation
 */
const getChunksWithoutQuizzes = async (limit = 10) => {
  try {
    const chunks = await ContentChunk.find({ hasQuiz: false })
      .limit(limit)
      .sort({ createdAt: 1 })  // Oldest first
      .lean();

    return chunks;
  } catch (error) {
    throw new Error(`Failed to find chunks without quizzes: ${error.message}`);
  }
};

/**
 * Mark chunks as "quiz generated" so we don't process them again
 * 
 * @param {Array<string>} chunkIds - List of chunk IDs to mark
 * @returns {Promise<boolean>} True if update succeeded
 */
const markChunksAsQuizzed = async (chunkIds) => {
  try {
    await ContentChunk.updateMany(
      { chunkId: { $in: chunkIds } },
      { hasQuiz: true, updatedAt: new Date() }
    );

    return true;
  } catch (error) {
    throw new Error(`Failed to mark chunks: ${error.message}`);
  }
};

/**
 * Search for chunks by topic (useful for finding specific content)
 * 
 * @param {string} topic - Topic to search for
 * @param {number} limit - Max results to return
 * @returns {Promise<Array>} Matching chunks
 */
const getChunksByTopic = async (topic, limit = 10) => {
  try {
    const chunks = await ContentChunk.find({
      topic: { $regex: topic, $options: 'i' }  // Case-insensitive search
    })
      .limit(limit)
      .sort({ createdAt: -1 })  // Newest first
      .lean();

    return chunks;
  } catch (error) {
    throw new Error(`Failed to search by topic: ${error.message}`);
  }
};

// Export all our functions
module.exports = {
  processAndStoreChunks,
  getChunksBySource,
  getChunkById,
  getChunksWithoutQuizzes,
  markChunksAsQuizzed,
  getChunksByTopic
};
