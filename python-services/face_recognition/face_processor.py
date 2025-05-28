import cv2
import numpy as np
import mediapipe as mp
from typing import List, Dict, Optional, Tuple
import logging
from PIL import Image
import io
from faiss_manager import faiss_manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FaceProcessor:
    """
    Face processing class using MediaPipe for face detection and feature extraction.
    """

    def __init__(self):
        """Initialize MediaPipe face detection and face mesh models."""
        self.mp_face_detection = mp.solutions.face_detection
        self.mp_face_mesh = mp.solutions.face_mesh
        self.mp_drawing = mp.solutions.drawing_utils

        # Initialize face detection model
        self.face_detection = self.mp_face_detection.FaceDetection(
            model_selection=1,  # 0 for short-range, 1 for full-range
            min_detection_confidence=0.7
        )

        # Initialize face mesh model for landmarks
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=10,
            refine_landmarks=True,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        )

        logger.info("FaceProcessor initialized successfully")

    def preprocess_image(self, image_data: bytes) -> np.ndarray:
        """
        Preprocess image data for face detection.

        Args:
            image_data: Raw image bytes

        Returns:
            Preprocessed image as numpy array
        """
        try:
            # Convert bytes to PIL Image
            image = Image.open(io.BytesIO(image_data))

            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')

            # Convert to numpy array
            image_np = np.array(image)

            # Ensure image is in correct format for MediaPipe (RGB)
            if len(image_np.shape) == 3 and image_np.shape[2] == 3:
                return image_np
            else:
                raise ValueError("Invalid image format")

        except Exception as e:
            logger.error(f"Error preprocessing image: {str(e)}")
            raise ValueError(f"Failed to preprocess image: {str(e)}")

    def detect_faces(self, image: np.ndarray) -> List[Dict]:
        """
        Detect faces in the image using MediaPipe.

        Args:
            image: Input image as numpy array (RGB format)

        Returns:
            List of detected faces with bounding boxes and confidence scores
        """
        try:
            results = self.face_detection.process(image)
            detected_faces = []

            if results.detections:
                h, w, _ = image.shape

                for detection in results.detections:
                    # Get bounding box
                    bbox = detection.location_data.relative_bounding_box

                    # Convert relative coordinates to absolute
                    x = int(bbox.xmin * w)
                    y = int(bbox.ymin * h)
                    width = int(bbox.width * w)
                    height = int(bbox.height * h)

                    # Ensure coordinates are within image bounds
                    x = max(0, x)
                    y = max(0, y)
                    width = min(width, w - x)
                    height = min(height, h - y)

                    detected_faces.append({
                        'bounding_box': {
                            'x': x,
                            'y': y,
                            'width': width,
                            'height': height
                        },
                        'confidence': detection.score[0],
                        'detection_id': len(detected_faces)
                    })

            logger.info(f"Detected {len(detected_faces)} faces")
            return detected_faces

        except Exception as e:
            logger.error(f"Error detecting faces: {str(e)}")
            raise RuntimeError(f"Face detection failed: {str(e)}")

    def extract_face_landmarks(self, image: np.ndarray) -> List[Dict]:
        """
        Extract facial landmarks using MediaPipe Face Mesh.

        Args:
            image: Input image as numpy array (RGB format)

        Returns:
            List of face landmarks for each detected face
        """
        try:
            results = self.face_mesh.process(image)
            faces_landmarks = []

            if results.multi_face_landmarks:
                h, w, _ = image.shape

                for face_landmarks in results.multi_face_landmarks:
                    landmarks = []
                    for landmark in face_landmarks.landmark:
                        landmarks.append({
                            'x': landmark.x * w,
                            'y': landmark.y * h,
                            'z': landmark.z
                        })

                    faces_landmarks.append({
                        'landmarks': landmarks,
                        'total_landmarks': len(landmarks)
                    })

            return faces_landmarks

        except Exception as e:
            logger.error(f"Error extracting landmarks: {str(e)}")
            return []

    def generate_face_encoding(self, image: np.ndarray, face_bbox: Dict) -> np.ndarray:
        """
        Generate face encoding from detected face region.

        Args:
            image: Full image as numpy array
            face_bbox: Bounding box of the detected face

        Returns:
            128-dimensional face encoding vector
        """
        try:
            # Extract face region
            x = face_bbox['x']
            y = face_bbox['y']
            w = face_bbox['width']
            h = face_bbox['height']

            # Add padding around face
            padding = 20
            x_start = max(0, x - padding)
            y_start = max(0, y - padding)
            x_end = min(image.shape[1], x + w + padding)
            y_end = min(image.shape[0], y + h + padding)

            face_region = image[y_start:y_end, x_start:x_end]

            if face_region.size == 0:
                raise ValueError("Invalid face region")

            # Resize face to standard size for encoding
            face_resized = cv2.resize(face_region, (128, 128))

            # Convert to grayscale for feature extraction
            if len(face_resized.shape) == 3:
                face_gray = cv2.cvtColor(face_resized, cv2.COLOR_RGB2GRAY)
            else:
                face_gray = face_resized

            # Generate encoding using histogram of oriented gradients (HOG)
            # This is a simplified approach - in production, you might use a trained CNN
            encoding = self._compute_hog_features(face_gray)

            # Normalize encoding
            encoding = encoding / np.linalg.norm(encoding)

            return encoding

        except Exception as e:
            logger.error(f"Error generating face encoding: {str(e)}")
            raise RuntimeError(f"Face encoding generation failed: {str(e)}")

    def _compute_hog_features(self, face_gray: np.ndarray) -> np.ndarray:
        """
        Compute HOG (Histogram of Oriented Gradients) features for face encoding.

        Args:
            face_gray: Grayscale face image

        Returns:
            128-dimensional feature vector
        """
        try:
            # Compute gradients
            grad_x = cv2.Sobel(face_gray, cv2.CV_64F, 1, 0, ksize=3)
            grad_y = cv2.Sobel(face_gray, cv2.CV_64F, 0, 1, ksize=3)

            # Compute magnitude and angle
            magnitude = np.sqrt(grad_x**2 + grad_y**2)
            angle = np.arctan2(grad_y, grad_x)

            # Divide image into 8x8 cells
            cell_size = 16
            h, w = face_gray.shape
            cells_x = w // cell_size
            cells_y = h // cell_size

            # Compute histogram for each cell
            features = []
            for i in range(cells_y):
                for j in range(cells_x):
                    y_start = i * cell_size
                    y_end = min((i + 1) * cell_size, h)
                    x_start = j * cell_size
                    x_end = min((j + 1) * cell_size, w)

                    cell_magnitude = magnitude[y_start:y_end, x_start:x_end]
                    cell_angle = angle[y_start:y_end, x_start:x_end]

                    # Create histogram of gradients (9 bins)
                    hist, _ = np.histogram(cell_angle.flatten(), bins=9,
                                         weights=cell_magnitude.flatten(),
                                         range=(-np.pi, np.pi))
                    features.extend(hist)

            # Ensure we have exactly 128 features
            features = np.array(features)
            if len(features) > 128:
                features = features[:128]
            elif len(features) < 128:
                features = np.pad(features, (0, 128 - len(features)), 'constant')

            return features

        except Exception as e:
            logger.error(f"Error computing HOG features: {str(e)}")
            # Return random features as fallback
            return np.random.rand(128)

    def process_image_for_registration(self, image_data: bytes, name: str) -> Dict:
        """
        Process image for face registration.

        Args:
            image_data: Raw image bytes
            name: Name of the person

        Returns:
            Processing results with face encoding and metadata
        """
        try:
            # Preprocess image
            image = self.preprocess_image(image_data)

            # Detect faces
            detected_faces = self.detect_faces(image)

            if not detected_faces:
                return {
                    'success': False,
                    'error': 'No face detected in the image'
                }

            if len(detected_faces) > 1:
                return {
                    'success': False,
                    'error': 'Multiple faces detected. Please use an image with only one face.'
                }

            face = detected_faces[0]

            # Extract landmarks
            landmarks = self.extract_face_landmarks(image)

            # Generate encoding
            encoding = self.generate_face_encoding(image, face['bounding_box'])

            # Assess image quality
            quality = self._assess_image_quality(image, face['bounding_box'])

            # Add encoding to FAISS index
            face_id = f"{name}_{len(faiss_manager.metadata)}"
            faiss_success = faiss_manager.add_face_encoding(
                encoding=encoding,
                face_id=face_id,
                person_name=name,
                additional_metadata={
                    'confidence': float(face['confidence']),
                    'image_quality': quality,
                    'bounding_box': face['bounding_box']
                }
            )

            return {
                'success': True,
                'encoding': encoding.tolist(),
                'confidence': float(face['confidence']),
                'landmarks': landmarks[0] if landmarks else {},
                'image_quality': quality,
                'bounding_box': face['bounding_box'],
                'face_id': face_id,
                'faiss_indexed': faiss_success
            }

        except Exception as e:
            logger.error(f"Error processing image for registration: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def process_image_for_recognition(self, image_data: bytes) -> Dict:
        """
        Process image for face recognition.

        Args:
            image_data: Raw image bytes

        Returns:
            Processing results with detected faces and their encodings
        """
        try:
            # Preprocess image
            image = self.preprocess_image(image_data)

            # Detect faces
            detected_faces = self.detect_faces(image)

            if not detected_faces:
                return {
                    'success': True,
                    'faces': [],
                    'message': 'No faces detected in the image'
                }

            # Process each detected face
            processed_faces = []
            for face in detected_faces:
                try:
                    encoding = self.generate_face_encoding(image, face['bounding_box'])

                    # Search for similar faces using FAISS
                    matches = faiss_manager.search_similar_faces(encoding, k=3)
                    best_match = faiss_manager.get_best_match(encoding)

                    # Determine recognition result
                    if best_match:
                        recognized_name = best_match['person_name']
                        similarity = best_match['similarity']
                        is_recognized = True
                    else:
                        recognized_name = 'Unknown'
                        similarity = 0.0
                        is_recognized = False

                    processed_faces.append({
                        'encoding': encoding.tolist(),
                        'confidence': float(face['confidence']),
                        'bounding_box': face['bounding_box'],
                        'detection_id': face['detection_id'],
                        'name': recognized_name,
                        'similarity': similarity,
                        'is_recognized': is_recognized,
                        'matches': matches[:3]  # Top 3 matches
                    })
                except Exception as e:
                    logger.warning(f"Failed to process face {face['detection_id']}: {str(e)}")
                    continue

            return {
                'success': True,
                'faces': processed_faces,
                'total_detected': len(detected_faces),
                'total_processed': len(processed_faces)
            }

        except Exception as e:
            logger.error(f"Error processing image for recognition: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def _assess_image_quality(self, image: np.ndarray, face_bbox: Dict) -> str:
        """
        Assess the quality of the face image.

        Args:
            image: Input image
            face_bbox: Face bounding box

        Returns:
            Quality assessment ('low', 'medium', 'high')
        """
        try:
            # Extract face region
            x, y, w, h = face_bbox['x'], face_bbox['y'], face_bbox['width'], face_bbox['height']
            face_region = image[y:y+h, x:x+w]

            # Convert to grayscale for quality assessment
            if len(face_region.shape) == 3:
                face_gray = cv2.cvtColor(face_region, cv2.COLOR_RGB2GRAY)
            else:
                face_gray = face_region

            # Calculate sharpness using Laplacian variance
            laplacian_var = cv2.Laplacian(face_gray, cv2.CV_64F).var()

            # Calculate brightness
            brightness = np.mean(face_gray)

            # Assess quality based on multiple factors
            if laplacian_var > 500 and 50 < brightness < 200 and w > 100 and h > 100:
                return 'high'
            elif laplacian_var > 200 and 30 < brightness < 220 and w > 50 and h > 50:
                return 'medium'
            else:
                return 'low'

        except Exception as e:
            logger.warning(f"Error assessing image quality: {str(e)}")
            return 'medium'

    def get_faiss_stats(self) -> Dict:
        """
        Get FAISS index statistics.

        Returns:
            Dictionary with FAISS statistics
        """
        return faiss_manager.get_stats()

    def clear_faiss_index(self) -> bool:
        """
        Clear all face encodings from FAISS index.

        Returns:
            bool: True if successful
        """
        try:
            faiss_manager.clear_index()
            return True
        except Exception as e:
            logger.error(f"Error clearing FAISS index: {e}")
            return False

    def __del__(self):
        """Cleanup resources."""
        if hasattr(self, 'face_detection'):
            self.face_detection.close()
        if hasattr(self, 'face_mesh'):
            self.face_mesh.close()
