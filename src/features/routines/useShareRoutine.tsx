import { useState, type ReactNode } from 'react';
import { BottomSheet, TextField } from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { readableError } from '@/lib/errors';
import { shareRoutine } from './shareRoutine';

/**
 * Sharing a routine from a menu: the share sheet or a copied link, with a toast to say so. On
 * the rare phone that allows neither, the link is shown to copy by hand.
 */
export function useShareRoutine(): { share: (routineId: string) => void; sheet: ReactNode } {
  const toast = useToast();
  const [link, setLink] = useState<string | null>(null);
  const share = (routineId: string) => {
    void shareRoutine(routineId).then(
      (outcome) => {
        if (outcome === 'copied') toast('Link copied. Paste it in any chat to send the routine.');
        else if (typeof outcome === 'object') setLink(outcome.link);
      },
      (err: unknown) => toast(readableError(err)),
    );
  };
  const sheet = (
    <BottomSheet
      open={link !== null}
      onClose={() => setLink(null)}
      title="Send this link"
      subtitle="Copy it and paste it in any chat. Opening it shows the routine with a button to add it."
    >
      {link !== null ? (
        <TextField
          label="Link to the routine"
          value={link}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
          data-share-link
        />
      ) : null}
    </BottomSheet>
  );
  return { share, sheet };
}
