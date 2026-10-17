import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import './index.css';
import './store';
import App from './app/App';
import { registerCoreSearchProviders } from './services/searchProviders';
import { zodEsErrorMap } from './lib/zod-locale';
import { env } from './config/env';

z.setErrorMap(zodEsErrorMap);
// The browser tab says it too, so a demo tab is never confused with the real system.
if (env.isStaging) document.title = `[STAGING] ${document.title}`;
registerCoreSearchProviders();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('No se encontró el elemento raíz #root');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
