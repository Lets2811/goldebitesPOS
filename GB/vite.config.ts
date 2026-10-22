import { networkInterfaces } from 'node:os'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** This computer's address on the Wi-Fi/LAN, for a phone on the same network. */
function lanAddress(): string | undefined {
  const candidates = Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === 'IPv4' && !net.internal)
  const preferred = candidates.find((net) => /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))\./.test(net!.address))
  return (preferred ?? candidates[0])?.address
}

/** The build modes of the phone apps, and which app each is (VITE_APP_SHELL). */
const PHONE_APPS: Record<string, string> = { mesero: 'waiter', domiciliario: 'courier' }

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // `--mode mesero|domiciliario`: a phone app (see capacitor.config.ts).
  // Built, it has no server of its own to proxy through, so it calls the API
  // at its full address: staging by default, or VITE_API_BASE_URL when it is
  // set before building (variables already in the environment win over .env).
  // Served (`npm run dev:mesero`, for a phone loading this computer), it goes
  // through the /api proxy like the web app.
  const phoneApp = PHONE_APPS[mode]
  if (phoneApp) {
    process.env.VITE_APP_SHELL = phoneApp
    // "Local" in the app's hidden server picker: this computer's API, by default.
    const address = lanAddress()
    if (address) process.env.VITE_LOCAL_API_URL ??= `http://${address}:3000/api/v1`
    if (command === 'build') {
      process.env.VITE_API_BASE_URL ??= 'https://staging.goldenbites.net/api/v1'
    }
  }

  return {
    plugins: [react()],
    build: phoneApp ? { outDir: `dist-${mode}` } : undefined,
    server: {
      host: true,
      // The Android project and the app build hold a copy of the app: not sources to watch.
      watch: { ignored: ['**/android*/**', '**/dist-*/**'] },
      // Vite rejects requests whose Host header it doesn't recognize (DNS-rebinding
      // protection) — ngrok's tunnel hostname changes every time it's started, so
      // any subdomain of ngrok's own domains is allowlisted instead of one fixed URL.
      allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io'],
      proxy: {
        // Lets the browser call the API as a same-origin relative path (see
        // VITE_API_BASE_URL=/api/v1), so a single ngrok tunnel to this dev
        // server is enough — no second tunnel or CORS config needed for the
        // backend, which stays reachable only from this machine.
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  }
})
