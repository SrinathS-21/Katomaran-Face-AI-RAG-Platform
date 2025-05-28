from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
from typing import Optional
import os
import sys
from dotenv import load_dotenv

# Add parent directory to path for utils import
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.timezone_utils import TimezoneUtils, now_ist_log
from face_processor import FaceProcessor

# Load environment variables
load_dotenv()

# Configure organized logging
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
log_format = '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'

# Create logs directory if it doesn't exist
os.makedirs("logs", exist_ok=True)

# Custom logging formatter for IST
class ISTFormatter(logging.Formatter):
    def formatTime(self, record, datefmt=None):
        return now_ist_log()

# Configure logging with file and console handlers using IST timestamps
logging.basicConfig(
    level=getattr(logging, log_level),
    format=log_format,
    handlers=[
        logging.FileHandler("logs/face_recognition_service.log"),
        logging.StreamHandler()
    ]
)

# Apply IST formatter to all handlers
for handler in logging.root.handlers:
    handler.setFormatter(ISTFormatter(log_format))

logger = logging.getLogger(__name__)

# Log startup information
logger.info("="*50)
logger.info("FACE RECOGNITION SERVICE STARTUP")
logger.info("="*50)

# Initialize FastAPI app
app = FastAPI(
    title="Katomaran Face Recognition Service",
    description="Face detection and recognition service using MediaPipe",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize face processor
face_processor = FaceProcessor()

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    logger.info("Face Recognition Service starting up...")
    logger.info("MediaPipe models loaded successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("Face Recognition Service shutting down...")

@app.get("/")
async def root():
    """Root endpoint for health check."""
    return {
        "service": "Katomaran Face Recognition Service",
        "status": "running",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "face_recognition",
        "timestamp": TimezoneUtils.now_iso(),
        "timezone": TimezoneUtils.get_timezone_info(),
        "models_loaded": True
    }

@app.post("/register")
async def register_face(
    image: UploadFile = File(...),
    name: str = Form(...)
):
    """
    Register a new face with the given name.

    Args:
        image: Image file containing the face to register
        name: Name of the person

    Returns:
        Registration result with face encoding and metadata
    """
    try:
        # Validate inputs
        if not name or not name.strip():
            raise HTTPException(status_code=400, detail="Name is required")

        if not image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")

        # Read image data
        image_data = await image.read()

        if len(image_data) == 0:
            raise HTTPException(status_code=400, detail="Empty image file")

        if len(image_data) > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(status_code=400, detail="Image file too large (max 10MB)")

        # Process image for registration
        result = face_processor.process_image_for_registration(image_data, name.strip())

        if not result['success']:
            raise HTTPException(status_code=400, detail=result['error'])

        logger.info(f"Face registered successfully for: {name}")

        return {
            "success": True,
            "message": f"Face registered successfully for {name}",
            "encoding": result['encoding'],
            "confidence": result['confidence'],
            "landmarks": result['landmarks'],
            "image_quality": result['image_quality'],
            "bounding_box": result['bounding_box']
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in face registration: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during face registration")

@app.post("/recognize")
async def recognize_faces(image: UploadFile = File(...)):
    """
    Recognize faces in the given image.

    Args:
        image: Image file containing faces to recognize

    Returns:
        Recognition results with detected faces and their encodings
    """
    try:
        # Validate input
        if not image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")

        # Read image data
        image_data = await image.read()

        if len(image_data) == 0:
            raise HTTPException(status_code=400, detail="Empty image file")

        if len(image_data) > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(status_code=400, detail="Image file too large (max 10MB)")

        # Process image for recognition
        result = face_processor.process_image_for_recognition(image_data)

        if not result['success']:
            raise HTTPException(status_code=400, detail=result['error'])

        logger.info(f"Face recognition completed. Detected {result.get('total_detected', 0)} faces")

        return {
            "success": True,
            "faces": result['faces'],
            "total_detected": result.get('total_detected', 0),
            "total_processed": result.get('total_processed', 0),
            "message": result.get('message', 'Face recognition completed')
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in face recognition: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during face recognition")

@app.post("/detect")
async def detect_faces(image: UploadFile = File(...)):
    """
    Detect faces in the given image without generating encodings.

    Args:
        image: Image file containing faces to detect

    Returns:
        Detection results with bounding boxes and confidence scores
    """
    try:
        # Validate input
        if not image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")

        # Read image data
        image_data = await image.read()

        if len(image_data) == 0:
            raise HTTPException(status_code=400, detail="Empty image file")

        # Preprocess and detect faces
        image_np = face_processor.preprocess_image(image_data)
        detected_faces = face_processor.detect_faces(image_np)

        logger.info(f"Face detection completed. Detected {len(detected_faces)} faces")

        return {
            "success": True,
            "faces": detected_faces,
            "total_detected": len(detected_faces)
        }

    except Exception as e:
        logger.error(f"Error in face detection: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during face detection")

@app.get("/stats")
async def get_service_stats():
    """Get service statistics and information."""
    faiss_stats = face_processor.get_faiss_stats()
    return {
        "service": "face_recognition",
        "status": "running",
        "models": {
            "face_detection": "MediaPipe Face Detection",
            "face_mesh": "MediaPipe Face Mesh"
        },
        "capabilities": [
            "face_detection",
            "face_registration",
            "face_recognition",
            "landmark_extraction",
            "faiss_similarity_search"
        ],
        "supported_formats": ["jpg", "jpeg", "png", "bmp"],
        "max_file_size": "10MB",
        "encoding_dimensions": 128,
        "faiss": faiss_stats
    }

@app.get("/faiss/stats")
async def get_faiss_stats():
    """Get FAISS index statistics."""
    try:
        stats = face_processor.get_faiss_stats()
        return {"success": True, "stats": stats}
    except Exception as e:
        logger.error(f"Error getting FAISS stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/faiss/clear")
async def clear_faiss_index():
    """Clear FAISS index."""
    try:
        success = face_processor.clear_faiss_index()
        if success:
            return {"success": True, "message": "FAISS index cleared successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to clear FAISS index")
    except Exception as e:
        logger.error(f"Error clearing FAISS index: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Get configuration from environment variables
    host = os.getenv("FACE_SERVICE_HOST", "0.0.0.0")
    port = int(os.getenv("FACE_SERVICE_PORT", "8001"))

    logger.info(f"Starting Face Recognition Service on {host}:{port}")

    uvicorn.run(
        "app:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )
