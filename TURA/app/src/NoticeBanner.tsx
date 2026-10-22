import { useEffect, useSyncExternalStore } from 'react';
import { dismissNotice, getNotice, subscribe } from './link';

/** Good news goes away on its own; a cut connection stays until read. */
const SUCCESS_MS = 6000;

/** What happened to the connection (linked from a QR, signed out, access cut), on any screen. */
export function NoticeBanner() {
  const notice = useSyncExternalStore(subscribe, getNotice);

  useEffect(() => {
    if (notice?.tone !== 'success') return;
    const timer = setTimeout(dismissNotice, SUCCESS_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;
  return (
    <div className={`notice notice--${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
      <p>{notice.message}</p>
      <button type="button" className="notice__close" aria-label="Cerrar aviso" onClick={dismissNotice}>
        ×
      </button>
    </div>
  );
}
