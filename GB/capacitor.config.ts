import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The phone apps made from the POS: each is the POS built with its own mode
 * (only signing in and that app's screen, see PhoneAppRoutes), packed as an
 * Android app in its own folder. CAP_APP picks the app (the npm scripts set
 * it, see scripts/cap-app.mjs):
 * - mesero: the waiter's app, `npm run mesero:android`.
 * - domiciliario: the courier's app, `npm run domiciliario:android`.
 *
 * The apps talk to the API they were built with (staging by default, see
 * vite.config.ts) until another is picked on the sign-in screen (three taps
 * on the Midas Tech logo). Every server answers them: GB-BE allows where they
 * run (http://localhost) on its own, see GB-BE/src/config/cors-origins.ts.
 *
 * While developing, `CAP_SERVER_URL=http://<this computer's IP>:<port>` makes
 * the app load a dev server instead (`vite --mode <app>`, changes show without
 * rebuilding; the API goes through its /api proxy).
 */
const APPS = {
  mesero: {
    appId: 'net.goldenbites.mesero',
    appName: 'GB Mesero',
    webDir: 'dist-mesero',
    android: { path: 'android' },
    // Nothing native beyond the app itself.
    includePlugins: [],
  },
  domiciliario: {
    appId: 'net.goldenbites.domiciliario',
    appName: 'GB Domicilios',
    webDir: 'dist-domiciliario',
    android: {
      path: 'android-domiciliario',
      // Keeps the location coming after 5 minutes in the background (see the
      // background-geolocation plugin's notes).
      useLegacyBridge: true,
    },
    includePlugins: [
      '@capacitor/push-notifications',
      '@capacitor-community/background-geolocation',
    ],
  },
} satisfies Record<string, CapacitorConfig>;

const appName = (process.env.CAP_APP ?? 'mesero') as keyof typeof APPS;
const app = APPS[appName];
if (!app) throw new Error(`CAP_APP must be one of: ${Object.keys(APPS).join(', ')}`);

const devServerUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  ...app,
  backgroundColor: '#0B0B0C',
  server: {
    // The app runs at http://localhost (not https): "Local" in the hidden
    // server picker (LoginPage) is this computer over plain http, and an
    // https page may not show its photos. http://localhost still counts as a
    // secure page (location, notifications). The manifests allow plain http
    // (android:usesCleartextTraffic).
    androidScheme: 'http',
    ...(devServerUrl ? { url: devServerUrl, cleartext: true } : {}),
  },
  plugins: {
    // Light icons on the phone's bars: the apps are dark.
    SystemBars: { style: 'DARK' },
  },
};

export default config;
