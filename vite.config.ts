import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('/react-markdown/') || id.includes('/remark-') || id.includes('/micromark')) {
            return 'markdown';
          }

          if (id.includes('/recharts/')) {
            return 'charts';
          }

          if (id.includes('/d3-')) {
            return 'd3';
          }

          return undefined;
        }
      }
    }
  }
});
