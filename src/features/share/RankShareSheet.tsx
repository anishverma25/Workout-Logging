import { useEffect, useState } from 'react';
import { BottomSheet, InlineNotice, Spinner } from '@/components/kit';
import { useProfile } from '@/data/hooks';
import type { StoryContent } from '@/domain/share/story';
import { StoryEditor } from './story/StoryEditor';

/**
 * Share a leaderboard rank as a story card (share cards 2.0). The rank comes from the server
 * (`load`), so the editor only opens once it has arrived: a card never shows a guessed rank.
 * Other members' names are never on it.
 */
export function RankShareSheet({
  open,
  onClose,
  load,
  fileTag,
}: {
  open: boolean;
  onClose: () => void;
  load: () => Promise<StoryContent | null>;
  fileTag: string;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Share your rank"
      subtitle="Instagram story or WhatsApp status"
      tall
    >
      {open ? <RankShare load={load} fileTag={fileTag} /> : null}
    </BottomSheet>
  );
}

function RankShare({ load, fileTag }: { load: () => Promise<StoryContent | null>; fileTag: string }) {
  const profile = useProfile();
  const [content, setContent] = useState<StoryContent | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    load()
      .then((c) => {
        if (!live) return;
        if (c) setContent(c);
        else setFailed(true);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
    // Loaded once per opening of the sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const first = profile.data?.displayName?.trim().split(/\s+/)[0] || null;

  if (failed)
    return (
      <InlineNotice tone="warning">
        Could not get your rank right now. Check your connection and try again.
      </InlineNotice>
    );
  if (!content)
    return (
      <p className="type-body flex items-center justify-center gap-2 py-10 text-text-2">
        <Spinner /> Getting your rank...
      </p>
    );
  return <StoryEditor content={content} name={first} fileName={`macrotrophy-${fileTag}.png`} />;
}
