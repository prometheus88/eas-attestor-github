#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

const serverDir = path.join(__dirname, '..', '..', '..', 'src', 'generated', 'server');

try {
    console.log('📦 Installing ethers dependency...');
    execSync('npm install ethers', { 
        cwd: serverDir, 
        stdio: 'inherit' 
    });
    console.log('✅ Server dependencies installed');
} catch (error) {
    console.error('❌ Failed to install server dependencies:', error.message);
    process.exit(1);
}