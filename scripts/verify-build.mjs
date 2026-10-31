// Fails the build if the production bundle contains anything that must never ship:
// development-only access overrides, or a Supabase secret (service role) key. Also checks the
// public pages: the home page's inline script is allowed by the CSP, and the SEO files exist.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = [
  { pattern: /overload\.dev\.entitlement/, why: 'development access override' },
  { pattern: /sb_secret_[A-Za-z0-9]/, why: 'Supabase secret key' },
  { pattern: /"role"\s*:\s*"service_role"/, why: 'service role key payload' },
  { pattern: /SUPABASE_SERVICE_ROLE/, why: 'service role key variable' },
];

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const problems = [];
for (const file of files('dist').filter((f) => /\.(js|html|css|json|webmanifest)$/.test(f))) {
  const text = readFileSync(file, 'utf8');
  // Service role JWTs: decode every JWT-shaped string and check its role.
  for (const token of text.match(/eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g) ?? []) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      if (payload.role === 'service_role') problems.push(`${file}: service role JWT`);
    } catch {
      // Not a JWT.
    }
  }
  for (const { pattern, why } of FORBIDDEN) {
    if (pattern.test(text)) problems.push(`${file}: ${why}`);
  }
}

// The inline script that shows the public home page must be allowed by the CSP, or first-time
// visitors would wait for the app to start before seeing anything.
const headers = readFileSync('dist/_headers', 'utf8');
for (const page of ['index.html', 'welcome.html', 'terms.html']) {
  const html = readFileSync(join('dist', page), 'utf8');
  for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    const hash = `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`;
    if (!headers.includes(hash)) problems.push(`dist/${page}: inline script not allowed by CSP`);
  }
}
for (const file of ['sitemap.xml', '_routes.json', 'robots.txt']) {
  try {
    statSync(join('dist', file));
  } catch {
    problems.push(`dist/${file} is missing`);
  }
}
if (!readFileSync('dist/index.html', 'utf8').includes('id="landing"')) {
  problems.push('dist/index.html has no public home page');
}
if (readFileSync('dist/terms.html', 'utf8').includes('id="landing"')) {
  problems.push('dist/terms.html still carries the home page');
}

if (problems.length) {
  console.error('Build check failed:\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log('Build check passed: no development overrides or secret keys in dist/.');
