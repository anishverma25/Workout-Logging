// Fails the build if the production bundle contains anything that must never ship:
// development-only access overrides, or a Supabase secret (service role) key.
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

if (problems.length) {
  console.error('Build check failed:\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log('Build check passed: no development overrides or secret keys in dist/.');
