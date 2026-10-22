import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import './shared/index.css';
import { env } from './shared/config/env';
import { zodEsErrorMap } from './shared/lib/zod-locale';
import AdminApp from './AdminApp';

/**
 * Entry of the Admin app (admin.goldenbites.net): the Golden Bites team's
 * tool to manage the restaurants on the platform. A separate build from the
 * POS (vite.admin.config.ts) that shares its components and theme.
 */
z.setErrorMap(zodEsErrorMap);
document.title = env.isStaging ? '[STAGING] Golden Bites · Admin' : 'Golden Bites · Admin';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('No se encontró el elemento raíz #root');

createRoot(rootElement).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
