// Type definitions for the Katomaran Face AI Platform
// Note: These are now JSDoc comments for documentation purposes

/**
 * @typedef {Object} Face
 * @property {string} _id
 * @property {string} name
 * @property {string} registered_at
 * @property {Object} metadata
 * @property {number} metadata.confidence
 * @property {'low'|'medium'|'high'} metadata.image_quality
 * @property {any} [metadata.face_landmarks]
 * @property {boolean} is_active
 */

/**
 * @typedef {Object} RecognizedFace
 * @property {string} name
 * @property {number} confidence
 * @property {Object} bounding_box
 * @property {number} bounding_box.x
 * @property {number} bounding_box.y
 * @property {number} bounding_box.width
 * @property {number} bounding_box.height
 * @property {string|null} face_id
 */

/**
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {string} message
 * @property {string} response
 * @property {string} timestamp
 * @property {boolean} isUser
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success
 * @property {any} [data]
 * @property {string} [error]
 * @property {string} [message]
 */

/**
 * @typedef {Object} RegistrationResponse
 * @property {boolean} success
 * @property {string} message
 * @property {Object} data
 * @property {string} data.id
 * @property {string} data.name
 * @property {string} data.registered_at
 * @property {number} data.confidence
 */

/**
 * @typedef {Object} RecognitionResponse
 * @property {boolean} success
 * @property {RecognizedFace[]} faces
 * @property {number} total_faces
 */

/**
 * @typedef {Object} ChatResponse
 * @property {boolean} success
 * @property {string} response
 * @property {string} conversation_id
 * @property {any[]} sources
 * @property {Object} metadata
 * @property {number} metadata.query_time
 * @property {string} metadata.model_used
 * @property {boolean} metadata.context_used
 */

/**
 * @typedef {Object} WebcamSettings
 * @property {number} width
 * @property {number} height
 * @property {'user'|'environment'} facingMode
 */

/**
 * @typedef {Object} SocketEvents
 * @property {Function} start_recognition
 * @property {Function} stop_recognition
 * @property {Function} process_frame
 * @property {Function} recognition_result
 * @property {Function} recognition_error
 * @property {Function} chat_message
 * @property {Function} chat_response
 * @property {Function} chat_error
 */

// Export empty object since we're using JSDoc for type definitions
export {};
