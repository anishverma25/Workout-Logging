/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_AUTOLOAD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
