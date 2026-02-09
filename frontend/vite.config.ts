import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          mantine: [
            '@mantine/core',
            '@mantine/hooks',
            '@mantine/notifications',
            '@mantine/modals',
            '@mantine/dates',
            '@mantine/dropzone',
          ],
          reactQuery: ['@tanstack/react-query'],
          dnd: ['@dnd-kit/core', '@dnd-kit/utilities'],
          flow: ['reactflow'],
          grid: ['react-grid-layout'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['@mantine/core', '@mantine/dates', '@mantine/dropzone', '@mantine/hooks', '@mantine/notifications', '@mantine/modals', '@mantine/form'],
  },
});
