const express = require('express');
const multer = require('multer');
const axios = require('axios');
const mongoose = require('mongoose');
const Face = require('../models/Face');
const logger = require('../utils/logger');
const TimezoneUtils = require('../utils/timezone');

const router = express.Router();

// Middleware to check database connection
const checkDatabaseConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: 'Database service unavailable',
      message: 'Please check MongoDB connection and try again'
    });
  }
  next();
};

// Helper function to format face data with IST timestamps
const formatFaceData = (face) => {
  const faceObj = face.toObject ? face.toObject() : face;
  return {
    ...faceObj,
    registered_at: TimezoneUtils.formatForAPI(faceObj.registered_at),
    createdAt: faceObj.createdAt ? TimezoneUtils.formatForAPI(faceObj.createdAt) : undefined,
    updatedAt: faceObj.updatedAt ? TimezoneUtils.formatForAPI(faceObj.updatedAt) : undefined
  };
};

// Configure multer for handling image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Register a new face
router.post('/register', upload.single('image'), checkDatabaseConnection, async (req, res) => {
  try {
    const { name } = req.body;
    const imageBuffer = req.file?.buffer;

    if (!name || !imageBuffer) {
      return res.status(400).json({
        error: 'Name and image are required'
      });
    }

    // Check if name already exists
    const existingFace = await Face.findOne({ name: name.trim(), is_active: true });
    if (existingFace) {
      return res.status(409).json({
        error: 'A person with this name is already registered'
      });
    }

    // Send image to Python face recognition service
    const pythonServiceUrl = process.env.FACE_RECOGNITION_SERVICE_URL || 'http://localhost:8001';

    // Create form data for Node.js
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('image', imageBuffer, {
      filename: 'face.jpg',
      contentType: req.file.mimetype
    });
    formData.append('name', name);

    logger.info(`Sending registration request to ${pythonServiceUrl}/register for name: ${name}`);
    logger.info(`Image buffer size: ${imageBuffer.length} bytes, Content-Type: ${req.file.mimetype}`);

    const response = await axios.post(`${pythonServiceUrl}/register`, formData, {
      headers: {
        ...formData.getHeaders()
      },
      timeout: 30000 // 30 seconds timeout
    });

    if (!response.data.success) {
      return res.status(400).json({
        error: response.data.error || 'Face registration failed'
      });
    }

    // Save face encoding to database
    const newFace = new Face({
      name: name.trim(),
      encoding: response.data.encoding,
      metadata: {
        confidence: response.data.confidence || 0.8,
        image_quality: response.data.image_quality || 'medium',
        face_landmarks: response.data.landmarks || {}
      }
    });

    await newFace.save();

    logger.info(`Face registered successfully: ${name}`);

    res.status(201).json({
      success: true,
      message: 'Face registered successfully',
      data: {
        id: newFace._id,
        name: newFace.name,
        registered_at: TimezoneUtils.formatForAPI(newFace.registered_at),
        confidence: newFace.metadata.confidence
      }
    });

  } catch (error) {
    logger.error('Face registration error:', error.message);
    if (error.response) {
      logger.error('Face service response status:', error.response.status);
      logger.error('Face service response data:', error.response.data);
    }

    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Face recognition service is unavailable'
      });
    }

    res.status(500).json({
      error: 'Internal server error during face registration',
      details: error.response?.data || error.message
    });
  }
});

// Recognize faces in an image
router.post('/recognize', upload.single('image'), async (req, res) => {
  try {
    const imageBuffer = req.file?.buffer;

    if (!imageBuffer) {
      return res.status(400).json({
        error: 'Image is required'
      });
    }

    // Send image to Python face recognition service
    const pythonServiceUrl = process.env.FACE_RECOGNITION_SERVICE_URL || 'http://localhost:8001';

    // Create form data for Node.js
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('image', imageBuffer, {
      filename: 'face.jpg',
      contentType: req.file.mimetype
    });

    const response = await axios.post(`${pythonServiceUrl}/recognize`, formData, {
      headers: {
        ...formData.getHeaders()
      },
      timeout: 30000
    });

    if (!response.data.success) {
      return res.status(400).json({
        error: response.data.error || 'Face recognition failed'
      });
    }

    // Match encodings with database
    const detectedFaces = response.data.faces || [];
    const recognizedFaces = [];

    for (const detectedFace of detectedFaces) {
      const similarFaces = await Face.findSimilarFaces(detectedFace.encoding, 0.6);

      if (similarFaces.length > 0) {
        const bestMatch = similarFaces[0];
        recognizedFaces.push({
          name: bestMatch.face.name,
          confidence: bestMatch.similarity,
          bounding_box: detectedFace.bounding_box,
          face_id: bestMatch.face._id
        });
      } else {
        recognizedFaces.push({
          name: 'Unknown',
          confidence: 0,
          bounding_box: detectedFace.bounding_box,
          face_id: null
        });
      }
    }

    res.json({
      success: true,
      faces: recognizedFaces,
      total_faces: recognizedFaces.length
    });

  } catch (error) {
    logger.error('Face recognition error:', error);

    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Face recognition service is unavailable'
      });
    }

    res.status(500).json({
      error: 'Internal server error during face recognition'
    });
  }
});

// Get all registered faces
router.get('/', checkDatabaseConnection, async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (page - 1) * limit;

    let query = { is_active: true };
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const faces = await Face.find(query)
      .select('-encoding') // Don't return encoding data
      .sort({ registered_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Face.countDocuments(query);

    res.json({
      success: true,
      data: faces.map(formatFaceData),
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_records: total,
        has_next: page * limit < total,
        has_prev: page > 1
      }
    });

  } catch (error) {
    logger.error('Error fetching faces:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Get face by ID
router.get('/:id', checkDatabaseConnection, async (req, res) => {
  try {
    const face = await Face.findById(req.params.id).select('-encoding');

    if (!face || !face.is_active) {
      return res.status(404).json({
        error: 'Face not found'
      });
    }

    res.json({
      success: true,
      data: formatFaceData(face)
    });

  } catch (error) {
    logger.error('Error fetching face:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Delete face by ID
router.delete('/:id', checkDatabaseConnection, async (req, res) => {
  try {
    const face = await Face.findById(req.params.id);

    if (!face || !face.is_active) {
      return res.status(404).json({
        error: 'Face not found'
      });
    }

    // Soft delete
    face.is_active = false;
    await face.save();

    logger.info(`Face deleted: ${face.name} (ID: ${face._id})`);

    res.json({
      success: true,
      message: 'Face deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting face:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

module.exports = router;
