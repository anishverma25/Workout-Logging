import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

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
    "script-src 'self'",
    // React sets inline style attributes (chart sizes, progress bars).
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${api}`,
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
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
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

/index.html
  Cache-Control: no-cache

/manifest.webmanifest
  Cache-Control: no-cache
`;
}

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
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const publicFiles = [
        '/manifest.webmanifest',
        '/icon.svg',
        '/theme-init.js',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
        '/icons/apple-touch-icon.png',
      ];
      const precache = [
        '/',
        ...files.filter((f) => f !== 'index.html').map((f) => `/${f}`),
        ...publicFiles,
      ];
      const version = createHash('sha256')
        .update(JSON.stringify(precache))
        .update(
          Object.values(bundle)
            .map((c) => ('code' in c ? c.code : ''))
            .join(''),
        )
        .digest('hex')
        .slice(0, 12);
      const source = readFileSync(TEMPLATE, 'utf8')
        .replace('__VERSION__', version)
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
