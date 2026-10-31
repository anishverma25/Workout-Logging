import { ButtonLink } from '@/components/ui/Button';
import { PageHeader } from '@/app/layout/PageHeader';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" subtitle="That link does not go anywhere in the app." />
      <ButtonLink to="/">Go to Home</ButtonLink>
    </>
  );
}
