import { useEffect, useMemo, useState } from 'react';
import { Download, Share } from 'lucide-react';
import { BottomSheet, PrimaryButton, SecondaryButton } from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { usePreferences, useProfile } from '@/data/hooks';
import type { RankCard } from '@/domain/share/rankCard';
import { CARD_H, CARD_W, drawRankCard, loadCardFonts, type CardContext } from './draw';

/**
 * Shares your place on a leaderboard as a story card (November 2026): the rank, the points and
 * what earned them, and the gap to the next place. Your own numbers only.
 */
export function RankShareSheet({
  card,
  open,
  onClose,
}: {
  card: RankCard | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <BottomSheet
      open={open && !!card}
      onClose={onClose}
      title="Share your place"
      subtitle="Instagram story or WhatsApp status"
    >
      {open && card ? <RankShare card={card} /> : null}
    </BottomSheet>
  );
}

function RankShare({ card }: { card: RankCard }) {
  const prefs = usePreferences();
  const profile = useProfile().data;
  const toast = useToast();
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const context = useMemo<CardContext>(() => {
    const first = profile?.displayName?.trim().split(/\s+/)[0] ?? null;
    return { person: first || null, unit: prefs.weightUnit, link: window.location.host };
  }, [profile?.displayName, prefs.weightUnit]);

  useEffect(() => {
    let cancelled = false;
    let made: string | null = null;
    void (async () => {
      await loadCardFonts();
      const canvas = document.createElement('canvas');
      canvas.width = CARD_W;
      canvas.height = CARD_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawRankCard(ctx, card, context);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
      if (!blob || cancelled) return;
      made = URL.createObjectURL(blob);
      setImage({ blob, url: made });
    })();
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [card, context]);

  const fileName = `overload-gym-rank-${card.scope}-${card.startsOn}.png`;
  const file = image ? new File([image.blob], fileName, { type: 'image/png' }) : null;
  const canShareFile =
    !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  async function share() {
    if (!file) return;
    setBusy(true);
    try {
      // The image only: Instagram drops shares that carry text with the file.
      await navigator.share({ files: [file] });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError'))
        toast('Could not open sharing. Save the image and post it from your gallery.');
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!image) return;
    const a = document.createElement('a');
    a.href = image.url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('Image saved');
  }

  return (
    <div className="flex flex-col gap-4 pt-1" data-rank-share>
      <div className="flex justify-center">
        <div
          className="relative aspect-[9/16] w-[min(15rem,60vw)] overflow-hidden rounded-nested bg-surface-2 supports-[height:1dvh]:max-h-[52dvh]"
          aria-live="polite"
        >
          {image ? (
            <img
              src={image.url}
              alt={`Your place, #${card.rank}, as a story card`}
              className="size-full object-contain"
              data-rank-card
            />
          ) : (
            <span className="type-meta absolute inset-0 flex items-center justify-center text-text-2">
              Making your card...
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 pb-1">
        {canShareFile ? (
          <PrimaryButton
            block
            icon={<Share aria-hidden />}
            loading={busy}
            onClick={() => void share()}
          >
            Share
          </PrimaryButton>
        ) : null}
        <SecondaryButton block icon={<Download aria-hidden />} disabled={!image} onClick={save}>
          Save image
        </SecondaryButton>
        <p className="type-meta text-center text-text-2">
          {canShareFile
            ? 'Pick Instagram and then Story, or WhatsApp and then My status.'
            : 'Save it, then add it to your Instagram story or WhatsApp status from your photos.'}
        </p>
      </div>
    </div>
  );
}
