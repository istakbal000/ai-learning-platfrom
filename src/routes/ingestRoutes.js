// ============================================================
// Ingest Routes - Where PDFs Come In 📄
// ============================================================
// This file defines all the routes for uploading and managing PDFs
// We use multer (a file upload library) to handle the actual file uploads

const express = require('express');
const multer = require('multer');
const path = require('path');
const ingestController = require('../controllers/ingestController');

const router = express.Router();

// Configure multer to handle PDF uploads
const storage = multer.diskStorage({
  // Where to save uploaded files
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  // How to name the files (add timestamp to avoid conflicts)
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'pdf-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Only accept PDF files
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
    cb(null, true);  // Accept the file
  } else {
    cb(new Error('Only PDF files are allowed'), false);  // Reject the file
  }
};

// Set up the upload middleware with our settings
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  }
});

// ============================================================
// ROUTES
// ============================================================

// POST /api/ingest - Upload a new PDF file
router.post('/', upload.single('pdf'), ingestController.uploadPDF);

// GET /api/ingest - List all uploaded PDFs (with pagination)
router.get('/', ingestController.listSources);

// GET /api/ingest/status/:sourceId - Check if a PDF is done processing
router.get('/status/:sourceId', ingestController.getSourceStatus);

// DELETE /api/ingest/:sourceId - Remove a PDF and all its content
router.delete('/:sourceId', ingestController.deleteSource);

module.exports = router;
