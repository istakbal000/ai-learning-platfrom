// ============================================================
// PDF Service - Read and process PDF files
// ============================================================
// This service handles everything related to PDFs:
// - Extracting text content
// - Validating file format
// - Cleaning up after processing

const fs = require('fs');
const pdfParse = require('pdf-parse');

/**
 * Extract text from a PDF file
 * This is the main function that reads a PDF and pulls out the text content
 * 
 * @param {string} filePath - Where the PDF is stored
 * @returns {Promise<Object>} Object containing:
 *   - text: The extracted text content
 *   - pageCount: How many pages in the PDF
 *   - info: Metadata like title, author, etc.
 */
const extractText = async (filePath) => {
  try {
    // First, make sure the file actually exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Can't find PDF file: ${filePath}`);
    }

    // Read the file into memory
    const dataBuffer = fs.readFileSync(filePath);
    
    // Use pdf-parse library to extract content
    const pdfData = await pdfParse(dataBuffer);

    // Return what we found
    return {
      text: pdfData.text || '',  // The actual text content
      pageCount: pdfData.numpages || 0,  // Number of pages
      info: {
        title: pdfData.info?.Title || null,
        author: pdfData.info?.Author || null,
        subject: pdfData.info?.Subject || null,
        keywords: pdfData.info?.Keywords || null
      }
    };
  } catch (error) {
    throw new Error(`Failed to read PDF: ${error.message}`);
  }
};

/**
 * Check if a file is actually a valid PDF
 * We check three things:
 * 1. Does the file exist?
 * 2. Does it have a .pdf extension?
 * 3. Does it start with the PDF magic number "%PDF-"?
 * 
 * @param {string} filePath - Path to check
 * @returns {boolean} True if it's a real PDF
 */
const isValidPDF = (filePath) => {
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return false;
  }

  // Check file extension
  const extension = filePath.split('.').pop().toLowerCase();
  if (extension !== 'pdf') {
    return false;
  }

  // Check PDF magic number (all PDFs start with "%PDF-")
  const buffer = fs.readFileSync(filePath);
  const pdfHeader = buffer.slice(0, 5).toString('ascii');
  return pdfHeader === '%PDF-';
};

/**
 * Get basic info about a PDF without reading all the text
 * This is faster than extractText() when we just want metadata
 * 
 * @param {string} filePath - Where the PDF is stored
 * @returns {Promise<Object>} Basic info like page count
 */
const getMetadata = async (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Can't find PDF file: ${filePath}`);
    }

    // Only read the first page for speed
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer, { max: 1 });

    return {
      pageCount: pdfData.numpages || 0,
      info: pdfData.info || {}
    };
  } catch (error) {
    throw new Error(`Failed to read PDF info: ${error.message}`);
  }
};

/**
 * Delete a PDF file after we're done with it
 * Keeps our storage clean!
 * 
 * @param {string} filePath - File to delete
 * @returns {boolean} True if deleted successfully
 */
const cleanupFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Cleaned up: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`⚠️  Failed to delete ${filePath}:`, error.message);
    return false;
  }
};

// Export all our functions for use in other files
module.exports = {
  extractText,
  isValidPDF,
  getMetadata,
  cleanupFile
};
