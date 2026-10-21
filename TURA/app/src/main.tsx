import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { captureInstallPrompt } from './install';
import { linkFromAddress, validateActiveLink } from './link';
import './styles.css';

// Before anything renders: the browser offers installing only once.
captureInstallPrompt();
// Opened from a QR or a shared link: link first; then check the connection
// the device already has, quietly, and again whenever the app comes back.
void linkFromAddress().then(validateActiveLink);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    void validateActiveLink();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
