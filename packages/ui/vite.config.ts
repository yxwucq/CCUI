import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const serverPort = parseInt(process.env.DEV_PORT || '3456', 10);

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': `http://localhost:${serverPort}`,
      '/ws': { target: `ws://localhost:${serverPort}`, ws: true },
    },
  },
  build: {
    outDir: 'dist',
  },
});
