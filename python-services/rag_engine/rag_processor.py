import os
import uuid
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
import json

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate

# Set up logging
logger = logging.getLogger(__name__)

class RAGProcessor:
    """
    RAG processor using Google Gemini AI for intelligent face recognition queries.
    """

    def __init__(self, google_api_key: str):
        """
        Initialize RAG processor with Google Gemini API key.

        Args:
            google_api_key: Google AI API key for Gemini
        """
        self.google_api_key = google_api_key
        self.conversation_history = {}

        # Initialize Gemini LLM
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            google_api_key=google_api_key,
            temperature=0.7,
            max_output_tokens=1000
        )
        self.model_name = "gemini-1.5-flash"

        logger.info(f"RAG Processor initialized with Gemini: {self.model_name}")

    def query(self, question: str, face_data: Dict, conversation_id: Optional[str] = None) -> Dict:
        """
        Process a natural language query about face data using Gemini.

        Args:
            question: User's question
            face_data: Current face registration data
            conversation_id: Optional conversation ID for context

        Returns:
            Query response with answer and metadata
        """
        try:
            start_time = datetime.now()

            # Generate conversation ID if not provided
            if conversation_id is None:
                conversation_id = str(uuid.uuid4())

            # Get conversation context
            conversation_context = self._get_conversation_context(conversation_id)

            # Create enhanced prompt with face data context
            enhanced_prompt = self._create_enhanced_prompt(question, face_data, conversation_context)

            # Query Gemini
            response = self.llm.invoke(enhanced_prompt)

            # Extract response text
            if hasattr(response, 'content'):
                answer = response.content
            else:
                answer = str(response)

            # Update conversation history
            self._update_conversation_history(conversation_id, question, answer)

            # Calculate query time
            query_time = (datetime.now() - start_time).total_seconds()

            logger.info(f"Query processed successfully in {query_time:.2f} seconds")

            return {
                'success': True,
                'response': answer,
                'conversation_id': conversation_id,
                'sources': [{'type': 'gemini_ai', 'content': 'Generated using Google Gemini AI', 'metadata': {'model': self.model_name}}],
                'query_time': query_time,
                'model_used': self.model_name,
                'context_used': len(conversation_context) > 0
            }

        except Exception as e:
            logger.error(f"Error processing query: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def _create_enhanced_prompt(self, question: str, face_data: Dict, conversation_context: List) -> str:
        """Create an enhanced prompt with face data context."""

        # Extract face data information
        faces = face_data.get('faces', [])
        total_faces = face_data.get('total_registered_faces', 0)

        # Build context about registered faces
        face_context = f"Currently, there are {total_faces} registered faces in the database.\n"

        if faces:
            face_context += "Registered faces:\n"
            for i, face in enumerate(faces[:10], 1):  # Limit to first 10 faces
                name = face.get('name', 'Unknown')
                reg_date = face.get('registered_at', 'Unknown date')
                confidence = face.get('confidence', 0)
                quality = face.get('image_quality', 'unknown')
                face_context += f"{i}. {name} - Registered: {reg_date}, Confidence: {confidence:.2f}, Quality: {quality}\n"

            if total_faces > 10:
                face_context += f"... and {total_faces - 10} more faces.\n"
        else:
            face_context += "No faces are currently registered.\n"

        # Add conversation context if available
        context_text = ""
        if conversation_context:
            context_text = "\nPrevious conversation:\n"
            for entry in conversation_context[-3:]:  # Last 3 exchanges
                context_text += f"Q: {entry['question']}\nA: {entry['answer']}\n"

        # Create the enhanced prompt
        prompt = f"""You are an AI assistant for a face recognition platform called Katomaran. You help users understand and manage their face recognition database.

Face Recognition Database Context:
{face_context}

{context_text}

User Question: {question}

Please provide a helpful, accurate, and conversational response about the face recognition database. If the question is about specific people, refer to the registered faces listed above. If asking about statistics, use the provided numbers. Be friendly and informative.

Response:"""

        return prompt

    def _get_conversation_context(self, conversation_id: str) -> List[Dict]:
        """Get conversation history for context."""
        return self.conversation_history.get(conversation_id, [])

    def _update_conversation_history(self, conversation_id: str, question: str, answer: str):
        """Update conversation history."""
        if conversation_id not in self.conversation_history:
            self.conversation_history[conversation_id] = []

        self.conversation_history[conversation_id].append({
            'question': question,
            'answer': answer,
            'timestamp': datetime.now().isoformat()
        })

        # Keep only last 10 exchanges per conversation
        if len(self.conversation_history[conversation_id]) > 10:
            self.conversation_history[conversation_id] = self.conversation_history[conversation_id][-10:]

    def get_conversation_history(self, conversation_id: str) -> List[Dict]:
        """Get full conversation history."""
        return self.conversation_history.get(conversation_id, [])

    def clear_conversation(self, conversation_id: str) -> bool:
        """Clear conversation history for a specific conversation."""
        if conversation_id in self.conversation_history:
            del self.conversation_history[conversation_id]
            return True
        return False

    def get_conversation_summary(self, conversation_id: str) -> Dict:
        """Get summary of conversation."""
        history = self.conversation_history.get(conversation_id, [])
        return {
            'conversation_id': conversation_id,
            'total_exchanges': len(history),
            'last_activity': history[-1]['timestamp'] if history else None,
            'model_used': self.model_name
        }

    def health_check(self) -> Dict:
        """Check if the processor is healthy."""
        try:
            # Simple test query
            test_response = self.llm.invoke("Hello, respond with 'OK' if you're working.")
            return {
                'status': 'healthy',
                'model': self.model_name,
                'test_response': str(test_response)[:50] + '...' if len(str(test_response)) > 50 else str(test_response)
            }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e)
            }
