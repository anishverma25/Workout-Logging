import { useEffect, useState, type ReactNode } from 'react';
import { Check, Download, ExternalLink } from 'lucide-react';
import { BottomSheet, PrimaryButton, SecondaryButton } from '@/components/kit';
import { photoDb } from '@/data/photos';
import { useAccount, useSyncStatus } from '../account';
import { movePlan, moveTarget, photoFileName, readyToMove } from '../domain';
import { seenRelease } from './whatsNewStore';

const target = moveTarget(window.location, import.meta.env.VITE_CANONICAL_ORIGIN);

const PHOTOS_DONE_KEY = 'overload.movePhotosDone';
const SNOOZE_KEY = 'overload.moveSnoozedUntil';
const SNOOZE_DAYS = 3;

function installed(): boolean {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Without storage the prompt simply shows again next time.
  }
}

/** Every progress photo in this browser as a file, oldest first. */
async function photoFiles(): Promise<File[]> {
  const all = await photoDb().photos.orderBy('takenAt').toArray();
  return all.map(
    (p, i) =>
      new File([p.blob], photoFileName(p.takenAt, p.pose, i), {
        type: p.blob.type || 'image/jpeg',
      }),
  );
}

/**
 * Saves the photos to the phone: the share sheet where it takes files (iPhone: Save images),
 * else one zip download. False when the person closed the share sheet.
 */
async function savePhotos(files: File[]): Promise<boolean> {
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
    try {
      await navigator.share({ files });
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return false;
      // Sharing failed for another reason: fall back to the download.
    }
  }
  const { zipSync } = await import('fflate');
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.name] = new Uint8Array(await f.arrayBuffer());
  const zip = zipSync(entries, { level: 0 });
  const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'macrotrophy-progress-photos.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

/**
 * On an old address (`overloadgym.in`, `overload-gym.pages.dev`), once the move is switched on
 * (`VITE_CANONICAL_ORIGIN`). Renders nothing anywhere else.
 *
 * - The app installed on the home screen keeps working and updating here; every few days it
 *   shows how to install the new one (after the release announcement, never over a workout).
 * - A browser tab moves to the new address once every change is saved, after offering to save
 *   progress photos, which live only in this browser and would not come along.
 */
export function MoveToNewHome() {
  const account = useAccount();
  const sync = useSyncStatus();
  const ready = readyToMove(account, sync);
  const [isInstalled] = useState(installed);
  const [photos, setPhotos] = useState<number | null>(target ? null : 0);
  const [photosDone, setPhotosDone] = useState(() => read(PHOTOS_DONE_KEY) === '1');
  // Closing the photo sheet keeps this tab here for now; it asks again next time.
  const [notNow, setNotNow] = useState(false);
  const plan = movePlan({ target, installed: isInstalled, photos, photosDone, ready });

  useEffect(() => {
    if (!target) return;
    let live = true;
    photoDb()
      .photos.count()
      .then((n) => live && setPhotos(n))
      .catch(() => live && setPhotos(0));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (plan === 'move') {
      window.location.replace(
        // Read again at move time: the page may have navigated inside the app since the build.
        moveTarget(window.location, import.meta.env.VITE_CANONICAL_ORIGIN) ?? target!,
      );
    }
  }, [plan]);

  const markPhotosDone = () => {
    write(PHOTOS_DONE_KEY, '1');
    setPhotosDone(true);
  };

  if (plan === 'stay') return null;
  if (plan === 'install')
    return (
      <InstallPrompt
        photos={photos ?? 0}
        photosDone={photosDone}
        onPhotosSaved={markPhotosDone}
        ready={ready}
      />
    );
  if (plan === 'save-photos')
    return notNow ? null : (
      <SavePhotosSheet
        count={photos ?? 0}
        onDone={markPhotosDone}
        onClose={() => setNotNow(true)}
      />
    );
  return (
    <p
      role="status"
      className="type-meta fixed inset-x-0 top-0 z-50 bg-surface px-4 py-2 text-center text-text-2 pt-[max(0.5rem,env(safe-area-inset-top))]"
    >
      {plan === 'move'
        ? 'Moving to macrotrophy.in...'
        : 'Macrotrophy is moving to macrotrophy.in. Saving your changes first.'}
    </p>
  );
}

/** Loads the photo files while a sheet is open, so the share sheet opens straight from a tap. */
function usePhotoFiles(open: boolean, count: number) {
  const [files, setFiles] = useState<File[] | null>(null);
  useEffect(() => {
    if (!open || count === 0) return;
    let live = true;
    photoFiles()
      .then((f) => live && setFiles(f))
      .catch(() => live && setFiles([]));
    return () => {
      live = false;
    };
  }, [open, count]);
  return files;
}

function SaveButton({
  files,
  count,
  onSaved,
  primary,
}: {
  files: File[] | null;
  count: number;
  onSaved: () => void;
  primary?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const Button = primary ? PrimaryButton : SecondaryButton;
  const save = async () => {
    if (!files) return;
    setBusy(true);
    setFailed(false);
    try {
      if (await savePhotos(files)) onSaved();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        block
        icon={<Download aria-hidden />}
        loading={busy || !files}
        onClick={() => void save()}
        data-move-save-photos
      >
        Save {count} {count === 1 ? 'photo' : 'photos'}
      </Button>
      {failed ? (
        <p className="type-meta text-center text-text-2" role="alert">
          Could not save them. Try again, or keep this app until you have.
        </p>
      ) : null}
    </>
  );
}

function SavePhotosSheet({
  count,
  onDone,
  onClose,
}: {
  count: number;
  onDone: () => void;
  onClose: () => void;
}) {
  const files = usePhotoFiles(true, count);
  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Save your progress photos"
      subtitle="Macrotrophy is moving to macrotrophy.in"
      footer={
        <div className="flex w-full flex-col gap-2">
          <SaveButton files={files} count={count} onSaved={onDone} primary />
          <SecondaryButton block onClick={onDone} data-move-skip-photos>
            Move without my photos
          </SecondaryButton>
        </div>
      }
    >
      <div className="type-body flex flex-col gap-3 text-text-2" data-move-photos>
        <p>
          Your {count} progress {count === 1 ? 'photo is' : 'photos are'} kept only in this browser,
          so {count === 1 ? 'it does' : 'they do'} not come along to the new address. Save{' '}
          {count === 1 ? 'it' : 'them'} to your phone first.
        </p>
        <p>Your workouts, meals and everything else are saved to your account and come along.</p>
      </div>
    </BottomSheet>
  );
}

function snoozed(): boolean {
  const until = Number(read(SNOOZE_KEY) ?? 0);
  return Number.isFinite(until) && until > Date.now();
}

function InstallPrompt({
  photos,
  photosDone,
  onPhotosSaved,
  ready,
}: {
  photos: number;
  photosDone: boolean;
  onPhotosSaved: () => void;
  ready: boolean;
}) {
  const [open, setOpen] = useState(false);
  const files = usePhotoFiles(open, photos);

  // Opens after the release announcement, never over a workout or another sheet, and at most
  // once every few days.
  useEffect(() => {
    if (snoozed()) return;
    const check = () => {
      if (
        seenRelease() &&
        !window.location.pathname.startsWith('/workout') &&
        !document.querySelector('dialog[open]')
      ) {
        setOpen(true);
        return true;
      }
      return false;
    };
    if (check()) return;
    const timer = window.setInterval(() => check() && window.clearInterval(timer), 2000);
    return () => window.clearInterval(timer);
  }, []);

  const later = () => {
    write(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86_400_000));
    setOpen(false);
  };

  return (
    <BottomSheet
      open={open}
      onClose={later}
      title="Get the new Macrotrophy app"
      subtitle="Our new address is macrotrophy.in"
      footer={
        <div className="flex w-full flex-col gap-2">
          <a
            href={target ?? 'https://macrotrophy.in/'}
            target="_blank"
            rel="noopener"
            className="pressable chrome type-headline inline-flex h-12 w-full items-center justify-center gap-2 rounded-field bg-lime px-4 text-on-lime"
            data-move-open
          >
            <ExternalLink className="size-5" aria-hidden />
            Open macrotrophy.in
          </a>
          <SecondaryButton block onClick={later}>
            Later
          </SecondaryButton>
        </div>
      }
    >
      <p className="type-body text-text-2">
        This app keeps working. When you are ready, move to the new one in a minute:
      </p>
      <ol className="type-body mt-3 flex flex-col gap-3 text-text-2" data-move-install>
        {photos > 0 ? (
          <Step n={1} done={photosDone}>
            <span>
              Save your {photos} progress {photos === 1 ? 'photo' : 'photos'}. They are kept only on
              this phone and do not come along.
            </span>
            {photosDone ? null : (
              <div className="mt-2">
                <SaveButton files={files} count={photos} onSaved={onPhotosSaved} />
              </div>
            )}
          </Step>
        ) : null}
        <Step n={photos > 0 ? 2 : 1} done={false}>
          Open macrotrophy.in and sign in with the same email. Your workouts, meals, records and Pro
          are all there.{' '}
          {ready ? 'Every change on this phone is saved.' : 'This phone is still saving changes.'}
        </Step>
        <Step n={photos > 0 ? 3 : 2} done={false}>
          Add it to your home screen. iPhone: Share, then Add to Home Screen. Android: the ⋮ menu,
          then Install app.
        </Step>
        <Step n={photos > 0 ? 4 : 3} done={false}>
          Then remove this old icon.
        </Step>
      </ol>
    </BottomSheet>
  );
}

function Step({ n, done, children }: { n: number; done: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className={
          done
            ? 'type-subhead flex size-7 shrink-0 items-center justify-center rounded-full bg-lime text-on-lime'
            : 'type-subhead tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-fill font-semibold text-text-1'
        }
        aria-hidden
      >
        {done ? <Check className="size-4" /> : n}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}
