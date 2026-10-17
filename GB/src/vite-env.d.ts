/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /** "staging" in the demo environment; unset (production) everywhere else. */
  readonly VITE_APP_ENV?: string;
  /** Address of TURA's app, shown to the platform admin when linking it. */
  readonly VITE_TURA_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
