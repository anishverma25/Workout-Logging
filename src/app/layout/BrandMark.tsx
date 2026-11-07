/**
 * The Macrotrophy logo (November 2026): a dumbbell inside a ring that ends in a fork, for
 * training and food in one app. The same file as the favicon (`public/icon.svg`), which the
 * service worker precaches, so it shows offline too.
 */
export function BrandMark({ className }: { className?: string }) {
  return <img src="/icon.svg" alt="" aria-hidden width={32} height={32} className={className} />;
}
