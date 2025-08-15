# 🚀 EAS Attestor Deployment Guide

This guide covers deploying the EAS Attestor frontend to GitHub Pages and the validator service to a cloud platform.

## 📋 **Architecture Overview**

```
┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────┐
│   GitHub Pages  │    │   Validator Service │    │   Smart        │
│   (Frontend)    │◄──►│   (Cloud Platform)  │    │   Contracts    │
│                 │    │                     │    │                 │
│ - Static HTML   │    │ - Node.js API       │    │ - EAS Registry │
│ - JS/CSS        │    │ - Docker container  │    │ - Attestations │
│ - Configurable  │    │ - Environment vars  │    │                 │
│   validator URL │    │ - CORS enabled      │    └─────────────────┘
└─────────────────┘    └─────────────────────┘
```

## 🌐 **Frontend Deployment (GitHub Pages)**

### **Automatic Deployment**
The frontend automatically deploys to GitHub Pages when you push to the `main` branch.

**What happens:**
1. GitHub Actions workflow triggers on push
2. Production build creates environment-specific config
3. Static assets are deployed to GitHub Pages
4. Frontend automatically detects environment and uses appropriate validator URL

### **Manual Deployment**
```bash
# Build for production
task app:build:dist:prod

# Or with custom validator URL
VALIDATOR_URL=https://your-validator.com task app:build:dist:prod:custom
```

### **Configuration**
The frontend automatically detects its environment:
- **Development**: `localhost` → uses `http://localhost:5001`
- **Production**: GitHub Pages → uses `VALIDATOR_URL` from environment

## 🔧 **Validator Service Deployment**

### **Option 1: Vercel (Recommended)**

1. **Fork the repository** to your GitHub account
2. **Connect to Vercel**:
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Deploy from the validator directory
   cd src/main/typescript/validator
   vercel
   ```

3. **Set environment variables** in Vercel dashboard:
   - `VALIDATOR_PRIVATE_KEY`: Your Ethereum private key
   - `NODE_ENV`: `production`

4. **Update CORS** if needed for your domain

### **Option 2: Netlify**

1. **Connect your repository** to Netlify
2. **Set build settings**:
   - Build command: `npm install && npm start`
   - Publish directory: `src/main/typescript/validator`
3. **Set environment variables** in Netlify dashboard

### **Option 3: Self-Hosted**

1. **Deploy to VPS/Cloud Instance**:
   ```bash
   # Build Docker image
   task validator:docker:build
   
   # Run container
   docker run -d \
     -p 5001:5001 \
     -e VALIDATOR_PRIVATE_KEY=your_key \
     -e NODE_ENV=production \
     eas-validator:latest
   ```

2. **Set up reverse proxy** (nginx/Apache) for SSL
3. **Configure firewall** to allow port 5001

## 🔒 **Environment Variables**

### **Frontend (GitHub Pages)**
Set these in GitHub repository secrets:

```bash
VALIDATOR_URL=https://your-validator-domain.com
```

### **Validator Service**
```bash
VALIDATOR_PRIVATE_KEY=your_ethereum_private_key
NODE_ENV=production
PORT=5001
```

## 🌍 **CORS Configuration**

The validator service is pre-configured to accept requests from:
- `localhost:3000` (development)
- `*.github.io` (GitHub Pages)
- `eas-attestor.com` (custom domain)

### **Adding Custom Domains**
Update `src/main/typescript/validator/index.js`:
```javascript
app.use(cors({
  origin: [
    // ... existing origins ...
    'https://yourdomain.com',
    'https://*.yourdomain.com'
  ]
}));
```

## 🧪 **Testing Deployment**

### **Local Testing**
```bash
# Start local development
task dev

# Test validator service
curl http://localhost:5001/health
```

### **Production Testing**
1. **Deploy validator service** to cloud platform
2. **Update GitHub secret** `VALIDATOR_URL`
3. **Push to main branch** to trigger deployment
4. **Test frontend** on GitHub Pages
5. **Verify CORS** works between services

## 📊 **Monitoring & Health Checks**

### **Validator Service Health**
```bash
# Health check endpoint
curl https://your-validator.com/health

# Expected response
{"status":"healthy","timestamp":"2024-01-01T00:00:00.000Z"}
```

### **Frontend Health**
- Check browser console for configuration logs
- Verify validator URL is correct
- Test attestation flow end-to-end

## 🚨 **Troubleshooting**

### **Common Issues**

**CORS Errors**
- Check validator service CORS configuration
- Verify frontend domain is in allowed origins
- Check browser console for specific error messages

**Validator Service Unavailable**
- Verify service is running and accessible
- Check environment variables are set correctly
- Test health endpoint directly

**Build Failures**
- Check GitHub Actions logs
- Verify all dependencies are installed
- Ensure build scripts have correct permissions

### **Debug Commands**
```bash
# Check build output
ls -la build/html/dist/

# Verify configuration
cat build/html/dist/config.js

# Test local build
task app:build:dist:dev
```

## 🔄 **Updating Deployment**

### **Frontend Updates**
- Push changes to `main` branch
- GitHub Actions automatically rebuilds and deploys
- No manual intervention required

### **Validator Service Updates**
- Update code in your fork
- Redeploy to your cloud platform
- Update `VALIDATOR_URL` if domain changes

## 📚 **Additional Resources**

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Vercel Deployment Guide](https://vercel.com/docs)
- [Netlify Deployment Guide](https://docs.netlify.com)
- [CORS Configuration](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

## 🆘 **Getting Help**

If you encounter issues:
1. Check the troubleshooting section above
2. Review GitHub Actions logs
3. Verify environment variables are set correctly
4. Test components individually
5. Open an issue in the repository

---

**Happy Deploying! 🚀** 