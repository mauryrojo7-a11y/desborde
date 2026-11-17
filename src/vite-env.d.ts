/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REVENUECAT_PUBLIC_KEY?: string;
  readonly VITE_ADMOB_REWARDED_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
