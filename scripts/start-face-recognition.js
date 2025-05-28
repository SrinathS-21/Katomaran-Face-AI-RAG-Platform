#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

// Determine the platform and set appropriate commands
const isWindows = os.platform() === 'win32';
const pythonServicesDir = path.join(__dirname, '..', 'python-services');
const venvDir = path.join(pythonServicesDir, 'venv');

let activateCommand, pythonCommand;

if (isWindows) {
    activateCommand = path.join(venvDir, 'Scripts', 'activate.bat');
    pythonCommand = path.join(venvDir, 'Scripts', 'python.exe');
} else {
    activateCommand = path.join(venvDir, 'bin', 'activate');
    pythonCommand = path.join(venvDir, 'bin', 'python');
}

// Check if virtual environment exists
const fs = require('fs');
if (!fs.existsSync(pythonCommand)) {
    console.error('❌ Python virtual environment not found at:', venvDir);
    console.error('Please run: cd python-services && python -m venv venv && venv/Scripts/activate && pip install -r requirements.txt');
    process.exit(1);
}

console.log('🚀 Starting Face Recognition Service...');
console.log('📁 Working directory:', path.join(pythonServicesDir, 'face_recognition'));
console.log('🐍 Python executable:', pythonCommand);

// Start the face recognition service
const faceService = spawn(pythonCommand, ['app.py'], {
    cwd: path.join(pythonServicesDir, 'face_recognition'),
    stdio: 'inherit',
    env: { ...process.env }
});

faceService.on('error', (error) => {
    console.error('❌ Failed to start face recognition service:', error.message);
    process.exit(1);
});

faceService.on('close', (code) => {
    console.log(`🔴 Face recognition service exited with code ${code}`);
    process.exit(code);
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Stopping face recognition service...');
    faceService.kill('SIGINT');
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Stopping face recognition service...');
    faceService.kill('SIGTERM');
});
