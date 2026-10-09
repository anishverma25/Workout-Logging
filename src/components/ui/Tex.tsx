import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/cn';

/**
 * A formula typeset with KaTeX. The TeX is written in this codebase, never typed by a user, so
 * the generated markup is safe to insert. `label` is what a screen reader hears instead.
 */
export function Tex({
  children,
  block = true,
  label,
  className,
}: {
  children: string;
  block?: boolean;
  label: string;
  className?: string;
}) {
  const html = useMemo(
    () =>
      katex.renderToString(children, {
        displayMode: block,
        throwOnError: false,
        output: 'html',
        strict: 'ignore',
      }),
    [children, block],
  );
  const Tag = block ? 'div' : 'span';
  return (
    <Tag role="math" aria-label={label} className={cn(block && 'tex-block', className)}>
      <span aria-hidden dangerouslySetInnerHTML={{ __html: html }} />
    </Tag>
  );
}
