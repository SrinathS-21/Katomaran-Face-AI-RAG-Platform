import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Paper,
  List,
  ListItem,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Send,
  Person,
  SmartToy,
  Clear,
  Refresh,
  ContentCopy,
} from '@mui/icons-material';

import socketManager from '../utils/socket';
import api, { chatApi } from '../utils/api';

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Sample questions for user guidance
  const sampleQuestions = [
    "How many people are registered?",
    "Who was the last person registered?",
    "When was John registered?",
    "Show me recent registrations",
    "What's the average confidence score?",
  ];

  useEffect(() => {
    // Set up socket event listeners
    socketManager.onChatResponse(handleChatResponse);
    socketManager.onChatError(handleChatError);

    // Check connection status
    setConnectionStatus(socketManager.isConnected() ? 'connected' : 'disconnected');

    socketManager.on('connect', () => setConnectionStatus('connected'));
    socketManager.on('disconnect', () => setConnectionStatus('disconnected'));

    // Add welcome message
    addWelcomeMessage();

    return () => {
      socketManager.off('chat_response', handleChatResponse);
      socketManager.off('chat_error', handleChatError);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addWelcomeMessage = () => {
    // Create IST timestamp for welcome message
    const istTimestamp = new Date().toLocaleString('sv-SE', {
      timeZone: 'Asia/Kolkata'
    }).replace(' ', 'T') + '+05:30';

    const welcomeMessage = {
      id: 'welcome',
      message: '',
      response: `Hello! I'm your AI assistant for the face recognition database. I can help you with:

• Getting information about registered faces
• Statistics and analytics
• Recent registrations
• Search and queries about specific people

Try asking me something like "How many people are registered?" or "Who was registered today?"`,
      timestamp: istTimestamp,
      isUser: false,
      timezone: 'Asia/Kolkata',
      timezone_offset: '+05:30',
      metadata: {
        query_time: 0,
        model_used: 'system',
        context_used: false
      }
    };

    setMessages([welcomeMessage]);
  };

  const handleChatResponse = useCallback((data) => {
    const responseMessage = {
      id: `response_${Date.now()}`,
      message: data.message,
      response: data.response,
      timestamp: data.timestamp || data.response_timestamp,
      query_timestamp: data.query_timestamp,
      response_timestamp: data.response_timestamp,
      isUser: false,
      sources: data.sources,
      timezone: data.timezone || 'Asia/Kolkata',
      timezone_offset: data.timezone_offset || '+05:30',
      metadata: {
        query_time: data.metadata?.query_time || 0,
        model_used: data.metadata?.model_used || 'gemini-1.5-flash',
        context_used: data.metadata?.context_used || true
      }
    };

    setMessages(prev => [...prev, responseMessage]);
    setIsLoading(false);
    setConversationId(data.conversation_id);
  }, []);

  const handleChatError = useCallback((data) => {
    setError(data.error);
    setIsLoading(false);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;

    // Create IST timestamp for user message
    const istTimestamp = new Date().toLocaleString('sv-SE', {
      timeZone: 'Asia/Kolkata'
    }).replace(' ', 'T') + '+05:30';

    const userMessage = {
      id: `user_${Date.now()}`,
      message: currentMessage,
      response: '',
      timestamp: istTimestamp,
      timezone: 'Asia/Kolkata',
      timezone_offset: '+05:30',
      isUser: true
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    const messageToSend = currentMessage.trim();
    setCurrentMessage('');

    try {
      if (socketManager.isConnected()) {
        // Use WebSocket for real-time communication
        socketManager.sendChatMessage(messageToSend, conversationId || undefined);
      } else {
        // Fallback to HTTP API
        const response = await chatApi.query(messageToSend, conversationId || undefined);

        if (response.success) {
          const responseMessage = {
            id: `response_${Date.now()}`,
            message: messageToSend,
            response: response.response,
            timestamp: response.timestamp || response.response_timestamp,
            query_timestamp: response.query_timestamp,
            response_timestamp: response.response_timestamp,
            isUser: false,
            sources: response.sources,
            timezone: response.timezone || 'Asia/Kolkata',
            timezone_offset: response.timezone_offset || '+05:30',
            metadata: response.metadata
          };

          setMessages(prev => [...prev, responseMessage]);
          setConversationId(response.conversation_id);
        } else {
          setError('Failed to get response from AI');
        }
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setError(error.response?.data?.error || error.message || 'Failed to send message');
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (event) => {
    setCurrentMessage(event.target.value);

    // Handle typing indicators
    if (socketManager.isConnected()) {
      socketManager.startTyping();

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        socketManager.stopTyping();
      }, 1000);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    addWelcomeMessage();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };



  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';

    try {
      // Use the IST formatting from api utils
      return api.formatDateIST(timestamp);
    } catch (error) {
      // Fallback to basic formatting
      return new Date(timestamp).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        AI Chat Assistant
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Ask questions about the face recognition database using natural language.
        The AI can provide statistics, search for specific people, and answer queries about registrations.
      </Typography>

      <Card sx={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
        {/* Chat Header */}
        <CardContent sx={{ borderBottom: 1, borderColor: 'divider', py: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SmartToy color="primary" />
              <Typography variant="h6">
                Face AI Assistant
              </Typography>
              <Chip
                label={connectionStatus}
                color={connectionStatus === 'connected' ? 'success' : 'error'}
                size="small"
              />
            </Box>
            <Box>
              <Tooltip title="Clear Chat">
                <IconButton onClick={clearChat}>
                  <Clear />
                </IconButton>
              </Tooltip>
              <Tooltip title="Refresh Connection">
                <IconButton onClick={() => socketManager.reconnect()}>
                  <Refresh />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </CardContent>

        {/* Messages Area */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <List>
            {messages.map((msg) => (
              <ListItem
                key={msg.id}
                sx={{
                  flexDirection: 'column',
                  alignItems: msg.isUser ? 'flex-end' : 'flex-start',
                  mb: 2
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    maxWidth: '80%',
                    flexDirection: msg.isUser ? 'row-reverse' : 'row'
                  }}
                >
                  <Avatar sx={{ bgcolor: msg.isUser ? 'primary.main' : 'secondary.main' }}>
                    {msg.isUser ? <Person /> : <SmartToy />}
                  </Avatar>

                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: msg.isUser ? 'primary.light' : 'grey.100',
                      color: msg.isUser ? 'primary.contrastText' : 'text.primary'
                    }}
                  >
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                      {msg.isUser ? msg.message : msg.response}
                    </Typography>

                    {!msg.isUser && msg.sources && msg.sources.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Sources: {msg.sources.length} references
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mt: 1
                    }}>
                      <Typography variant="caption" color="text.secondary">
                        {formatTimestamp(msg.timestamp)}
                      </Typography>

                      {!msg.isUser && (
                        <Box>
                          <Tooltip title="Copy Response">
                            <IconButton
                              size="small"
                              onClick={() => copyToClipboard(msg.response)}
                            >
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </Box>

                    {msg.metadata && (
                      <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        <Chip
                          label={`${msg.metadata.model_used} • ${msg.metadata.query_time}s`}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    )}
                  </Paper>
                </Box>
              </ListItem>
            ))}

            {isLoading && (
              <ListItem sx={{ justifyContent: 'flex-start' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ bgcolor: 'secondary.main' }}>
                    <SmartToy />
                  </Avatar>
                  <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={16} />
                      <Typography variant="body2" color="text.secondary">
                        AI is thinking...
                      </Typography>
                    </Box>
                  </Paper>
                </Box>
              </ListItem>
            )}
          </List>
          <div ref={messagesEndRef} />
        </Box>

        {/* Error Display */}
        {error && (
          <Alert
            severity="error"
            sx={{ mx: 2 }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {/* Sample Questions */}
        {messages.length <= 1 && (
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" gutterBottom>
              Try these sample questions:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {sampleQuestions.map((question, index) => (
                <Chip
                  key={index}
                  label={question}
                  variant="outlined"
                  clickable
                  onClick={() => {
                    setCurrentMessage(question);
                    sendMessage();
                  }}
                  size="small"
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Input Area */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              ref={inputRef}
              fullWidth
              multiline
              maxRows={3}
              placeholder="Ask me anything about the face recognition database..."
              value={currentMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              variant="outlined"
              size="small"
            />
            <Button
              variant="contained"
              onClick={sendMessage}
              disabled={!currentMessage.trim() || isLoading}
              sx={{ minWidth: 'auto', px: 2 }}
            >
              {isLoading ? <CircularProgress size={20} /> : <Send />}
            </Button>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Press Enter to send, Shift+Enter for new line
          </Typography>
        </Box>
      </Card>
    </Box>
  );
};

export default ChatInterface;