import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from './tests/support/storage-state';

/**
 * Variables de las pruebas E2E (ver .env.e2e.example). Las que ya existan
 * en el entorno, p. ej. en CI, tienen prioridad.
 */
const envFile = fileURLToPath(new URL('.env.e2e', import.meta.url));
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const isCI = !!process.env.CI;
const externalBaseURL = process.env.BASE_URL;
const baseURL = externalBaseURL ?? 'http://localhost:5173';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: isCI,
  /* Retry on CI only */
  retries: isCI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: isCI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: isCI ? [['html', { open: 'never' }], ['list']] : 'html',
  /* El dev server de Vite compila bajo demanda: la primera carga puede pasar de 5s */
  expect: { timeout: 10_000 },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Evidencia de fallos también en local, donde no hay reintentos */
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    /* Inicia sesión una vez y guarda la sesión para los demás proyectos */
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: ADMIN_STORAGE_STATE },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], storageState: ADMIN_STORAGE_STATE },
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], storageState: ADMIN_STORAGE_STATE },
      dependencies: ['setup'],
    },
  ],

  /*
   * Levanta el frontend si no está corriendo. El backend (GB-BE) debe
   * estar activo aparte. Con BASE_URL se prueba contra un ambiente externo.
   */
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !isCI,
      },
});
