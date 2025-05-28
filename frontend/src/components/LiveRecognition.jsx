import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  Switch,
  FormControlLabel,
  CircularProgress,
  Badge,
} from '@mui/material';
import {
  Videocam,
  VideocamOff,
  Face,
  Refresh,
  Circle,
} from '@mui/icons-material';

import socketManager from '../utils/socket';

const LiveRecognition = () => {
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [recognizedFaces, setRecognizedFaces] = useState([]);
  const [recentRecognitions, setRecentRecognitions] = useState([]);
  const [message, setMessage] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [frameCount, setFrameCount] = useState(0);
  const [processedFrames, setProcessedFrames] = useState(0);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [autoRecognition, setAutoRecognition] = useState(true);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const frameIntervalRef = useRef(null);
  const frameIdRef = useRef(0);

  // Initialize socket connection and event listeners
  useEffect(() => {
    // Set up socket event listeners
    socketManager.onRecognitionResult(handleRecognitionResult);
    socketManager.onRecognitionError(handleRecognitionError);
    socketManager.onRecognitionStatus(handleRecognitionStatus);

    // Check initial connection status
    setConnectionStatus(socketManager.isConnected() ? 'connected' : 'disconnected');

    // Listen for connection changes
    socketManager.on('connect', () => setConnectionStatus('connected'));
    socketManager.on('disconnect', () => setConnectionStatus('disconnected'));
    socketManager.on('reconnecting', () => setConnectionStatus('connecting'));

    return () => {
      // Cleanup
      stopRecognition();
      stopWebcam();
      socketManager.off('recognition_result', handleRecognitionResult);
      socketManager.off('recognition_error', handleRecognitionError);
      socketManager.off('recognition_status', handleRecognitionStatus);
    };
  }, []);

  const handleRecognitionResult = useCallback((data) => {
    setRecognizedFaces(data.faces);
    setProcessedFrames(prev => prev + 1);

    // Add to recent recognitions (keep last 10)
    setRecentRecognitions(prev => {
      const updated = [data, ...prev].slice(0, 10);
      return updated;
    });

    // Draw bounding boxes if enabled
    if (showBoundingBoxes && data.faces.length > 0) {
      drawBoundingBoxes(data.faces);
    }
  }, [showBoundingBoxes]);

  const handleRecognitionError = useCallback((data) => {
    console.error('Recognition error:', data.error);
    setMessage({ type: 'error', text: `Recognition error: ${data.error}` });
  }, []);

  const handleRecognitionStatus = useCallback((data) => {
    setMessage({ type: 'info', text: data.message });
  }, []);

  const startWebcam = async () => {
    try {
      setMessage({ type: 'info', text: 'Starting webcam...' });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;

        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play();
            setIsWebcamActive(true);
            setMessage({ type: 'success', text: 'Webcam started successfully' });

            // Set up canvas dimensions after a short delay to ensure video is ready
            setTimeout(() => {
              setupCanvas();
            }, 100);
          }
        };
      }
    } catch (error) {
      console.error('Error starting webcam:', error);
      setMessage({ type: 'error', text: 'Failed to start webcam. Please check permissions.' });
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsWebcamActive(false);
    setMessage({ type: 'info', text: 'Webcam stopped' });
  };

  const setupCanvas = () => {
    if (videoRef.current && canvasRef.current && overlayCanvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      overlayCanvas.width = canvas.width;
      overlayCanvas.height = canvas.height;
    }
  };

  const startRecognition = () => {
    if (!isWebcamActive) {
      setMessage({ type: 'error', text: 'Please start webcam first' });
      return;
    }

    if (!socketManager.isConnected()) {
      setMessage({ type: 'error', text: 'Not connected to server' });
      return;
    }

    // Set state and start recognition
    setIsRecognizing(true);
    setFrameCount(0);
    setProcessedFrames(0);
    socketManager.startRecognition();

    // Use setTimeout to ensure state update has propagated before starting interval
    setTimeout(() => {
      if (autoRecognition) {
        frameIntervalRef.current = setInterval(() => {
          // Create a closure that captures the current recognition state
          processFrameWithState();
        }, 1000); // Process every 1 second
      }
    }, 50); // Small delay to ensure state propagation

    setMessage({ type: 'success', text: 'Face recognition started' });
  };

  const stopRecognition = () => {
    setIsRecognizing(false);
    socketManager.stopRecognition();

    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    // Clear overlay canvas
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
    }

    setMessage({ type: 'info', text: 'Face recognition stopped' });
  };

  const processFrameWithState = () => {
    // This function doesn't check isRecognizing state to avoid timing issues
    if (!videoRef.current || !canvasRef.current || !frameIntervalRef.current) {
      return;
    }

    processFrameCore();
  };

  const processFrame = () => {
    if (!videoRef.current || !canvasRef.current || !isRecognizing) {
      return;
    }

    processFrameCore();
  };

  const processFrameCore = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      return;
    }

    // Ensure canvas has proper dimensions
    if (canvas.width === 0 || canvas.height === 0) {
      setupCanvas(); // Try to set up canvas again
      return;
    }

    // Draw current frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64 and send for processing
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    const frameId = `frame_${++frameIdRef.current}`;

    socketManager.processFrame(imageData, frameId);
    setFrameCount(prev => prev + 1);
  };

  const drawBoundingBoxes = (faces) => {
    if (!overlayCanvasRef.current) return;

    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw bounding boxes for each face
    faces.forEach((face, index) => {
      const { x, y, width, height } = face.bounding_box;

      // Scale coordinates to canvas size
      const scaleX = canvas.width / (videoRef.current?.videoWidth || 640);
      const scaleY = canvas.height / (videoRef.current?.videoHeight || 480);

      const scaledX = x * scaleX;
      const scaledY = y * scaleY;
      const scaledWidth = width * scaleX;
      const scaledHeight = height * scaleY;

      // Choose color based on recognition status
      const color = face.name === 'Unknown' ? '#ff4444' : '#44ff44';

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

      // Draw label background
      const label = `${face.name} (${Math.round(face.confidence * 100)}%)`;
      ctx.font = '16px Arial';
      const textMetrics = ctx.measureText(label);
      const textWidth = textMetrics.width;
      const textHeight = 20;

      ctx.fillStyle = color;
      ctx.fillRect(scaledX, scaledY - textHeight - 5, textWidth + 10, textHeight + 5);

      // Draw label text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, scaledX + 5, scaledY - 8);
    });
  };

  const manualCapture = () => {
    if (isRecognizing) {
      processFrame();
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'success';
      case 'connecting': return 'warning';
      case 'disconnected': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Live Face Recognition
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Start your webcam and enable real-time face recognition.
        Recognized faces will be highlighted with bounding boxes.
      </Typography>

      <Grid container spacing={3}>
        {/* Video Feed */}
        {/* @ts-ignore */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Live Video Feed
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    icon={<Circle />}
                    label={connectionStatus}
                    color={getConnectionStatusColor()}
                    size="small"
                  />
                  <Badge badgeContent={recognizedFaces.length} color="primary">
                    <Face />
                  </Badge>
                </Box>
              </Box>

              <Box sx={{ position: 'relative', textAlign: 'center' }}>
                <video
                  ref={videoRef}
                  style={{
                    width: '100%',
                    maxWidth: '640px',
                    height: 'auto',
                    borderRadius: '8px',
                    backgroundColor: '#000'
                  }}
                  autoPlay
                  muted
                  playsInline
                />

                {/* Overlay canvas for bounding boxes */}
                <canvas
                  ref={overlayCanvasRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '100%',
                    maxWidth: '640px',
                    height: 'auto',
                    pointerEvents: 'none'
                  }}
                />

                {/* Hidden canvas for frame processing */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </Box>

              <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button
                  variant={isWebcamActive ? "outlined" : "contained"}
                  startIcon={isWebcamActive ? <VideocamOff /> : <Videocam />}
                  onClick={isWebcamActive ? stopWebcam : startWebcam}
                  color={isWebcamActive ? "error" : "primary"}
                >
                  {isWebcamActive ? 'Stop Webcam' : 'Start Webcam'}
                </Button>

                <Button
                  variant={isRecognizing ? "outlined" : "contained"}
                  startIcon={isRecognizing ? <CircularProgress size={20} /> : <Face />}
                  onClick={isRecognizing ? stopRecognition : startRecognition}
                  disabled={!isWebcamActive || connectionStatus !== 'connected'}
                  color={isRecognizing ? "error" : "success"}
                >
                  {isRecognizing ? 'Stop Recognition' : 'Start Recognition'}
                </Button>

                {isRecognizing && !autoRecognition && (
                  <Button
                    variant="outlined"
                    onClick={manualCapture}
                    startIcon={<Refresh />}
                  >
                    Capture Frame
                  </Button>
                )}
              </Box>

              <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showBoundingBoxes}
                      onChange={(e) => setShowBoundingBoxes(e.target.checked)}
                    />
                  }
                  label="Show Bounding Boxes"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoRecognition}
                      onChange={(e) => setAutoRecognition(e.target.checked)}
                    />
                  }
                  label="Auto Recognition"
                />
              </Box>

              {isRecognizing && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Frames: {frameCount} | Processed: {processedFrames} |
                    Rate: {frameCount > 0 ? Math.round((processedFrames / frameCount) * 100) : 0}%
                  </Typography>
                </Box>
              )}

              {message && (
                <Alert
                  severity={message.type}
                  sx={{ mt: 2 }}
                  onClose={() => setMessage(null)}
                >
                  {message.text}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recognition Results */}
        {/* @ts-ignore */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Recognition
              </Typography>

              {recognizedFaces.length === 0 ? (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  {isRecognizing ? 'No faces detected' : 'Start recognition to see results'}
                </Typography>
              ) : (
                <List dense>
                  {recognizedFaces.map((face, index) => (
                    <ListItem key={index} divider>
                      <Box sx={{ flex: 1, pr: 2 }}>
                        <Typography variant="body1" component="div">
                          {face.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" component="div">
                          {`${Math.round(face.confidence * 100)}% confidence`}
                        </Typography>
                      </Box>
                      <Chip
                        label={face.name === 'Unknown' ? 'Unknown' : 'Recognized'}
                        color={face.name === 'Unknown' ? 'error' : 'success'}
                        size="small"
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>

              {recentRecognitions.length === 0 ? (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  No recent activity
                </Typography>
              ) : (
                <List dense>
                  {recentRecognitions.slice(0, 5).map((result, index) => (
                    <ListItem key={result.frameId} divider>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body1" component="div">
                          {`${result.faces.length} face(s) detected`}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                          {new Date(result.timestamp).toLocaleTimeString()}
                        </Typography>
                        <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {result.faces.map((face, faceIndex) => (
                            <Chip
                              key={faceIndex}
                              label={face.name}
                              size="small"
                              color={face.name === 'Unknown' ? 'default' : 'primary'}
                            />
                          ))}
                        </Box>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default LiveRecognition;
