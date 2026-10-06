import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { CloudOff, MailCheck } from 'lucide-react';
import {
  AccountError,
  MIN_PASSWORD_LENGTH,
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
  useAccount,
} from '@/app/account';
import { BrandMark } from '@/app/layout/BrandMark';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Fields';
import { useToast } from '@/components/ui/Toast';
import { safeNext } from './next';

function AuthCard({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 pt-8 lg:pt-16">
      <div className="flex items-center gap-3">
        <BrandMark className="size-9" />
        <h1 className="font-display text-[1.4rem] font-bold leading-none">{title}</h1>
      </div>
      {intro ? <p className="text-muted">{intro}</p> : null}
      <Card className="p-5">{children}</Card>
      {footer ? <div className="flex flex-col gap-2 text-sm text-muted">{footer}</div> : null}
    </div>
  );
}

export function AccountsUnavailable() {
  return (
    <AuthCard title="Accounts">
      <div className="flex gap-3">
        <CloudOff className="mt-0.5 size-5 shrink-0 text-faint" aria-hidden />
        <p className="text-muted">
          Accounts are not set up in this version of the app. Everything you log is saved on this
          device.
        </p>
      </div>
    </AuthCard>
  );
}

function useSubmit(action: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(
        err instanceof AccountError
          ? err.message
          : 'Something went wrong. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, onSubmit };
}

function FormError({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
      {error}
    </p>
  ) : null;
}

function ShowPassword({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm text-muted">
      <input
        type="checkbox"
        className="size-4 accent-[var(--color-accent)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      Show password
    </label>
  );
}

const ACCOUNT_PITCH =
  'An account backs up your training and keeps it the same on all your devices. Without one, everything stays on this device.';

export function SignInPage() {
  const account = useAccount();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const { busy, error, onSubmit } = useSubmit(async () => {
    await signIn(email.trim(), password);
    navigate(next, { replace: true });
  });

  if (account.status === 'unavailable') return <AccountsUnavailable />;
  if (account.status === 'signedIn' && !busy) return <Navigate to={next} replace />;

  return (
    <AuthCard
      title="Sign in"
      intro={ACCOUNT_PITCH}
      footer={
        <>
          <p>
            New here?{' '}
            <Link
              className="tap-target font-semibold text-accent-text"
              to={`/sign-up?next=${encodeURIComponent(next)}`}
            >
              Create an account
            </Link>
          </p>
          <p>
            <Link className="tap-target font-semibold text-accent-text" to="/forgot-password">
              Forgot your password?
            </Link>
          </p>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate={false}>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <ShowPassword checked={show} onChange={setShow} />
        <FormError error={error} />
        <Button type="submit" size="lg" block disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </AuthCard>
  );
}

export function SignUpPage() {
  const account = useAccount();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { busy, error, onSubmit } = useSubmit(async () => {
    const result = await signUp(email.trim(), password);
    if (result === 'confirm') setSentTo(email.trim());
    else navigate(next, { replace: true });
  });

  if (account.status === 'unavailable') return <AccountsUnavailable />;
  if (account.status === 'signedIn' && !busy) return <Navigate to={next} replace />;

  if (sentTo) {
    return (
      <AuthCard title="Check your email">
        <div className="flex gap-3">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-accent-text" aria-hidden />
          <p className="text-muted">
            We sent a link to <span className="font-semibold text-text">{sentTo}</span>. Open it to
            confirm your account, then sign in. It can take a minute to arrive.
          </p>
        </div>
        <ButtonLink to="/sign-in" variant="secondary" block className="mt-5">
          Go to sign in
        </ButtonLink>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create account"
      intro={ACCOUNT_PITCH}
      footer={
        <p>
          Already have an account?{' '}
          <Link
            className="tap-target font-semibold text-accent-text"
            to={`/sign-in?next=${encodeURIComponent(next)}`}
          >
            Sign in
          </Link>
        </p>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <ShowPassword checked={show} onChange={setShow} />
        <FormError error={error} />
        <Button type="submit" size="lg" block disabled={busy}>
          {busy ? 'Creating account...' : 'Create account'}
        </Button>
        <p className="text-sm text-faint">
          Your account starts empty. If you have logged workouts on this device, you can choose to
          add them after signing in.
        </p>
      </form>
    </AuthCard>
  );
}

export function ForgotPasswordPage() {
  const account = useAccount();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { busy, error, onSubmit } = useSubmit(async () => {
    await requestPasswordReset(email.trim());
    setSent(true);
  });

  if (account.status === 'unavailable') return <AccountsUnavailable />;

  if (sent) {
    return (
      <AuthCard title="Check your email">
        <div className="flex gap-3">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-accent-text" aria-hidden />
          <p className="text-muted">
            If there is an account for that email, a link to choose a new password is on its way. It
            can take a minute to arrive.
          </p>
        </div>
        <ButtonLink to="/sign-in" variant="secondary" block className="mt-5">
          Back to sign in
        </ButtonLink>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset password"
      intro="Enter the email you signed up with and we will send you a link to choose a new password."
      footer={
        <p>
          <Link className="tap-target font-semibold text-accent-text" to="/sign-in">
            Back to sign in
          </Link>
        </p>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormError error={error} />
        <Button type="submit" size="lg" block disabled={busy}>
          {busy ? 'Sending...' : 'Send reset link'}
        </Button>
      </form>
    </AuthCard>
  );
}

/** Reached from the reset email (a recovery session) or from Account to change the password. */
export function NewPasswordPage() {
  const account = useAccount();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const { busy, error, onSubmit } = useSubmit(async () => {
    await updatePassword(password);
    toast('Password updated');
    navigate('/account', { replace: true });
  });

  if (account.status === 'unavailable') return <AccountsUnavailable />;
  if (account.status === 'loading') return null;
  if (account.status !== 'signedIn') {
    return (
      <AuthCard title="Link expired">
        <p className="text-muted">
          This reset link has expired or was already used. Request a new one to choose a new
          password.
        </p>
        <ButtonLink to="/forgot-password" block className="mt-5">
          Request a new link
        </ButtonLink>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="New password"
      intro={account.user?.email ? `For ${account.user.email}.` : undefined}
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <TextField
          label="New password"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <ShowPassword checked={show} onChange={setShow} />
        <FormError error={error} />
        <Button type="submit" size="lg" block disabled={busy}>
          {busy ? 'Saving...' : 'Save new password'}
        </Button>
      </form>
    </AuthCard>
  );
}
