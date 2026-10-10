import { useEffect, useMemo, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { Camera, Columns2, Lock, Trash2 } from 'lucide-react';
import { useAccount } from '@/app/account';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ConfirmSheet, Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { addPhoto, deletePhoto, listPhotos, type Pose, type ProgressPhoto } from '@/data/photos';
import { requestPersistentStorage } from '@/data/storage';
import { cn } from '@/lib/cn';
import { formatShortDate } from '@/lib/dates';

const POSES: { value: Pose; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'side', label: 'Side' },
  { value: 'back', label: 'Back' },
];

function usePhotos(owner: string) {
  const [photos, setPhotos] = useState<ProgressPhoto[] | null>(null);
  useEffect(() => {
    const sub = liveQuery(() => listPhotos(owner)).subscribe({
      next: setPhotos,
      error: () => setPhotos([]),
    });
    return () => sub.unsubscribe();
  }, [owner]);
  return photos;
}

/** An object URL for a stored photo, released when it is no longer shown. */
function PhotoImage({ photo, className }: { photo: ProgressPhoto; className?: string }) {
  const url = useMemo(() => URL.createObjectURL(photo.blob), [photo.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <img
      src={url}
      alt={`${POSES.find((p) => p.value === photo.pose)?.label} photo, ${formatShortDate(new Date(photo.takenAt))}`}
      className={className}
      width={photo.width}
      height={photo.height}
      draggable={false}
    />
  );
}

export function PhotosSection() {
  const account = useAccount();
  const owner = account.user?.id ?? 'guest';
  const photos = usePhotos(owner);
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [pose, setPose] = useState<Pose>('front');
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null);
  const [comparing, setComparing] = useState(false);
  const ofPose = (photos ?? []).filter((p) => p.pose === pose);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await addPhoto(owner, file, pose);
      void requestPersistentStorage();
      toast('Photo saved on this device');
    } catch {
      toast('Could not read that photo. Try another one.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <section aria-labelledby="photos-title" className="mt-9">
      <div className="mb-2.5 flex items-end justify-between gap-3">
        <h2 id="photos-title" className="type-title text-text-1">
          Progress photos
        </h2>
        <SegmentedControl label="Pose" value={pose} onChange={setPose} options={POSES} />
      </div>
      <p className="mb-3 flex items-start gap-1.5 text-sm text-faint">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Photos stay on this device only. They are never uploaded or backed up, so keep a copy if you
        change phones.
      </p>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Choose a photo"
        tabIndex={-1}
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-[1rem] bg-surface text-sm font-medium text-accent-text transition-colors active:bg-surface-2"
        >
          <Camera className="size-6" aria-hidden />
          {busy ? 'Saving...' : `Add ${pose}`}
        </button>
        {ofPose.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setViewing(p)}
            className="relative aspect-[3/4] overflow-hidden rounded-[1rem] bg-surface"
          >
            <PhotoImage photo={p} className="size-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-5 text-left text-xs font-medium text-white">
              {formatShortDate(new Date(p.takenAt))}
            </span>
          </button>
        ))}
      </div>
      {ofPose.length >= 2 ? (
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          icon={<Columns2 className="size-4" aria-hidden />}
          onClick={() => setComparing(true)}
        >
          Compare
        </Button>
      ) : null}

      {viewing ? <PhotoSheet photo={viewing} onClose={() => setViewing(null)} /> : null}
      {comparing ? <CompareSheet photos={ofPose} onClose={() => setComparing(false)} /> : null}
    </section>
  );
}

function PhotoSheet({ photo, onClose }: { photo: ProgressPhoto; onClose: () => void }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Sheet
        open={!confirm}
        onClose={onClose}
        title={formatShortDate(new Date(photo.takenAt))}
        footer={
          <Button
            variant="danger"
            icon={<Trash2 className="size-4" aria-hidden />}
            onClick={() => setConfirm(true)}
          >
            Delete photo
          </Button>
        }
      >
        <PhotoImage photo={photo} className="mx-auto max-h-[60dvh] w-auto rounded-[1rem]" />
      </Sheet>
      <ConfirmSheet
        open={confirm}
        title="Delete this photo?"
        body="It is removed from this device. There is no other copy."
        confirmLabel="Delete"
        danger
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await deletePhoto(photo.id);
          toast('Photo deleted');
          onClose();
        }}
      />
    </>
  );
}

/** Two dates side by side, or one over the other with a slider. */
function CompareSheet({ photos, onClose }: { photos: ProgressPhoto[]; onClose: () => void }) {
  const oldest = photos[photos.length - 1]!;
  const newest = photos[0]!;
  const [beforeId, setBeforeId] = useState(oldest.id);
  const [afterId, setAfterId] = useState(newest.id);
  const [mode, setMode] = useState<'side' | 'slide'>('side');
  const [split, setSplit] = useState(50);
  const before = photos.find((p) => p.id === beforeId) ?? oldest;
  const after = photos.find((p) => p.id === afterId) ?? newest;
  const select = (value: string, onChange: (v: string) => void, label: string) => (
    <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-xl bg-surface-2 px-3 text-text"
      >
        {photos.map((p) => (
          <option key={p.id} value={p.id}>
            {formatShortDate(new Date(p.takenAt))}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <Sheet open onClose={onClose} title="Compare" size="lg">
      <div className="mb-3 flex gap-2">
        {select(beforeId, setBeforeId, 'Before')}
        {select(afterId, setAfterId, 'After')}
      </div>
      <SegmentedControl
        label="Compare view"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'side', label: 'Side by side' },
          { value: 'slide', label: 'Slider' },
        ]}
      />
      {mode === 'side' ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[before, after].map((p, i) => (
            <figure key={`${p.id}-${i}`}>
              <PhotoImage photo={p} className="aspect-[3/4] w-full rounded-[1rem] object-cover" />
              <figcaption className="mt-1 text-center text-sm text-faint">
                {formatShortDate(new Date(p.takenAt))}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <div className="relative mx-auto aspect-[3/4] max-h-[60dvh] overflow-hidden rounded-[1rem]">
            <PhotoImage photo={before} className="absolute inset-0 size-full object-cover" />
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 0 0 ${split}%)` }}
            >
              <PhotoImage photo={after} className="absolute inset-0 size-full object-cover" />
            </div>
            <span
              aria-hidden
              className={cn('absolute inset-y-0 w-0.5 bg-white shadow')}
              style={{ left: `${split}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={split}
            onChange={(e) => setSplit(Number(e.target.value))}
            aria-label="Slide between before and after"
            className="mt-3 w-full accent-[var(--accent)]"
          />
        </div>
      )}
    </Sheet>
  );
}
