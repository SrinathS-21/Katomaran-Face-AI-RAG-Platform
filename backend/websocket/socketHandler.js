const axios = require('axios');
const Face = require('../models/Face');
const logger = require('../utils/logger');

// Store active connections and their states
const activeConnections = new Map();

const socketHandler = (io) => {
  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Store connection info
    activeConnections.set(socket.id, {
      socket: socket,
      isRecognizing: false,
      lastFrameTime: 0
    });

    // Handle face recognition stream
    socket.on('start_recognition', (data) => {
      const connection = activeConnections.get(socket.id);
      if (connection) {
        connection.isRecognizing = true;
        logger.info(`Started face recognition for client: ${socket.id}`);

        socket.emit('recognition_status', {
          status: 'started',
          message: 'Face recognition started'
        });
      }
    });

    socket.on('stop_recognition', () => {
      const connection = activeConnections.get(socket.id);
      if (connection) {
        connection.isRecognizing = false;
        logger.info(`Stopped face recognition for client: ${socket.id}`);

        socket.emit('recognition_status', {
          status: 'stopped',
          message: 'Face recognition stopped'
        });
      }
    });

    // Handle real-time frame processing
    socket.on('process_frame', async (data) => {
      try {
        logger.info(`Processing frame for client: ${socket.id}`);

        const connection = activeConnections.get(socket.id);
        if (!connection || !connection.isRecognizing) {
          logger.warn(`Frame processing rejected - not recognizing for client: ${socket.id}`);
          return;
        }

        // Throttle frame processing (max 2 FPS)
        const now = Date.now();
        if (now - connection.lastFrameTime < 500) {
          logger.debug(`Frame throttled for client: ${socket.id}`);
          return;
        }
        connection.lastFrameTime = now;

        const { imageData, frameId } = data;

        if (!imageData) {
          logger.error(`No image data provided for frame: ${frameId}`);
          socket.emit('recognition_error', {
            error: 'No image data provided',
            frameId: frameId
          });
          return;
        }

        logger.info(`Processing frame ${frameId} for client: ${socket.id}`);

        // Convert base64 to buffer
        const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        logger.info(`Image buffer size: ${imageBuffer.length} bytes for frame: ${frameId}`);

        // Send to Python face recognition service
        const pythonServiceUrl = process.env.FACE_RECOGNITION_SERVICE_URL || 'http://localhost:8001';

        // Create form data for Node.js
        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('image', imageBuffer, {
          filename: 'frame.jpg',
          contentType: 'image/jpeg'
        });

        logger.info(`Sending frame ${frameId} to face recognition service: ${pythonServiceUrl}/recognize`);

        const response = await axios.post(`${pythonServiceUrl}/recognize`, formData, {
          headers: {
            ...formData.getHeaders()
          },
          timeout: 5000 // 5 seconds timeout for real-time processing
        });

        logger.info(`Face recognition response for frame ${frameId}:`, {
          success: response.data.success,
          facesCount: response.data.faces?.length || 0
        });

        if (!response.data.success) {
          logger.error(`Face recognition failed for frame ${frameId}:`, response.data.error);
          socket.emit('recognition_error', {
            error: response.data.error || 'Recognition failed',
            frameId: frameId
          });
          return;
        }

        // Match with database
        const detectedFaces = response.data.faces || [];
        const recognizedFaces = [];

        for (const detectedFace of detectedFaces) {
          const similarFaces = await Face.findSimilarFaces(detectedFace.encoding, 0.6);

          if (similarFaces.length > 0) {
            const bestMatch = similarFaces[0];
            recognizedFaces.push({
              name: bestMatch.face.name,
              confidence: Math.round(bestMatch.similarity * 100) / 100,
              bounding_box: detectedFace.bounding_box,
              face_id: bestMatch.face._id.toString()
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

        logger.info(`Sending recognition results for frame ${frameId}:`, {
          recognizedFacesCount: recognizedFaces.length,
          faceNames: recognizedFaces.map(f => f.name)
        });

        // Send results back to client
        socket.emit('recognition_result', {
          frameId: frameId,
          faces: recognizedFaces,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error(`Frame processing error for client ${socket.id}:`, {
          error: error.message,
          frameId: data?.frameId,
          stack: error.stack
        });

        socket.emit('recognition_error', {
          error: 'Frame processing failed: ' + error.message,
          frameId: data?.frameId,
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    });

    // Handle chat messages
    socket.on('chat_message', async (data) => {
      try {
        const { message, conversation_id } = data;

        if (!message || typeof message !== 'string') {
          socket.emit('chat_error', {
            error: 'Invalid message format'
          });
          return;
        }

        // Get face data for context
        const faces = await Face.find({ is_active: true })
          .select('-encoding')
          .sort({ registered_at: -1 });

        const contextData = {
          total_registered_faces: faces.length,
          faces: faces.map(face => ({
            name: face.name,
            registered_at: face.registered_at,
            confidence: face.metadata?.confidence || 0
          })),
          last_registered: faces.length > 0 ? faces[0] : null
        };

        // Send to RAG service
        const ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8002';

        const ragResponse = await axios.post(`${ragServiceUrl}/query`, {
          message: message.trim(),
          context_data: contextData,
          conversation_id: conversation_id || null
        }, {
          timeout: 30000
        });

        if (ragResponse.data.success) {
          socket.emit('chat_response', {
            message: message,
            response: ragResponse.data.response,
            conversation_id: ragResponse.data.conversation_id,
            timestamp: new Date().toISOString(),
            sources: ragResponse.data.sources || []
          });
        } else {
          socket.emit('chat_error', {
            error: ragResponse.data.error || 'Chat processing failed'
          });
        }

      } catch (error) {
        logger.error('Chat message error:', error);

        socket.emit('chat_error', {
          error: 'Chat service unavailable',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    });

    // Handle typing indicators
    socket.on('typing_start', () => {
      socket.broadcast.emit('user_typing', {
        userId: socket.id,
        isTyping: true
      });
    });

    socket.on('typing_stop', () => {
      socket.broadcast.emit('user_typing', {
        userId: socket.id,
        isTyping: false
      });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
      activeConnections.delete(socket.id);
    });

    // Handle connection errors
    socket.on('error', (error) => {
      logger.error(`Socket error for client ${socket.id}:`, error);
    });
  });

  // Periodic cleanup of stale connections
  setInterval(() => {
    const staleConnections = [];
    activeConnections.forEach((connection, socketId) => {
      if (!connection.socket.connected) {
        staleConnections.push(socketId);
      }
    });

    staleConnections.forEach(socketId => {
      activeConnections.delete(socketId);
    });

    if (staleConnections.length > 0) {
      logger.info(`Cleaned up ${staleConnections.length} stale connections`);
    }
  }, 60000); // Check every minute
};

module.exports = socketHandler;
