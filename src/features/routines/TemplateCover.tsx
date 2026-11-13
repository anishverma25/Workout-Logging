import type { RoutineTemplate } from '@/data/library/templates';
import { cn } from '@/lib/cn';
import { coverWeek } from './templateCover';

/**
 * The cover on a routine template card: the template's own week, Monday to Sunday, each
 * training day named in short and each rest day left quiet. Drawn from the template's data, so
 * it can never disagree with what the routine will create.
 */
export function TemplateCover({
  template,
  highlight = false,
}: {
  template: RoutineTemplate;
  highlight?: boolean;
}) {
  const week = coverWeek(template);
  return (
    <div
      className={cn(
        'relative mb-3 w-full overflow-hidden rounded-field p-2',
        highlight ? 'glow-lime bg-lime-dim' : 'bg-fill',
      )}
      aria-hidden
      data-template-cover={template.key}
    >
      <ol className="relative grid grid-cols-7 gap-1">
        {week.map((d) => (
          <li key={d.weekday} className="flex flex-col items-center gap-1">
            <span className="type-caption text-text-3">{d.letter}</span>
            <span
              className={cn(
                'type-caption flex h-8 w-full items-center justify-center rounded-[0.5rem] font-semibold tabular',
                d.label ? 'bg-lime text-on-lime' : 'text-text-3',
              )}
            >
              {d.label ?? '·'}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
