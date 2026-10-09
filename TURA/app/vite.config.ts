import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // Reachable from a phone on the same network, which is how this app is meant to be tried.
    host: true,
    // ngrok's tunnel hostname changes every time it's started, so any subdomain
    // of its domains is allowlisted (same as GB). A tunnel is the easy way to
    // get HTTPS on a phone, which the microphone will require.
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io'],
    proxy: {
      // The browser calls both backends as same-origin relative paths, so no
      // CORS setup is needed in development: /api is the POS (GB-BE, used only
      // to sign in) and /tura is the assistant (TURA/api).
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/tura': { target: 'http://localhost:3100', changeOrigin: true },
    },
  },
});
