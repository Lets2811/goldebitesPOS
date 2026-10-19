import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * POS-ADMIN app. In development the browser calls the API as a same-origin
 * relative path (/admin-api/v1), proxied to POS-ADMIN/api.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      '/admin-api': { target: 'http://localhost:3200', changeOrigin: true },
    },
  },
});
