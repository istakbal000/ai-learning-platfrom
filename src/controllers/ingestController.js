// ============================================================
// Ingest Controller - Handle PDF Uploads 📄
// ============================================================
// This controller handles when teachers upload PDF files.
// It validates the file, extracts text, breaks it into chunks,
// and starts the quiz generation process.

const pdfService = require('../services/pdfService');
const chunkService = require('../services/chunkService');
const llmService = require('../services/llmService');

/**
 * POST /api/ingest
 * Upload a PDF and turn it into study content
 * 
 * What happens:
 * 1. Check that a file was actually uploaded
 * 2. Make sure all required info (title, subject, grade) is provided
 * 3. Validate that it's a real PDF file
 * 4. Extract text from the PDF
 * 5. Break text into chunks and save to database
 * 6. Start generating quiz questions (happens in background)
 */
const uploadPDF = async (req, res) => {
  try {
    // Step 1: Did they actually upload a file?
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No PDF file received. Please select a file to upload.'
      });
    }

    const { title, subject, grade, topic } = req.body;

    // Step 2: Check required fields
    if (!title || !subject || !grade) {
      // Clean up the uploaded file since we can't use it
      pdfService.cleanupFile(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Missing required info. Please provide: title, subject, and grade level.'
      });
    }

    // Step 3: Is this actually a PDF?
    if (!pdfService.isValidPDF(req.file.path)) {
      pdfService.cleanupFile(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'That doesn\'t look like a valid PDF file. Please upload a .pdf file.'
      });
    }

    // Step 4: Extract text from the PDF
    const pdfData = await pdfService.extractText(req.file.path);

    // Check if we got any text back
    if (!pdfData.text || pdfData.text.trim().length === 0) {
      pdfService.cleanupFile(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Couldn\'t find any text in that PDF. It might be scanned images or empty.'
      });
    }

    // Step 5: Process and save the content
    const sourceData = {
      title,
      subject,
      grade: parseInt(grade),
      filePath: req.file.path,
      topic: topic || 'General'
    };

    const { source, chunks, totalChunks } = await chunkService.processAndStoreChunks(
      pdfData.text,
      sourceData
    );

    // Step 6: Start generating quizzes (runs in background)
    // We don't wait for this because AI generation can take a while
    llmService.generateQuizzesForChunks(chunks, source).catch(error => {
      console.error('⚠️  Quiz generation error:', error.message);
    });

    // Success! Tell them what we did
    res.status(201).json({
      success: true,
      message: '📚 PDF uploaded successfully! We\'re generating quiz questions now.',
      data: {
        sourceId: source.sourceId,
        title: source.title,
        subject: source.subject,
        grade: source.grade,
        totalChunks,
        pageCount: pdfData.pageCount,
        quizGenerationStatus: 'in_progress'
      }
    });
  } catch (error) {
    // Something went wrong - clean up and report the error
    if (req.file) {
      pdfService.cleanupFile(req.file.path);
    }

    console.error('❌ PDF upload error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Sorry, something went wrong processing your PDF. Please try again.',
      error: error.message
    });
  }
};

/**
 * GET /api/ingest/status/:sourceId
 * Check if a PDF has finished being processed
 * Useful for showing "processing..." spinners on the frontend
 */
const getSourceStatus = async (req, res) => {
  try {
    const { sourceId } = req.params;

    const Source = require('../models/Source');
    const QuizQuestion = require('../models/QuizQuestion');

    // Find the source document
    const source = await Source.findOne({ sourceId });

    if (!source) {
      return res.status(404).json({
        success: false,
        message: `Couldn\'t find a source with ID: ${sourceId}`
      });
    }

    // Count how many quiz questions have been generated
    const questionCount = await QuizQuestion.countDocuments({ sourceId });

    res.status(200).json({
      success: true,
      data: {
        sourceId: source.sourceId,
        title: source.title,
        totalChunks: source.totalChunks,
        quizQuestionsGenerated: questionCount,
        processingComplete: questionCount > 0,
        createdAt: source.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Status check error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to check processing status',
      error: error.message
    });
  }
};

/**
 * DELETE /api/ingest/:sourceId
 * Remove a source and all its content (chunks + questions)
 */
const deleteSource = async (req, res) => {
  try {
    const { sourceId } = req.params;

    const Source = require('../models/Source');
    const ContentChunk = require('../models/ContentChunk');
    const QuizQuestion = require('../models/QuizQuestion');

    // Make sure the source exists first
    const source = await Source.findOne({ sourceId });
    if (!source) {
      return res.status(404).json({
        success: false,
        message: `Couldn\'t find a source with ID: ${sourceId}`
      });
    }

    // Delete everything associated with this source
    await ContentChunk.deleteMany({ sourceId });
    await QuizQuestion.deleteMany({ sourceId });
    await Source.deleteOne({ sourceId });

    res.status(200).json({
      success: true,
      message: '🗑️  Source and all related content deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete source error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete source',
      error: error.message
    });
  }
};

/**
 * GET /api/ingest
 * List all uploaded sources with pagination
 */
const listSources = async (req, res) => {
  try {
    const { page = 1, limit = 10, subject, grade } = req.query;

    const Source = require('../models/Source');

    // Build filter based on query params
    const filter = {};
    if (subject) filter.subject = subject;
    if (grade) filter.grade = parseInt(grade);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get sources and total count in parallel
    const [sources, total] = await Promise.all([
      Source.find(filter)
        .sort({ createdAt: -1 })  // Newest first
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Source.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: {
        sources,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('❌ List sources error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to list sources',
      error: error.message
    });
  }
};

module.exports = {
  uploadPDF,
  getSourceStatus,
  deleteSource,
  listSources
};
