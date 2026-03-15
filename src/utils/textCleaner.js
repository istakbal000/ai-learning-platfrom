// ============================================================
// Text Cleaning Utilities - Make PDF text readable 🧹
// ============================================================
// PDF extraction often gives us messy text with weird characters,
// extra spaces, and noise. These functions clean it up so we can
// use it for quiz generation.

/**
 * Clean up messy PDF text by removing weird characters and normalizing it
 * Think of this as washing dirty laundry - we take messy input and make it nice
 * 
 * @param {string} text - Raw messy text from PDF
 * @returns {string} Clean, readable text
 */
const cleanText = (text) => {
  // If there's no text or it's not a string, return empty
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    // Remove weird PDF control characters (invisible garbage)
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    // Fix line endings (Windows vs Mac vs Linux)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove too many blank lines (more than 2 in a row)
    .replace(/\n{3,}/g, '\n\n')
    // Replace tabs with spaces
    .replace(/\t+/g, ' ')
    // Fix multiple spaces in a row
    .replace(/ {2,}/g, ' ')
    // Remove page numbers (like "\n 5 \n")
    .replace(/\n\s*\d+\s*\n/g, '\n')
    // Remove "Page X of Y" headers/footers
    .replace(/Page \d+ of \d+/gi, '')
    // Remove URLs (they're not helpful for quizzes)
    .replace(/https?:\/\/[^\s]+/g, '')
    // Remove email addresses
    .replace(/[\w.-]+@[\w.-]+\.\w+/g, '')
    // Clean up each line individually
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Final cleanup
    .trim();
};

/**
 * Remove common PDF junk like copyright notices and headers
 * This is the "deep clean" after the initial wash
 * 
 * @param {string} text - Text to filter
 * @returns {string} Cleaner text without common noise
 */
const filterNoise = (text) => {
  if (!text) return '';

  // These are patterns we commonly see in PDFs that aren't useful content
  const noisePatterns = [
    // Copyright and legal stuff
    /^\s*Copyright\s+\d+/gim,
    /^\s*All rights reserved/gim,
    /^\s*Confidential/gim,
    // PDF internal codes
    /\(cid:\d+\)/g,
    // Academic paper section headers (we don't need these in content)
    /^\s*Abstract\s*$/gim,
    /^\s*Introduction\s*$/gim,
    /^\s*Conclusion\s*$/gim,
    /^\s*References\s*$/gim,
    /^\s*Bibliography\s*$/gim,
  ];

  let cleaned = text;
  noisePatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  return cleaned;
};

/**
 * Try to figure out what topics are covered in the text
 * This helps us auto-categorize content for better organization
 * 
 * @param {string} text - Content to analyze
 * @returns {string[]} Array of detected topics (up to 3)
 */
const extractTopics = (text) => {
  if (!text) return [];

  // Words that often come before topic names
  const topicIndicators = [
    'chapter', 'section', 'unit', 'lesson', 'topic', 'module',
    'introduction to', 'understanding', 'fundamentals of', 'basics of'
  ];

  const sentences = text.split(/[.!?]/);
  const topics = [];

  // Look through sentences for topic indicators
  sentences.forEach(sentence => {
    topicIndicators.forEach(indicator => {
      const regex = new RegExp(`${indicator}\\s+(.{3,50})`, 'i');
      const match = sentence.match(regex);
      if (match) {
        topics.push(match[1].trim());
      }
    });
  });

  // Remove duplicates and limit to 3 topics
  return [...new Set(topics)].slice(0, 3);
};

/**
 * Check if text is good enough for making quiz questions
 * We need enough content to make meaningful questions
 * 
 * @param {string} text - Text to check
 * @returns {boolean} True if we can use this text
 */
const isValidContent = (text) => {
  if (!text || typeof text !== 'string') return false;

  const minLength = 100;      // Need at least 100 characters
  const maxLength = 10000;    // But not more than 10,000
  const minWordCount = 20;    // Need at least 20 words

  const wordCount = text.trim().split(/\s+/).length;
  const length = text.length;

  return length >= minLength &&
         length <= maxLength &&
         wordCount >= minWordCount;
};

// Export our cleaning functions for use in other files
module.exports = {
  cleanText,
  filterNoise,
  extractTopics,
  isValidContent
};
