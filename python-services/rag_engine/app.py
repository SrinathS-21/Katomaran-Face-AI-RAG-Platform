from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uvicorn
import logging
import os
from dotenv import load_dotenv

from rag_processor import RAGProcessor

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Katomaran RAG Service",
    description="Retrieval-Augmented Generation service for face recognition data queries",
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

# Pydantic models for request/response
class QueryRequest(BaseModel):
    message: str
    context_data: Dict[str, Any]
    conversation_id: Optional[str] = None

class QueryResponse(BaseModel):
    success: bool
    response: Optional[str] = None
    conversation_id: Optional[str] = None
    sources: Optional[list] = None
    query_time: Optional[float] = None
    model_used: Optional[str] = None
    context_used: Optional[bool] = None
    error: Optional[str] = None

# Initialize RAG processor
rag_processor = None

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    global rag_processor

    logger.info("RAG Service starting up...")

    # Get Google API key
    google_api_key = os.getenv("GOOGLE_API_KEY")

    if not google_api_key or google_api_key == "your_gemini_api_key_here":
        logger.error("GOOGLE_API_KEY not found or not configured in environment variables")
        raise RuntimeError("GOOGLE_API_KEY is required")

    try:
        # Initialize with Gemini
        rag_processor = RAGProcessor(google_api_key=google_api_key)
        logger.info("RAG Processor initialized with Google Gemini")

        logger.info("RAG Processor initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize RAG Processor: {str(e)}")
        raise RuntimeError(f"RAG Processor initialization failed: {str(e)}")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("RAG Service shutting down...")

@app.get("/")
async def root():
    """Root endpoint for health check."""
    return {
        "service": "Katomaran RAG Service",
        "status": "running",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    global rag_processor

    google_api_key = os.getenv("GOOGLE_API_KEY")

    health_data = {
        "status": "healthy",
        "service": "rag_engine",
        "processor_initialized": rag_processor is not None,
        "google_configured": bool(google_api_key) and google_api_key != "your_gemini_api_key_here",
        "model_in_use": rag_processor.model_name if rag_processor else None
    }

    # Add processor health check if available
    if rag_processor:
        try:
            processor_health = rag_processor.health_check()
            health_data.update(processor_health)
        except Exception as e:
            health_data["processor_error"] = str(e)

    return health_data

@app.post("/query", response_model=QueryResponse)
async def process_query(request: QueryRequest):
    """
    Process a natural language query about face recognition data.

    Args:
        request: Query request containing message, context data, and optional conversation ID

    Returns:
        Query response with answer and metadata
    """
    global rag_processor

    try:
        if rag_processor is None:
            raise HTTPException(status_code=503, detail="RAG processor not initialized")

        # Validate request
        if not request.message or not request.message.strip():
            raise HTTPException(status_code=400, detail="Message is required and cannot be empty")

        if not request.context_data:
            raise HTTPException(status_code=400, detail="Context data is required")

        # Process query
        result = rag_processor.query(
            question=request.message.strip(),
            face_data=request.context_data,
            conversation_id=request.conversation_id
        )

        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error', 'Query processing failed'))

        logger.info(f"Query processed successfully: '{request.message[:50]}...'")

        return QueryResponse(
            success=True,
            response=result['response'],
            conversation_id=result['conversation_id'],
            timestamp=result.get('timestamp'),
            query_timestamp=result.get('query_timestamp'),
            response_timestamp=result.get('response_timestamp'),
            sources=result.get('sources', []),
            query_time=result.get('query_time', 0),
            model_used=result.get('model_used', 'unknown'),
            context_used=result.get('context_used', False),
            timezone=result.get('timezone', 'Asia/Kolkata'),
            timezone_offset=result.get('timezone_offset', '+05:30')
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing query: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during query processing")

@app.get("/conversations/{conversation_id}")
async def get_conversation_history(conversation_id: str):
    """
    Get conversation history for a specific conversation ID.

    Args:
        conversation_id: Unique conversation identifier

    Returns:
        Conversation history
    """
    global rag_processor

    try:
        if rag_processor is None:
            raise HTTPException(status_code=503, detail="RAG processor not initialized")

        if not conversation_id or not conversation_id.strip():
            raise HTTPException(status_code=400, detail="Conversation ID is required")

        conversation = rag_processor.get_conversation_history(conversation_id.strip())

        return {
            "success": True,
            "conversation_id": conversation_id,
            "conversation": conversation,
            "total_exchanges": len(conversation),
            "retrieved_at": TimezoneUtils.now_iso(),
            "timezone": "Asia/Kolkata",
            "timezone_offset": "+05:30"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching conversation history: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/stats")
async def get_service_stats():
    """Get RAG service statistics and information."""
    global rag_processor

    try:
        base_stats = {
            "service": "rag_engine",
            "status": "running",
            "capabilities": [
                "natural_language_queries",
                "conversation_context",
                "vector_search",
                "face_data_analysis"
            ],
            "models": {
                "llm": "gpt-3.5-turbo",
                "embeddings": "text-embedding-ada-002"
            },
            "features": [
                "retrieval_augmented_generation",
                "conversation_memory",
                "contextual_responses",
                "source_attribution"
            ]
        }

        if rag_processor is not None:
            processor_stats = rag_processor.get_stats()
            base_stats.update(processor_stats)

        return base_stats

    except Exception as e:
        logger.error(f"Error getting service stats: {str(e)}")
        return {
            "service": "rag_engine",
            "status": "error",
            "error": str(e)
        }

@app.post("/test")
async def test_query():
    """Test endpoint for basic functionality."""
    global rag_processor

    try:
        if rag_processor is None:
            raise HTTPException(status_code=503, detail="RAG processor not initialized")

        # Test with sample data
        test_data = {
            "total_registered_faces": 2,
            "faces": [
                {
                    "name": "John Doe",
                    "registered_at": "2025-01-01T10:00:00Z",
                    "confidence": 0.95,
                    "image_quality": "high"
                },
                {
                    "name": "Jane Smith",
                    "registered_at": "2025-01-02T14:30:00Z",
                    "confidence": 0.88,
                    "image_quality": "medium"
                }
            ],
            "last_registered": {
                "name": "Jane Smith",
                "registered_at": "2025-01-02T14:30:00Z"
            }
        }

        result = rag_processor.query(
            question="How many people are registered?",
            face_data=test_data
        )

        return {
            "success": True,
            "test_result": result,
            "message": "RAG service is working correctly"
        }

    except Exception as e:
        logger.error(f"Test query failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")

if __name__ == "__main__":
    # Get configuration from environment variables
    host = os.getenv("RAG_SERVICE_HOST", "0.0.0.0")
    port = int(os.getenv("RAG_SERVICE_PORT", "8002"))

    logger.info(f"Starting RAG Service on {host}:{port}")

    uvicorn.run(
        "app:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )
