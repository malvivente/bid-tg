/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TONCONNECT_MANIFEST_URL?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_TREASURY_ADDRESS?: string;
  readonly VITE_TONAPI_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
