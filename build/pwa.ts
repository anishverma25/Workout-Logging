import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const INDEX_HTML = fileURLToPath(new URL('../index.html', import.meta.url));

/**
 * CSP hashes of the inline scripts in index.html (the one that decides, before the first paint,
 * whether the public home page shows). Read from the file itself, so editing the script can
 * never leave a stale hash; scripts/verify-build.mjs checks the built page against `_headers`.
 */
export function inlineScriptHashes(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    (m) =>
      `'sha256-${createHash('sha256')
        .update(m[1] ?? '')
        .digest('base64')}'`,
  );
}

const INLINE_SCRIPTS = inlineScriptHashes(readFileSync(INDEX_HTML, 'utf8')).join(' ');

/**
 * Security headers for every response. The Supabase origin comes from the build's environment,
 * so the Content Security Policy allows exactly that API and nothing else.
 */
export function securityHeaders(supabaseUrl: string | undefined): Record<string, string> {
  let api = '';
  try {
    if (supabaseUrl) {
      const origin = new URL(supabaseUrl).origin;
      api = ` ${origin} ${origin.replace(/^http/, 'ws')}`;
    }
  } catch {
    // Invalid URL: accounts are off anyway.
  }
  const csp = [
    "default-src 'self'",
    // Razorpay Checkout for Pro plans: its script, its payment window and its API.
    `script-src 'self' ${INLINE_SCRIPTS} https://checkout.razorpay.com`,
    // React sets inline style attributes (chart sizes, progress bars).
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://cdn.razorpay.com",
    'frame-src https://api.razorpay.com https://checkout.razorpay.com',
    "font-src 'self'",
    `connect-src 'self'${api} https://api.razorpay.com https://lumberjack.razorpay.com https://world.openfoodfacts.org`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), usb=(), payment=(self "https://api.razorpay.com")',
    'X-Frame-Options': 'DENY',
    // Razorpay opens bank and wallet pages in a popup, which same-origin would cut off.
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  };
}

/** Cloudflare Pages `_headers`: security headers everywhere, long caching for hashed files only. */
function headersFile(supabaseUrl: string | undefined): string {
  const all = Object.entries({
    ...securityHeaders(supabaseUrl),
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  })
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n');
  return `/*
${all}

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/sw.js
  Cache-Control: no-cache

/
  Cache-Control: no-cache

/index.html
  Cache-Control: no-cache

/manifest.webmanifest
  Cache-Control: no-cache
`;
}

/**
 * Bumped by hand at the end of every UI redesign part (UI rules 3.1), so installed apps always
 * fetch a fresh shell even when only public files changed. Part of the cache name and hash.
 */
export const CACHE_EPOCH = 'ui-12';

const TEMPLATE = fileURLToPath(new URL('./sw-template.js', import.meta.url));

/**
 * Emits `sw.js` with the exact list of built files to precache, and `_headers` for hosting.
 * The version is a hash of that list, so every deploy with changed files is a new worker.
 */
export function pwa(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'overload-pwa',
    apply: 'build',
    generateBundle(_options, bundle) {
      // Older font formats (KaTeX ships woff and ttf beside woff2) are fallbacks every browser
      // that can install the app skips, so they are not worth precaching.
      const files = Object.keys(bundle).filter((f) => !/\.(map|ttf|woff)$/.test(f));
      const publicFiles = [
        '/manifest.webmanifest',
        '/icon.svg',
        '/fonts/inter-400.woff2',
        '/fonts/inter-500.woff2',
        '/fonts/inter-600.woff2',
        '/fonts/inter-700.woff2',
        '/fonts/inter-display-700.woff2',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
        '/icons/apple-touch-icon.png',
      ];
      const precache = [
        '/',
        ...files.filter((f) => f !== 'index.html').map((f) => `/${f}`),
        ...publicFiles,
      ];
      const template = readFileSync(TEMPLATE, 'utf8');
      // The worker's own code is part of the version: a change to it alone is a new version.
      const version = createHash('sha256')
        .update(CACHE_EPOCH)
        .update(template)
        .update(JSON.stringify(precache))
        .update(
          Object.values(bundle)
            .map((c) => ('code' in c ? c.code : ''))
            .join(''),
        )
        .digest('hex')
        .slice(0, 12);
      const source = template
        .replace('__VERSION__', `${CACHE_EPOCH}-${version}`)
        .replace('__PRECACHE__', JSON.stringify(precache));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source: headersFile(env.VITE_SUPABASE_URL),
      });
    },
  };
}
