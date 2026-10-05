/** Three rising bars: load going up over time. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <rect x="7.5" y="17" width="4" height="8" rx="1.2" fill="var(--accent-ink)" opacity="0.45" />
      <rect x="14" y="12" width="4" height="13" rx="1.2" fill="var(--accent-ink)" opacity="0.7" />
      <rect x="20.5" y="7" width="4" height="18" rx="1.2" fill="var(--accent-ink)" />
    </svg>
  );
}
