import React, { useState, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Paper,
  Chip,
  List,
  ListItem,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  PhotoCamera,
  Upload,
  Person,
  Delete,
  Refresh,
  CheckCircle,
} from '@mui/icons-material';

import { faceApi, utils } from '../utils/api';

const FaceRegistration = () => {
  const [name, setName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [registeredFaces, setRegisteredFaces] = useState([]);
  const [isLoadingFaces, setIsLoadingFaces] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [faceToDelete, setFaceToDelete] = useState(null);

  const fileInputRef = useRef(null);
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);

  // Load registered faces on component mount
  React.useEffect(() => {
    loadRegisteredFaces();
  }, []);

  const loadRegisteredFaces = async () => {
    setIsLoadingFaces(true);
    try {
      const response = await faceApi.getAll(1, 50);
      if (response.success && response.data) {
        setRegisteredFaces(response.data);
      }
    } catch (error) {
      console.error('Error loading faces:', error);
      setMessage({ type: 'error', text: 'Failed to load registered faces' });
    } finally {
      setIsLoadingFaces(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setMessage({ type: 'error', text: 'Please select a valid image file' });
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'File size must be less than 10MB' });
        return;
      }

      setSelectedFile(file);

      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setMessage(null);
    }
  };

  const handleWebcamCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });

      if (webcamRef.current) {
        webcamRef.current.srcObject = stream;
        webcamRef.current.play();
      }
    } catch (error) {
      console.error('Error accessing webcam:', error);
      setMessage({ type: 'error', text: 'Failed to access webcam' });
    }
  };

  const capturePhoto = () => {
    if (webcamRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = webcamRef.current;
      const ctx = canvas.getContext('2d');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      if (ctx) {
        ctx.drawImage(video, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'webcam-capture.jpg', { type: 'image/jpeg' });
            setSelectedFile(file);
            setPreviewUrl(canvas.toDataURL());

            // Stop webcam stream
            const stream = video.srcObject;
            stream?.getTracks().forEach(track => track.stop());
            video.srcObject = null;
          }
        }, 'image/jpeg', 0.8);
      }
    }
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      setMessage({ type: 'error', text: 'Please enter a name' });
      return;
    }

    if (!selectedFile) {
      setMessage({ type: 'error', text: 'Please select or capture an image' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      // Resize image if needed
      const processedFile = await utils.resizeImage(selectedFile, 800, 600);

      const response = await faceApi.register(processedFile, name.trim());

      if (response.success) {
        setMessage({
          type: 'success',
          text: `Face registered successfully for ${response.data.name}!`
        });

        // Reset form
        setName('');
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        // Reload faces list
        await loadRegisteredFaces();
      } else {
        setMessage({ type: 'error', text: response.message || 'Registration failed' });
      }
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Registration failed';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFace = async (face) => {
    setFaceToDelete(face);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!faceToDelete) return;

    try {
      const response = await faceApi.delete(faceToDelete._id);
      if (response.success) {
        setMessage({ type: 'success', text: `${faceToDelete.name} deleted successfully` });
        await loadRegisteredFaces();
      } else {
        setMessage({ type: 'error', text: 'Failed to delete face' });
      }
    } catch (error) {
      console.error('Delete error:', error);
      setMessage({ type: 'error', text: 'Failed to delete face' });
    } finally {
      setDeleteDialogOpen(false);
      setFaceToDelete(null);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Stop webcam if running
    if (webcamRef.current?.srcObject) {
      const stream = webcamRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
      webcamRef.current.srcObject = null;
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Face Registration
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Register new faces by uploading an image or capturing from webcam.
        Make sure the face is clearly visible and well-lit.
      </Typography>

      <Grid container spacing={3}>
        {/* Registration Form */}
        {/* @ts-ignore */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Register New Face
              </Typography>

              <TextField
                fullWidth
                label="Person's Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                margin="normal"
                disabled={isLoading}
                InputProps={{
                  startAdornment: <Person sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />

              <Box sx={{ mt: 2, mb: 2 }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                />

                <Grid container spacing={2}>
                  {/* @ts-ignore */}
                  <Grid item xs={6}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<Upload />}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                    >
                      Upload Image
                    </Button>
                  </Grid>
                  {/* @ts-ignore */}
                  <Grid item xs={6}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<PhotoCamera />}
                      onClick={handleWebcamCapture}
                      disabled={isLoading}
                    >
                      Use Webcam
                    </Button>
                  </Grid>
                </Grid>
              </Box>

              {/* Webcam Video */}
              <video
                ref={webcamRef}
                style={{
                  width: '100%',
                  maxHeight: '300px',
                  display: webcamRef.current?.srcObject ? 'block' : 'none',
                  borderRadius: '8px'
                }}
                autoPlay
                muted
              />

              {webcamRef.current?.srcObject && (
                <Box sx={{ mt: 1, textAlign: 'center' }}>
                  <Button
                    variant="contained"
                    onClick={capturePhoto}
                    startIcon={<PhotoCamera />}
                  >
                    Capture Photo
                  </Button>
                </Box>
              )}

              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {/* Image Preview */}
              {previewUrl && (
                <Paper sx={{ p: 2, mt: 2, textAlign: 'center' }}>
                  <img
                    src={previewUrl}
                    alt="Preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '300px',
                      borderRadius: '8px'
                    }}
                  />
                  <Box sx={{ mt: 1 }}>
                    <Chip
                      label={selectedFile ? utils.formatFileSize(selectedFile.size) : ''}
                      size="small"
                      color="primary"
                    />
                    <Button
                      size="small"
                      onClick={clearSelection}
                      sx={{ ml: 1 }}
                    >
                      Clear
                    </Button>
                  </Box>
                </Paper>
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

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleRegister}
                disabled={isLoading || !name.trim() || !selectedFile}
                sx={{ mt: 2 }}
                startIcon={isLoading ? <CircularProgress size={20} /> : <CheckCircle />}
              >
                {isLoading ? 'Registering...' : 'Register Face'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Registered Faces List */}
        {/* @ts-ignore */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Registered Faces ({registeredFaces.length})
                </Typography>
                <IconButton onClick={loadRegisteredFaces} disabled={isLoadingFaces}>
                  <Refresh />
                </IconButton>
              </Box>

              {isLoadingFaces ? (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <CircularProgress />
                </Box>
              ) : registeredFaces.length === 0 ? (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  No faces registered yet
                </Typography>
              ) : (
                <List>
                  {registeredFaces.map((face) => (
                    <ListItem key={face._id} divider>
                      <Box sx={{ flex: 1, pr: 6 }}>
                        <Typography variant="body1" component="div" sx={{ fontWeight: 500 }}>
                          {face.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                          Registered: {utils.formatDate(face.registered_at)}
                        </Typography>
                        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip
                            label={`${Math.round(face.metadata.confidence * 100)}% confidence`}
                            size="small"
                            color="primary"
                          />
                          <Chip
                            label={face.metadata.image_quality}
                            size="small"
                            color={
                              face.metadata.image_quality === 'high' ? 'success' :
                              face.metadata.image_quality === 'medium' ? 'warning' : 'error'
                            }
                          />
                        </Box>
                      </Box>
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleDeleteFace(face)}
                          color="error"
                        >
                          <Delete />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the face registration for "{faceToDelete?.name}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FaceRegistration;