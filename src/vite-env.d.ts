/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_AUTOLOAD?: string;
  /** Supabase project URL. Without it (and the anon key) the app runs on this device only. */
  readonly VITE_SUPABASE_URL?: string;
  /** Public anon (publishable) key. Never the service role key. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** UPI ID that receives Pro payments, e.g. name@bank. Payments stay closed without it. */
  readonly VITE_UPI_ID?: string;
  /** Name shown in the UPI app for the payee. */
  readonly VITE_UPI_PAYEE_NAME?: string;
  /** Pro price in rupees. */
  readonly VITE_PRO_PRICE_INR?: string;
  /** Days of Pro one payment buys. */
  readonly VITE_PRO_PERIOD_DAYS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
