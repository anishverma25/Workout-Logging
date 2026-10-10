/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_AUTOLOAD?: string;
  /** Supabase project URL. Without it (and the anon key) the app runs on this device only. */
  readonly VITE_SUPABASE_URL?: string;
  /** Public anon (publishable) key. Never the service role key. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Short commit of the build (see vite.config.ts). */
declare const __APP_VERSION__: string;
