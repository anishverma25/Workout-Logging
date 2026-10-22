import { Info } from 'lucide-react';
import { InlineNotice } from '@/components/kit';
import { ESTIMATE_WARNING } from '@/domain/activity/burn';

/** The warning that goes with every calorie-burn estimate. */
export function EstimateNote({ className }: { className?: string }) {
  return (
    <InlineNotice icon={<Info />} className={className}>
      <span data-estimate-note>{ESTIMATE_WARNING}</span>
    </InlineNotice>
  );
}
