import { useEffect, useState, type FormEvent } from 'react';
import { MailCheck } from 'lucide-react';
import {
  AccountError,
  CODE_MAX,
  CODE_MIN,
  cleanCode,
  isIosHomeScreenApp,
  resendSignupCode,
  sendSignInCode,
  signInWithGoogle,
} from '@/app/account';
import { useAppFlags } from '@/app/flags';
import { IconTile, InlineNotice, PrimaryButton, TextField, TextLink } from '@/components/kit';
import { buttonClasses } from '@/components/ui/buttonStyles';

/**
 * Sign-in emails (November 2026): a 6-digit code typed into the app, a plain hint about spam
 * folders, and a resend that waits as long as Supabase does between emails.
 */

/** The address sign-up and sign-in emails come from (Supabase SMTP settings, through Brevo). */
export const AUTH_SENDER = 'no-reply@macrotrophy.in';

/** Supabase sends one email a minute to the same address. */
export const RESEND_WAIT_S = 60;

/** Seconds left before another email can be asked for; ticks down to 0. */
function useCountdown(from: number): [number, () => void] {
  const [left, setLeft] = useState(from);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, () => setLeft(RESEND_WAIT_S)];
}

/** Not in the inbox: where to look, and how to make the next one arrive. */
export function SpamHint() {
  return (
    <div className="rounded-nested bg-surface-2 px-4 py-3" data-spam-hint>
      <p className="type-headline text-text-1">Not in your inbox?</p>
      <p className="type-meta mt-1 text-text-2">
        Look in Spam, Junk or Promotions. If it is there, mark it as not spam and add{' '}
        <span className="font-semibold text-text-1">{AUTH_SENDER}</span> to your contacts, so the
        next one lands in your inbox. It can take a minute to arrive.
      </p>
    </div>
  );
}

/**
 * Typing the code from the email. `signup` confirms a new account; `signin` signs in to an
 * existing one. `onVerify` checks the code and signs in; it throws AccountError with words.
 */
export function CodeEntry({
  email,
  kind,
  onVerify,
  onChangeEmail,
}: {
  email: string;
  kind: 'signup' | 'signin';
  onVerify: (code: string) => Promise<void>;
  onChangeEmail: () => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wait, restart] = useCountdown(RESEND_WAIT_S);
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await onVerify(code);
    } catch (err) {
      setError(
        err instanceof AccountError
          ? err.message
          : 'Something went wrong. Check your connection and try again.',
      );
      setBusy(false);
    }
  }

  async function resend() {
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      if (kind === 'signup') await resendSignupCode(email);
      else await sendSignInCode(email);
      setCode('');
      setNotice('A new code is on its way. Use the newest email: older codes stop working.');
      restart();
    } catch (err) {
      setError(err instanceof AccountError ? err.message : 'Could not send it. Try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5" data-code-entry={kind}>
      <div className="flex items-start gap-4">
        <IconTile icon={<MailCheck />} />
        <div className="min-w-0">
          <h1 className="type-headline text-text-1">Check your email</h1>
          <p className="type-meta mt-1 text-text-2 [text-wrap:balance]">
            We sent a {CODE_MIN}-digit code to{' '}
            <span className="font-semibold break-all text-text-1">{email}</span>.{' '}
            {kind === 'signup'
              ? 'Type it here to confirm your account.'
              : 'Type it here to sign in.'}
          </p>
        </div>
      </div>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <TextField
          label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern={`[0-9]{${CODE_MIN},${CODE_MAX}}`}
          maxLength={CODE_MAX + 4}
          autoFocus
          required
          value={code}
          onChange={(e) => setCode(cleanCode(e.target.value))}
          className="[&_input]:tracking-[0.3em] [&_input]:tabular-nums"
        />
        {error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}
        {notice ? <InlineNotice>{notice}</InlineNotice> : null}
        <PrimaryButton type="submit" block loading={busy} disabled={code.length < CODE_MIN}>
          {kind === 'signup' ? 'Confirm and continue' : 'Sign in'}
        </PrimaryButton>
      </form>
      <SpamHint />
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          className="type-body pressable font-semibold text-lime disabled:text-text-3"
          disabled={wait > 0 || sending}
          onClick={() => void resend()}
          data-resend-code
        >
          {wait > 0 ? `Send a new code in ${wait} s` : sending ? 'Sending...' : 'Send a new code'}
        </button>
        <TextLink onClick={onChangeEmail}>Use a different email</TextLink>
      </div>
      <p className="type-caption text-center text-text-2">
        If the email has a link instead of a code, open it on this phone.
      </p>
    </div>
  );
}

/** Google's mark in its own colours (Google's sign-in branding rules ask for it unchanged). */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5 shrink-0" aria-hidden>
      <path
        style={{ fill: 'var(--google-red)' }}
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        style={{ fill: 'var(--google-blue)' }}
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        style={{ fill: 'var(--google-yellow)' }}
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        style={{ fill: 'var(--google-green)' }}
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/**
 * Continue with Google, and an "or" line under it. Shown only when the owner has switched it on
 * (`google_sign_in`), and never in an iPhone home-screen app, where Google's page would keep
 * the sign-in to itself.
 */
export function GoogleSignIn({ next }: { next: string }) {
  const flags = useAppFlags();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!flags.google_sign_in || isIosHomeScreenApp()) return null;
  return (
    <div className="mb-6 flex flex-col gap-4" data-google-sign-in>
      <button
        type="button"
        className={buttonClasses({ variant: 'secondary', size: 'lg', block: true })}
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError(null);
          signInWithGoogle(next).catch((err: unknown) => {
            setError(
              err instanceof AccountError ? err.message : 'Could not open Google. Try again.',
            );
            setBusy(false);
          });
        }}
      >
        <span className="inline-flex items-center gap-2.5">
          <GoogleMark />
          {busy ? 'Opening Google...' : 'Continue with Google'}
        </span>
      </button>
      {error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-divider" />
        <span className="type-meta text-text-2">or with email</span>
        <span className="h-px flex-1 bg-divider" />
      </div>
    </div>
  );
}
