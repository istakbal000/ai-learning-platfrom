// ============================================================
// LLM Service - The AI Quiz Generator 🤖
// ============================================================
// This service talks to Google's Gemini AI to create quiz questions.
// It's like having a smart teacher assistant who reads content and
// automatically creates questions to test student understanding.

const { GoogleGenerativeAI } = require('@google/generative-ai');
const QuizQuestion = require('../models/QuizQuestion');

// Connect to Gemini API using our API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Create the perfect prompt to ask Gemini for quiz questions
 * We carefully tell the AI exactly what we want and how to format it
 * 
 * @param {string} chunkText - The educational content to base questions on
 * @param {string} topic - What subject this covers
 * @returns {string} A detailed prompt ready to send to Gemini
 */
const generateQuizPrompt = (chunkText, topic) => {
  return `You are an educational quiz generator specializing in creating engaging questions for elementary school students.

Generate quiz questions based on the provided learning content.

Content:
"""
${chunkText}
"""

Topic: ${topic}

Generate the following questions:
- 2 Multiple Choice Questions (MCQ)
- 1 True/False Question
- 1 Fill-in-the-blank Question

Rules:
1. Questions must be suitable for elementary school students (grades 1-5)
2. Ensure answers are derived directly from the provided text
3. Assign appropriate difficulty levels (easy, medium, hard) based on cognitive complexity
4. For MCQs, provide 4 options with only one correct answer
5. For True/False, the answer must be either "True" or "False"
6. For Fill-in-the-blank, provide the exact word or phrase from the text

Return ONLY a valid JSON object in this exact format:
{
  "questions": [
    {
      "question": "string",
      "type": "MCQ",
      "options": ["option1", "option2", "option3", "option4"],
      "answer": "correct option",
      "difficulty": "easy|medium|hard",
      "explanation": "brief explanation"
    },
    {
      "question": "string",
      "type": "TRUE_FALSE",
      "options": ["True", "False"],
      "answer": "True|False",
      "difficulty": "easy|medium|hard",
      "explanation": "brief explanation"
    },
    {
      "question": "string with _____ blank",
      "type": "FILL_BLANK",
      "options": [],
      "answer": "exact word/phrase",
      "difficulty": "easy|medium|hard",
      "explanation": "brief explanation"
    }
  ]
}`;
};

/**
 * Send our prompt to Gemini and get back quiz questions
 * We use the free "flash" model which is fast and works great for this
 * 
 * @param {string} prompt - Our carefully crafted prompt
 * @returns {Promise<Object>} The AI-generated questions as JSON
 */
const callGemini = async (prompt) => {
  try {
    // Use Gemini 1.5 Flash - it's fast and free!
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Ask Gemini to generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Sometimes Gemini wraps JSON in markdown, so we try to extract it
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Gemini didn't respond as expected: ${error.message}`);
  }
};

/**
 * Generate quiz questions for one chunk of content
 * This is the main function that creates questions from text
 * 
 * @param {Object} chunk - The content chunk to base questions on
 * @param {Object} source - The original source document (for grade level, etc.)
 * @returns {Promise<Array>} Array of saved quiz questions
 */
const generateQuizForChunk = async (chunk, source) => {
  try {
    // Step 1: Create our detailed prompt
    const prompt = generateQuizPrompt(chunk.text, chunk.topic);
    
    // Step 2: Send to Gemini and get response
    const response = await callGemini(prompt);

    // Make sure we got valid questions back
    if (!response.questions || !Array.isArray(response.questions)) {
      throw new Error('Gemini returned something unexpected (not valid quiz questions)');
    }

    // Step 3: Clean up and validate each question
    const validatedQuestions = response.questions.map((q) => {
      // Make sure the type is valid (MCQ, TRUE_FALSE, or FILL_BLANK)
      const validTypes = ['MCQ', 'TRUE_FALSE', 'FILL_BLANK'];
      if (!validTypes.includes(q.type)) {
        q.type = 'MCQ';  // Default to multiple choice if invalid
      }

      // Make sure difficulty is valid
      const validDifficulties = ['easy', 'medium', 'hard'];
      if (!validDifficulties.includes(q.difficulty)) {
        q.difficulty = 'medium';  // Default to medium
      }

      // Fix options if missing or wrong
      if (q.type === 'MCQ' && (!q.options || q.options.length < 2)) {
        q.options = ['Option A', 'Option B', 'Option C', 'Option D'];
      }
      if (q.type === 'TRUE_FALSE') {
        q.options = ['True', 'False'];  // Always these two
      }
      if (q.type === 'FILL_BLANK') {
        q.options = [];  // No options for fill-in-the-blank
      }

      // Return the cleaned-up question ready for the database
      return {
        chunkId: chunk.chunkId,
        sourceId: chunk.sourceId,
        question: q.question,
        type: q.type,
        options: q.options || [],
        answer: q.answer,
        difficulty: q.difficulty,
        topic: chunk.topic,
        grade: source.grade,
        explanation: q.explanation || '',  // Why this is the right answer
        timesAsked: 0,      // New question, never asked
        timesCorrect: 0,    // No correct answers yet
        accuracyRate: 0     // Will be calculated as students answer
      };
    });

    // Step 4: Save all questions to the database
    const savedQuestions = await QuizQuestion.insertMany(validatedQuestions);

    return savedQuestions;
  } catch (error) {
    throw new Error(`Couldn't generate quiz: ${error.message}`);
  }
};

/**
 * Generate quizzes for multiple chunks at once
 * This processes several content chunks and generates questions for each
 * 
 * @param {Array} chunks - Array of content chunks
 * @param {Object} source - The source document info
 * @returns {Promise<Object>} Summary of what worked and what didn't
 */
const generateQuizzesForChunks = async (chunks, source) => {
  const results = {
    success: [],  // Chunks that got questions generated
    failed: []    // Chunks that had problems
  };

  // Process each chunk one by one
  for (const chunk of chunks) {
    try {
      const questions = await generateQuizForChunk(chunk, source);
      results.success.push({
        chunkId: chunk.chunkId,
        questionCount: questions.length
      });
    } catch (error) {
      results.failed.push({
        chunkId: chunk.chunkId,
        error: error.message
      });
    }
  }

  return results;
};

/**
 * Check if a question is properly formed and ready for students
 * This validates that questions have all required fields
 * 
 * @param {string} questionId - ID of the question to check
 * @returns {Promise<Object>} Validation results with any issues found
 */
const validateQuestion = async (questionId) => {
  try {
    const question = await QuizQuestion.findById(questionId);

    if (!question) {
      throw new Error(`Can't find question with ID: ${questionId}`);
    }

    const issues = [];

    // Check if question text exists and is reasonable length
    if (!question.question || question.question.length < 10) {
      issues.push('Question text is too short or missing');
    }

    // Every question needs an answer
    if (!question.answer) {
      issues.push('Answer is missing');
    }

    // MCQ needs proper options
    if (question.type === 'MCQ') {
      if (!question.options || question.options.length < 2) {
        issues.push('Multiple choice questions need at least 2 options');
      }
      if (!question.options.includes(question.answer)) {
        issues.push('The correct answer is not in the options list');
      }
    }

    // True/False has specific valid answers
    if (question.type === 'TRUE_FALSE') {
      const validAnswers = ['True', 'False'];
      if (!validAnswers.includes(question.answer)) {
        issues.push('True/False answers must be exactly "True" or "False"');
      }
    }

    return {
      isValid: issues.length === 0,  // Valid if no issues found
      issues,
      questionId
    };
  } catch (error) {
    throw new Error(`Validation check failed: ${error.message}`);
  }
};

// Export our functions for use in other parts of the app
module.exports = {
  generateQuizForChunk,
  generateQuizzesForChunks,
  validateQuestion,
  generateQuizPrompt
};
