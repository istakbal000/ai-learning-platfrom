// ============================================================
// Text Chunking Utilities - Break Big Text Into Bite-Sized Pieces ✂️
// ============================================================
// When we get a long PDF, we need to break it into smaller chunks
// (about 400-500 words each). This makes it easier to generate
// focused quiz questions from each section.

// Default settings for chunking
const DEFAULT_CONFIG = {
  minChunkSize: 300,   // Minimum words per chunk
  maxChunkSize: 500,   // Maximum words per chunk (ideal for quiz generation)
  overlapWords: 50     // Overlap between chunks helps maintain context
};

/**
 * Split text into chunks based on word count
 * This is the basic chunker - splits every 400-500 words
 * 
 * @param {string} text - Big text to split up
 * @param {Object} config - Settings for chunking
 * @returns {Array} Array of chunk objects with text, wordCount, and index
 */
const chunkText = (text, config = {}) => {
  const { minChunkSize, maxChunkSize, overlapWords } = { ...DEFAULT_CONFIG, ...config };

  // If no text or wrong type, return empty
  if (!text || typeof text !== 'string') {
    return [];
  }

  const words = text.trim().split(/\s+/);

  // If text is already small enough, return as single chunk
  if (words.length <= maxChunkSize) {
    return [{
      text: text.trim(),
      wordCount: words.length,
      index: 0
    }];
  }

  const chunks = [];
  let currentIndex = 0;
  let i = 0;

  // Create chunks with overlap
  while (i < words.length) {
    const chunkWords = words.slice(i, i + maxChunkSize);
    const chunkText = chunkWords.join(' ');

    chunks.push({
      text: chunkText,
      wordCount: chunkWords.length,
      index: currentIndex
    });

    currentIndex++;
    // Move forward but keep some overlap for context
    i += maxChunkSize - overlapWords;

    // Handle remaining text at the end
    if (i >= words.length - minChunkSize && i < words.length) {
      const remainingWords = words.slice(i);
      if (remainingWords.length >= minChunkSize) {
        chunks.push({
          text: remainingWords.join(' '),
          wordCount: remainingWords.length,
          index: currentIndex
        });
      }
      break;
    }
  }

  return chunks;
};

/**
 * Attempts to chunk at sentence boundaries for better coherence
 * @param {string} text - Text to chunk
 * @param {Object} config - Chunking configuration
 * @returns {Array<{text: string, wordCount: number, index: number}>} Array of chunks
 */
const chunkBySentences = (text, config = {}) => {
  const { minChunkSize, maxChunkSize } = { ...DEFAULT_CONFIG, ...config };

  if (!text || typeof text !== 'string') {
    return [];
  }

  // Split into sentences (rough approximation)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  const chunks = [];
  let currentChunk = [];
  let currentWordCount = 0;
  let currentIndex = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/);
    const sentenceWordCount = sentenceWords.length;

    // If adding this sentence exceeds max size, finalize current chunk
    if (currentWordCount + sentenceWordCount > maxChunkSize && currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.join(' ').trim(),
        wordCount: currentWordCount,
        index: currentIndex
      });
      currentIndex++;
      currentChunk = [];
      currentWordCount = 0;
    }

    currentChunk.push(sentence.trim());
    currentWordCount += sentenceWordCount;

    // If we've hit minimum size, finalize chunk
    if (currentWordCount >= minChunkSize) {
      chunks.push({
        text: currentChunk.join(' ').trim(),
        wordCount: currentWordCount,
        index: currentIndex
      });
      currentIndex++;
      currentChunk = [];
      currentWordCount = 0;
    }
  }

  // Add remaining content
  if (currentChunk.length > 0) {
    const remainingText = currentChunk.join(' ').trim();
    const remainingWords = remainingText.split(/\s+/).length;

    if (remainingWords >= minChunkSize / 2) {
      chunks.push({
        text: remainingText,
        wordCount: remainingWords,
        index: currentIndex
      });
    } else if (chunks.length > 0) {
      // Append to last chunk if too small
      const lastChunk = chunks[chunks.length - 1];
      lastChunk.text += ' ' + remainingText;
      lastChunk.wordCount += remainingWords;
    }
  }

  return chunks;
};

/**
 * Intelligently chunks text by trying paragraph boundaries first
 * @param {string} text - Text to chunk
 * @param {Object} config - Chunking configuration
 * @returns {Array<{text: string, wordCount: number, index: number}>} Array of chunks
 */
const smartChunk = (text, config = {}) => {
  const { minChunkSize, maxChunkSize } = { ...DEFAULT_CONFIG, ...config };

  if (!text || typeof text !== 'string') {
    return [];
  }

  // Split by paragraphs first
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

  if (paragraphs.length === 1) {
    return chunkBySentences(text, config);
  }

  const chunks = [];
  let currentChunk = [];
  let currentWordCount = 0;
  let currentIndex = 0;

  for (const paragraph of paragraphs) {
    const paragraphWords = paragraph.trim().split(/\s+/);
    const paragraphWordCount = paragraphWords.length;

    // If paragraph is too large, split it by sentences
    if (paragraphWordCount > maxChunkSize) {
      if (currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.join('\n\n').trim(),
          wordCount: currentWordCount,
          index: currentIndex
        });
        currentIndex++;
        currentChunk = [];
        currentWordCount = 0;
      }

      const sentenceChunks = chunkBySentences(paragraph, config);
      sentenceChunks.forEach(chunk => {
        chunk.index = currentIndex;
        chunks.push(chunk);
        currentIndex++;
      });
      continue;
    }

    // Check if adding this paragraph exceeds max size
    if (currentWordCount + paragraphWordCount > maxChunkSize && currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.join('\n\n').trim(),
        wordCount: currentWordCount,
        index: currentIndex
      });
      currentIndex++;
      currentChunk = [];
      currentWordCount = 0;
    }

    currentChunk.push(paragraph.trim());
    currentWordCount += paragraphWordCount;

    // If we've hit minimum size, finalize chunk
    if (currentWordCount >= minChunkSize) {
      chunks.push({
        text: currentChunk.join('\n\n').trim(),
        wordCount: currentWordCount,
        index: currentIndex
      });
      currentIndex++;
      currentChunk = [];
      currentWordCount = 0;
    }
  }

  // Add remaining content
  if (currentChunk.length > 0) {
    const remainingText = currentChunk.join('\n\n').trim();
    const remainingWords = remainingText.split(/\s+/).length;

    if (remainingWords >= minChunkSize / 2) {
      chunks.push({
        text: remainingText,
        wordCount: remainingWords,
        index: currentIndex
      });
    } else if (chunks.length > 0) {
      const lastChunk = chunks[chunks.length - 1];
      lastChunk.text += '\n\n' + remainingText;
      lastChunk.wordCount += remainingWords;
    }
  }

  return chunks;
};

module.exports = {
  chunkText,
  chunkBySentences,
  smartChunk,
  DEFAULT_CONFIG
};
