import { PageHeader } from '@/app/layout/PageHeader';
import { ReleaseStepView } from '@/app/layout/WhatsNew';
import { BRAIN_STEPS, RELEASE_STEPS } from '@/app/layout/whatsNewContent';
import { TextButton } from '@/components/kit';

/** Everything in the latest release, part by part, for reading at any time. */
export function WhatsNewPage() {
  return (
    <>
      <PageHeader
        back={{ to: '/more', label: 'More' }}
        title="What is new"
        subtitle="November 2026"
      />
      <div className="mx-auto flex max-w-xl flex-col gap-10 pb-10" data-whats-new-page>
        {RELEASE_STEPS.map((s) => (
          <section key={s.id}>
            <ReleaseStepView step={s} page />
            <TextButton to={s.where.to} className="mt-2">
              {s.where.label}
            </TextButton>
          </section>
        ))}
        <h2 className="type-section border-t-[0.5px] border-divider pt-8 text-text-1">
          Earlier in November: the Macrotrophy Brain
        </h2>
        {BRAIN_STEPS.map((s) => (
          <section key={s.id}>
            <ReleaseStepView step={s} page />
            {s.id !== 'brain' ? (
              <TextButton to={s.where.to} className="mt-2">
                {s.where.label}
              </TextButton>
            ) : null}
          </section>
        ))}
      </div>
    </>
  );
}
