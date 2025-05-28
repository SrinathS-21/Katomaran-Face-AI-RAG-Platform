const express = require('express');
const axios = require('axios');
const Face = require('../models/Face');
const logger = require('../utils/logger');
const TimezoneUtils = require('../utils/timezone');

const router = express.Router();

// Chat endpoint for RAG queries
router.post('/query', async (req, res) => {
  try {
    const { message, conversation_id } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Message is required and must be a non-empty string'
      });
    }

    // Get current face data for context
    const faces = await Face.find({ is_active: true })
      .select('-encoding') // Don't include encoding data
      .sort({ registered_at: -1 });

    // Prepare context data for RAG
    const contextData = {
      total_registered_faces: faces.length,
      faces: faces.map(face => ({
        name: face.name,
        registered_at: face.registered_at,
        confidence: face.metadata?.confidence || 0,
        image_quality: face.metadata?.image_quality || 'unknown'
      })),
      last_registered: faces.length > 0 ? faces[0] : null,
      registration_dates: faces.map(f => f.registered_at)
    };

    // Send query to Python RAG service
    const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8002';

    const ragResponse = await axios.post(`${ragServiceUrl}/query`, {
      message: message.trim(),
      context_data: contextData,
      conversation_id: conversation_id || null
    }, {
      timeout: 30000 // 30 seconds timeout
    });

    if (!ragResponse.data.success) {
      return res.status(400).json({
        error: ragResponse.data.error || 'RAG query failed'
      });
    }

    logger.info(`RAG query processed: "${message.substring(0, 50)}..."`);

    res.json({
      success: true,
      response: ragResponse.data.response,
      conversation_id: ragResponse.data.conversation_id,
      sources: ragResponse.data.sources || [],
      metadata: {
        query_time: ragResponse.data.query_time || 0,
        model_used: ragResponse.data.model_used || 'unknown',
        context_used: ragResponse.data.context_used || false
      }
    });

  } catch (error) {
    logger.error('RAG query error:', error);

    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'RAG service is unavailable'
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again later.'
      });
    }

    res.status(500).json({
      error: 'Internal server error during query processing'
    });
  }
});

// Get conversation history
router.get('/conversations/:conversation_id', async (req, res) => {
  try {
    const { conversation_id } = req.params;

    if (!conversation_id) {
      return res.status(400).json({
        error: 'Conversation ID is required'
      });
    }

    // Send request to RAG service to get conversation history
    const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8002';

    const response = await axios.get(`${ragServiceUrl}/conversations/${conversation_id}`, {
      timeout: 10000
    });

    res.json({
      success: true,
      conversation: response.data.conversation || [],
      conversation_id: conversation_id
    });

  } catch (error) {
    logger.error('Error fetching conversation:', error);

    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'RAG service is unavailable'
      });
    }

    if (error.response?.status === 404) {
      return res.status(404).json({
        error: 'Conversation not found'
      });
    }

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Get face statistics for RAG context
router.get('/stats', async (req, res) => {
  try {
    const totalFaces = await Face.countDocuments({ is_active: true });
    const recentFaces = await Face.find({ is_active: true })
      .sort({ registered_at: -1 })
      .limit(5)
      .select('name registered_at');

    const oldestFace = await Face.findOne({ is_active: true })
      .sort({ registered_at: 1 })
      .select('name registered_at');

    const newestFace = await Face.findOne({ is_active: true })
      .sort({ registered_at: -1 })
      .select('name registered_at');

    // Calculate registration frequency
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentRegistrations = await Face.countDocuments({
      is_active: true,
      registered_at: { $gte: thirtyDaysAgo }
    });

    res.json({
      success: true,
      stats: {
        total_faces: totalFaces,
        recent_registrations_30_days: recentRegistrations,
        oldest_registration: oldestFace,
        newest_registration: newestFace,
        recent_faces: recentFaces
      }
    });

  } catch (error) {
    logger.error('Error fetching face stats:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

module.exports = router;
