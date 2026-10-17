/**
 * Cloudflare Pages middleware: sends page requests on the old `overload-gym.pages.dev` address
 * to the custom domain with a permanent (301) redirect, once `VITE_CANONICAL_ORIGIN` is set in
 * the Pages project's variables. Everything else, including every preview address, is served
 * as usual. `_routes.json` (build/seo.ts) keeps files and the service worker out of here.
 */
import { legacyRedirect } from '../src/app/domain.ts';

interface PagesContext {
  request: Request;
  env: { VITE_CANONICAL_ORIGIN?: string };
  next: () => Promise<Response>;
}

export async function onRequest(context: PagesContext): Promise<Response> {
  try {
    const { request, env } = context;
    const redirect = legacyRedirect(request.method, request.url, env.VITE_CANONICAL_ORIGIN);
    if (redirect) return redirect;
  } catch {
    // Never let the redirect break the site: serve the page as if it were not here.
  }
  return context.next();
}
