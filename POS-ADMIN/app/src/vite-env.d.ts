/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** POS-ADMIN's API base; defaults to /admin-api/v1. */
  readonly VITE_ADMIN_API_URL?: string;
  /** "staging" in the demo environment; unset (production) everywhere else. */
  readonly VITE_APP_ENV?: string;
  /** Address of TURA's app, shown with a QR in a business's TURA panel. */
  readonly VITE_TURA_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
