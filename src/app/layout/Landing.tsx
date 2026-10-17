import { useLayoutEffect } from 'react';
import { LANDING_ATTR } from '../landing';
import { usePageMeta } from '../usePageMeta';

const RELOADED = 'overload.landingReload';

/**
 * Shows the public home page that index.html already contains (`#landing`) and renders nothing
 * itself. Normally the head script has shown it already; this covers arriving at `/` from
 * inside the app (a "Home" link on a policy page, the back button).
 *
 * Pages other than `/` are served without the landing markup (build/seo.ts). Arriving at `/`
 * from one of them loads the page once more to fetch it, at most once per tab.
 */
export function Landing() {
  usePageMeta('/');

  useLayoutEffect(() => {
    const html = document.documentElement;
    if (!document.getElementById('landing')) {
      try {
        if (sessionStorage.getItem(RELOADED) !== '1') {
          sessionStorage.setItem(RELOADED, '1');
          window.location.reload();
        }
      } catch {
        // Storage blocked: stay put rather than risk reloading over and over.
      }
      return;
    }
    html.setAttribute(LANDING_ATTR, '');
    window.scrollTo(0, 0);
    return () => html.removeAttribute(LANDING_ATTR);
  }, []);

  return null;
}
