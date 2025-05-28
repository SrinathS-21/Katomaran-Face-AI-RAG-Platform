import { io } from 'socket.io-client';

class SocketManager {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.connect();
  }

  connect() {
    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
    
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    });

    this.setupEventListeners();
  }

  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      this.reconnectAttempts = 0;
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error);
    });
  }

  // Face Recognition Events
  startRecognition() {
    if (this.socket?.connected) {
      this.socket.emit('start_recognition');
    }
  }

  stopRecognition() {
    if (this.socket?.connected) {
      this.socket.emit('stop_recognition');
    }
  }

  processFrame(imageData, frameId) {
    if (this.socket?.connected) {
      this.socket.emit('process_frame', { imageData, frameId });
    }
  }

  onRecognitionResult(callback) {
    if (this.socket) {
      this.socket.on('recognition_result', callback);
    }
  }

  onRecognitionError(callback) {
    if (this.socket) {
      this.socket.on('recognition_error', callback);
    }
  }

  onRecognitionStatus(callback) {
    if (this.socket) {
      this.socket.on('recognition_status', callback);
    }
  }

  // Chat Events
  sendChatMessage(message, conversationId) {
    if (this.socket?.connected) {
      this.socket.emit('chat_message', { message, conversation_id: conversationId });
    }
  }

  onChatResponse(callback) {
    if (this.socket) {
      this.socket.on('chat_response', callback);
    }
  }

  onChatError(callback) {
    if (this.socket) {
      this.socket.on('chat_error', callback);
    }
  }

  // Typing indicators
  startTyping() {
    if (this.socket?.connected) {
      this.socket.emit('typing_start');
    }
  }

  stopTyping() {
    if (this.socket?.connected) {
      this.socket.emit('typing_stop');
    }
  }

  onUserTyping(callback) {
    if (this.socket) {
      this.socket.on('user_typing', callback);
    }
  }

  // Generic event listeners
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  // Connection status
  isConnected() {
    return this.socket?.connected || false;
  }

  // Disconnect
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Reconnect manually
  reconnect() {
    if (this.socket) {
      this.socket.connect();
    } else {
      this.connect();
    }
  }

  // Get socket ID
  getId() {
    return this.socket?.id;
  }
}

// Create singleton instance
const socketManager = new SocketManager();

export default socketManager;
