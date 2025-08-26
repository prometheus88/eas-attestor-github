# Favicon Configuration Guide

This document outlines the favicon files needed for modern browser support and their required dimensions.

## Required Favicon Files

### 1. Basic Favicon (16x16, 32x32)
- **File**: `favicon.ico`
- **Dimensions**: 16x16, 32x32 (multi-size ICO file)
- **Usage**: Traditional favicon support for older browsers

### 2. PNG Favicons
- **File**: `favicon-16x16.png`
- **Dimensions**: 16x16 pixels
- **Usage**: Standard favicon for most browsers

- **File**: `favicon-32x32.png`
- **Dimensions**: 32x32 pixels
- **Usage**: High-DPI displays and modern browsers

### 3. Apple Touch Icons
- **File**: `apple-touch-icon.png`
- **Dimensions**: 180x180 pixels
- **Usage**: iOS devices when adding to home screen

- **File**: `apple-touch-icon-152x152.png`
- **Dimensions**: 152x152 pixels
- **Usage**: iPad home screen icon

- **File**: `apple-touch-icon-120x120.png`
- **Dimensions**: 120x120 pixels
- **Usage**: iPhone home screen icon

### 4. Android Chrome Icons
- **File**: `android-chrome-192x192.png`
- **Dimensions**: 192x192 pixels
- **Usage**: Android Chrome when adding to home screen

- **File**: `android-chrome-512x512.png`
- **Dimensions**: 512x512 pixels
- **Usage**: Android Chrome high-DPI displays

### 5. Windows Tiles
- **File**: `mstile-150x150.png`
- **Dimensions**: 150x150 pixels
- **Usage**: Windows 8/10 tile icons

### 6. Web App Manifest
- **File**: `site.webmanifest`
- **Usage**: PWA manifest for app-like experience

## SVG Favicon (Modern)
- **File**: `favicon.svg`
- **Dimensions**: Scalable (32x32 viewBox recommended)
- **Usage**: Modern browsers that support SVG favicons

## File Naming Convention
All files should be placed in the `public/` directory and follow this exact naming convention:
- `favicon.ico`
- `favicon-16x16.png`
- `favicon-32x32.png`
- `apple-touch-icon.png`
- `apple-touch-icon-152x152.png`
- `apple-touch-icon-120x120.png`
- `android-chrome-192x192.png`
- `android-chrome-512x512.png`
- `mstile-150x150.png`
- `favicon.svg`
- `site.webmanifest`

## Design Guidelines
1. **Keep it simple**: Favicons should be recognizable at small sizes
2. **Use consistent branding**: Match your app's color scheme and logo
3. **Test at small sizes**: Ensure readability at 16x16 pixels
4. **Use transparent backgrounds**: For PNG files, use transparency when possible
5. **High contrast**: Ensure good visibility against various backgrounds

## Generation Tools
You can use these tools to generate all the required favicon files:
- [Favicon Generator](https://realfavicongenerator.net/)
- [Favicon.io](https://favicon.io/)
- [Favicon Generator](https://www.favicon-generator.org/)

## Notes
- The SVG favicon provides the best quality across all screen densities
- ICO files are still needed for maximum browser compatibility
- Apple touch icons should not have transparency (iOS requirement)
- Android Chrome icons work best with solid backgrounds 