import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api/base-mainnet': {
        target: 'https://base.easscan.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/base-mainnet/, ''),
      },
      '/api/base-sepolia': {
        target: 'https://base-sepolia.easscan.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/base-sepolia/, ''),
      },
    },
  },
  build: {
    outDir: '../../../build/react/dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  define: {
    // Make environment variables available
    'process.env': process.env,
  },
})