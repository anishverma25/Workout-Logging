import { useEffect } from 'react';
import { APP_NAME } from './navigation';
import { HOME_PAGE, SITE_ORIGIN, publicPage } from './publicPages';

/**
 * Title, description and canonical address for a public page while it is open. The build
 * already writes them into each page's own HTML (build/seo.ts); this keeps them right when
 * people move between pages inside the app. Leaving the page puts back the app's own title.
 */
export function usePageMeta(path: string) {
  useEffect(() => {
    const page = publicPage(path);
    if (!page) return;
    set(page.title, page.description, `${SITE_ORIGIN}${page.path}`);
    return () => set(APP_NAME, HOME_PAGE.description, `${SITE_ORIGIN}/`);
  }, [path]);
}

function set(title: string, description: string, canonical: string) {
  document.title = title;
  document
    .querySelector<HTMLMetaElement>('meta[name="description"]')
    ?.setAttribute('content', description);
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', canonical);
}
