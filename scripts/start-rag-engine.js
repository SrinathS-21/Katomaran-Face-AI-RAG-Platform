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

console.log('🚀 Starting RAG Engine Service...');
console.log('📁 Working directory:', path.join(pythonServicesDir, 'rag_engine'));
console.log('🐍 Python executable:', pythonCommand);

// Start the RAG engine service
const ragService = spawn(pythonCommand, ['app.py'], {
    cwd: path.join(pythonServicesDir, 'rag_engine'),
    stdio: 'inherit',
    env: { ...process.env }
});

ragService.on('error', (error) => {
    console.error('❌ Failed to start RAG engine service:', error.message);
    process.exit(1);
});

ragService.on('close', (code) => {
    console.log(`🔴 RAG engine service exited with code ${code}`);
    process.exit(code);
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Stopping RAG engine service...');
    ragService.kill('SIGINT');
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Stopping RAG engine service...');
    ragService.kill('SIGTERM');
});
