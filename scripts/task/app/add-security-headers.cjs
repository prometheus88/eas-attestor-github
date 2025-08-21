#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', '..', '..', 'src', 'generated', 'server', 'expressServer.js');

try {
    let content = fs.readFileSync(serverPath, 'utf8');
    
    // Add security headers middleware after CORS
    const corsLine = '    this.app.use(cors());';
    const securityHeaders = `    this.app.use(cors());
    
    // Security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Content-Security-Policy', "default-src 'self' localhost:*");
      next();
    });`;
    
    if (content.includes('X-Frame-Options')) {
        console.log('✅ Security headers already present');
    } else if (content.includes(corsLine)) {
        content = content.replace(corsLine, securityHeaders);
        fs.writeFileSync(serverPath, content);
        console.log('✅ Added security headers to Express server');
    } else {
        console.log('❌ Could not find CORS line to add security headers');
        process.exit(1);
    }
} catch (error) {
    console.error('❌ Failed to add security headers:', error.message);
    process.exit(1);
}