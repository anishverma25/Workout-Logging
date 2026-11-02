import { useEffect, useState, type FormEvent } from 'react';
import { AtSign } from 'lucide-react';
import {
  checkUsername,
  cleanCode,
  cleanUsername,
  CommunityError,
  createGroup,
  joinGroup,
  setUsername,
  usernameProblem,
  type UsernameCheck,
} from '@/app/community';
import { BottomSheet, InlineNotice, PrimaryButton, TextField } from '@/components/kit';
import { ProfileAvatar } from '@/features/profile/ProfileAvatar';
import { cn } from '@/lib/cn';

/** A member's photo where we have it, else their initials. */
export function MemberAvatar({
  username,
  avatar,
  size = 36,
  className,
}: {
  username: string;
  avatar?: string | null;
  size?: 36 | 56;
  className?: string;
}) {
  return (
    <ProfileAvatar
      name={username.replace(/[._]+/g, ' ')}
      avatar={avatar ?? null}
      size={size}
      className={cn('bg-surface-2', className)}
    />
  );
}

const CHECK_TEXT: Record<Exclude<UsernameCheck, 'ok'>, string> = {
  taken: 'That username is taken. Try another.',
  reserved: 'That username is not available. Try another.',
  invalid: 'Use 3 to 20 letters, numbers, dots or underscores.',
};

/**
 * Choosing the public username others see on leaderboards. Checked as you type (after a short
 * pause) and again on the server when saved, so two people can never end up with the same one.
 */
export function UsernameForm({
  initial,
  onSaved,
  submitLabel = 'Save username',
}: {
  initial?: string | null;
  onSaved: (username: string) => void;
  submitLabel?: string;
}) {
  const [value, setValue] = useState(initial ?? '');
  const [check, setCheck] = useState<{ name: string; result: UsernameCheck } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = cleanUsername(value);
  const problem = name ? usernameProblem(name) : null;
  const unchanged = !!initial && name === initial;

  useEffect(() => {
    if (!name || problem || unchanged) return;
    let live = true;
    const t = setTimeout(() => {
      checkUsername(name).then(
        (result) => {
          if (live) setCheck({ name, result });
        },
        () => undefined,
      );
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [name, problem, unchanged]);

  const result = check?.name === name ? check.result : null;
  const hint = !name
    ? 'Others see this on leaderboards. 3 to 20 letters, numbers, dots or underscores.'
    : problem
      ? problem
      : unchanged
        ? 'This is your username.'
        : result === 'ok'
          ? `@${name} is free.`
          : result
            ? CHECK_TEXT[result]
            : 'Checking…';

  const errorText =
    problem && name.length >= 3
      ? problem
      : !problem && result && result !== 'ok'
        ? CHECK_TEXT[result]
        : undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || problem || busy) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await setUsername(name));
    } catch (err) {
      setError(err instanceof CommunityError ? err.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" data-username-form>
      <TextField
        label="Username"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={24}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="username"
        placeholder="e.g. anish.lifts"
        trailing={<AtSign className="mr-3 size-4 text-text-3" aria-hidden />}
        hint={errorText ? undefined : hint}
        error={errorText}
        data-username-input
      />
      {error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}
      <PrimaryButton
        type="submit"
        block
        loading={busy}
        disabled={!name || !!problem || unchanged || result === 'taken' || result === 'reserved'}
        data-save-username
      >
        {submitLabel}
      </PrimaryButton>
    </form>
  );
}

/** Name a new group; the server gives it a join code. */
export function CreateGroupSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (group: { id: string; name: string; code: string }) => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Create a group">
      {open ? <CreateForm onCreated={onCreated} /> : null}
    </BottomSheet>
  );
}

function CreateForm({
  onCreated,
}: {
  onCreated: (group: { id: string; name: string; code: string }) => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = name.trim().replace(/\s+/g, ' ');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clean || busy) return;
    setBusy(true);
    setError(null);
    try {
      onCreated(await createGroup(clean));
    } catch (err) {
      setError(err instanceof CommunityError ? err.message : 'Could not create it. Try again.');
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3" data-create-group-form>
      <p className="type-meta text-text-2">
        Give it a name your friends will recognise. You get a code to share, and anyone with the
        code can join. Up to 30 people.
      </p>
      <TextField
        label="Group name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        placeholder="e.g. Hostel 4 lifters"
        autoFocus
        data-group-name-input
      />
      {error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}
      <PrimaryButton type="submit" block loading={busy} disabled={!clean} data-create-group>
        Create group
      </PrimaryButton>
    </form>
  );
}

/** Type a friend's code to join their group. */
export function JoinGroupSheet({
  open,
  onClose,
  onJoined,
}: {
  open: boolean;
  onClose: () => void;
  onJoined: (group: { id: string; name: string; already: boolean }) => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Join with a code">
      {open ? <JoinForm onJoined={onJoined} /> : null}
    </BottomSheet>
  );
}

function JoinForm({
  onJoined,
}: {
  onJoined: (group: { id: string; name: string; already: boolean }) => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = cleanCode(code);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (clean.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      onJoined(await joinGroup(clean));
    } catch (err) {
      setError(err instanceof CommunityError ? err.message : 'Could not join. Try again.');
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3" data-join-group-form>
      <p className="type-meta text-text-2">
        Ask a friend in the group for its 6-character code, then type it here.
      </p>
      <TextField
        label="Group code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 9))}
        placeholder="ABC-123"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        autoFocus
        className="[&_input]:tracking-[0.2em] [&_input]:tabular-nums"
        data-group-code-input
      />
      {error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}
      <PrimaryButton
        type="submit"
        block
        loading={busy}
        disabled={clean.length !== 6}
        data-join-group
      >
        Join group
      </PrimaryButton>
    </form>
  );
}
