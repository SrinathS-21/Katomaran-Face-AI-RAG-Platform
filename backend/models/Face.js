const mongoose = require('mongoose');
const TimezoneUtils = require('../utils/timezone');

const faceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  encoding: {
    type: [Number],
    required: true,
    validate: {
      validator: function(arr) {
        return arr.length === 128; // MediaPipe face encoding dimension
      },
      message: 'Face encoding must have exactly 128 dimensions'
    }
  },
  registered_at: {
    type: Date,
    default: () => TimezoneUtils.getISTDate()
  },
  metadata: {
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    image_quality: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    face_landmarks: {
      type: Object,
      default: {}
    }
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster searches
faceSchema.index({ name: 1 });
faceSchema.index({ registered_at: -1 });
faceSchema.index({ is_active: 1 });

// Instance method to calculate similarity with another encoding
faceSchema.methods.calculateSimilarity = function(otherEncoding) {
  if (!otherEncoding || otherEncoding.length !== 128) {
    throw new Error('Invalid encoding for similarity calculation');
  }

  // Calculate cosine similarity
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < 128; i++) {
    dotProduct += this.encoding[i] * otherEncoding[i];
    normA += this.encoding[i] * this.encoding[i];
    normB += otherEncoding[i] * otherEncoding[i];
  }

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return similarity;
};

// Static method to find similar faces
faceSchema.statics.findSimilarFaces = async function(encoding, threshold = 0.6) {
  const faces = await this.find({ is_active: true });
  const similarFaces = [];

  for (const face of faces) {
    const similarity = face.calculateSimilarity(encoding);
    if (similarity >= threshold) {
      similarFaces.push({
        face: face,
        similarity: similarity
      });
    }
  }

  // Sort by similarity (highest first)
  return similarFaces.sort((a, b) => b.similarity - a.similarity);
};

module.exports = mongoose.model('Face', faceSchema);
