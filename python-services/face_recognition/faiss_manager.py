import faiss
import numpy as np
import pickle
import os
import logging
from typing import List, Tuple, Optional, Dict
import json

logger = logging.getLogger(__name__)

class FAISSManager:
    """
    FAISS-based face encoding manager for efficient similarity search.
    Provides fast nearest neighbor search for face recognition.
    """
    
    def __init__(self, index_path: str = "face_encodings.index", metadata_path: str = "face_metadata.json"):
        self.index_path = index_path
        self.metadata_path = metadata_path
        self.index = None
        self.metadata = {}  # Maps index position to face metadata
        self.dimension = 128  # Face encoding dimension (dlib default)
        self.threshold = 0.6  # Similarity threshold for face matching
        
        # Initialize or load existing index
        self._initialize_index()
    
    def _initialize_index(self):
        """Initialize FAISS index or load existing one."""
        try:
            if os.path.exists(self.index_path) and os.path.exists(self.metadata_path):
                # Load existing index
                self.index = faiss.read_index(self.index_path)
                with open(self.metadata_path, 'r') as f:
                    self.metadata = json.load(f)
                logger.info(f"Loaded FAISS index with {self.index.ntotal} face encodings")
            else:
                # Create new index
                self.index = faiss.IndexFlatL2(self.dimension)  # L2 distance for face encodings
                self.metadata = {}
                logger.info("Created new FAISS index")
        except Exception as e:
            logger.error(f"Error initializing FAISS index: {e}")
            # Fallback to new index
            self.index = faiss.IndexFlatL2(self.dimension)
            self.metadata = {}
    
    def add_face_encoding(self, encoding: np.ndarray, face_id: str, person_name: str, 
                         additional_metadata: Optional[Dict] = None) -> bool:
        """
        Add a face encoding to the FAISS index.
        
        Args:
            encoding: Face encoding vector (128-dimensional)
            face_id: Unique identifier for this face
            person_name: Name of the person
            additional_metadata: Additional metadata to store
            
        Returns:
            bool: True if successfully added
        """
        try:
            # Ensure encoding is the right shape
            if encoding.shape != (self.dimension,):
                encoding = encoding.reshape(self.dimension)
            
            # Normalize encoding for better similarity search
            encoding = encoding / np.linalg.norm(encoding)
            
            # Add to FAISS index
            encoding_2d = encoding.reshape(1, -1).astype(np.float32)
            self.index.add(encoding_2d)
            
            # Store metadata
            index_position = self.index.ntotal - 1
            metadata = {
                'face_id': face_id,
                'person_name': person_name,
                'index_position': index_position
            }
            if additional_metadata:
                metadata.update(additional_metadata)
            
            self.metadata[str(index_position)] = metadata
            
            # Save to disk
            self._save_index()
            
            logger.info(f"Added face encoding for {person_name} (ID: {face_id})")
            return True
            
        except Exception as e:
            logger.error(f"Error adding face encoding: {e}")
            return False
    
    def search_similar_faces(self, query_encoding: np.ndarray, k: int = 5) -> List[Dict]:
        """
        Search for similar faces using FAISS.
        
        Args:
            query_encoding: Query face encoding
            k: Number of similar faces to return
            
        Returns:
            List of dictionaries containing match information
        """
        try:
            if self.index.ntotal == 0:
                logger.warning("No face encodings in index")
                return []
            
            # Ensure encoding is the right shape and normalized
            if query_encoding.shape != (self.dimension,):
                query_encoding = query_encoding.reshape(self.dimension)
            
            query_encoding = query_encoding / np.linalg.norm(query_encoding)
            query_2d = query_encoding.reshape(1, -1).astype(np.float32)
            
            # Search using FAISS
            distances, indices = self.index.search(query_2d, min(k, self.index.ntotal))
            
            results = []
            for i, (distance, index) in enumerate(zip(distances[0], indices[0])):
                if index == -1:  # FAISS returns -1 for invalid indices
                    continue
                
                # Convert L2 distance to similarity score (0-1, higher is more similar)
                similarity = max(0, 1 - distance)
                
                # Check if similarity meets threshold
                if similarity >= (1 - self.threshold):
                    metadata = self.metadata.get(str(index), {})
                    result = {
                        'face_id': metadata.get('face_id', 'unknown'),
                        'person_name': metadata.get('person_name', 'unknown'),
                        'similarity': float(similarity),
                        'distance': float(distance),
                        'index_position': int(index),
                        'rank': i + 1
                    }
                    results.append(result)
            
            logger.info(f"Found {len(results)} similar faces above threshold {1 - self.threshold}")
            return results
            
        except Exception as e:
            logger.error(f"Error searching similar faces: {e}")
            return []
    
    def get_best_match(self, query_encoding: np.ndarray) -> Optional[Dict]:
        """
        Get the best matching face for a query encoding.
        
        Args:
            query_encoding: Query face encoding
            
        Returns:
            Dictionary with best match information or None
        """
        results = self.search_similar_faces(query_encoding, k=1)
        return results[0] if results else None
    
    def _save_index(self):
        """Save FAISS index and metadata to disk."""
        try:
            faiss.write_index(self.index, self.index_path)
            with open(self.metadata_path, 'w') as f:
                json.dump(self.metadata, f, indent=2)
            logger.debug("Saved FAISS index and metadata to disk")
        except Exception as e:
            logger.error(f"Error saving FAISS index: {e}")
    
    def get_stats(self) -> Dict:
        """Get statistics about the FAISS index."""
        return {
            'total_faces': self.index.ntotal if self.index else 0,
            'dimension': self.dimension,
            'threshold': self.threshold,
            'index_type': type(self.index).__name__ if self.index else 'None'
        }
    
    def clear_index(self):
        """Clear all face encodings from the index."""
        try:
            self.index = faiss.IndexFlatL2(self.dimension)
            self.metadata = {}
            self._save_index()
            logger.info("Cleared FAISS index")
        except Exception as e:
            logger.error(f"Error clearing FAISS index: {e}")

# Global FAISS manager instance
faiss_manager = FAISSManager()
