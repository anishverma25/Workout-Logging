import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { CloudOff, Crown, MailCheck } from 'lucide-react';
import {
  AccountError,
  MIN_PASSWORD_LENGTH,
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
  useAccount,
} from '@/app/account';
import { APP_NAME } from '@/app/navigation';
import { markTourSeen } from '@/app/seenTour';
import {
  IconTile,
  InlineNotice,
  PasswordField,
  PrimaryButton,
  TextField,
  TextLink,
} from '@/components/kit';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useToast } from '@/components/ui/Toast';
import { TRIAL_HOURS } from '@/domain/entitlement/entitlement';
import { usePageMeta } from '@/app/usePageMeta';
import { safeNext } from './next';

const TRIAL_DAYS = Math.round(TRIAL_HOURS / 24);

/**
 * Centred column, max width 400: the app name in Title, the screen title in Display and one
 * Body --text-2 line under it. Secondary actions sit below as text links.
 */
function AuthLayout({
  title,
  intro,
  children,
  footer,
}: {
  /** Omitted when the content shows its own heading (the email sent state). */
  title?: string;
  intro?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-100 flex-col pt-8 pb-8 lg:pt-16">
      <p className="type-title text-text-1">{APP_NAME}</p>
      {title ? (
        <h1 className="type-display mt-6 text-text-1 [text-wrap:balance]">{title}</h1>
      ) : null}
      {intro ? <p className="type-body mt-2 text-text-2 [text-wrap:balance]">{intro}</p> : null}
      <div className={title ? 'mt-8' : 'mt-6'}>{children}</div>
      {footer ? <div className="mt-6 flex flex-col items-center gap-1">{footer}</div> : null}
    </div>
  );
}

/** A full-width link drawn as a button, for the one action on a state screen. */
function BlockLink({
  to,
  children,
  variant = 'secondary',
}: {
  to: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Link to={to} className={buttonClasses({ variant, size: 'lg', block: true })}>
      {children}
    </Link>
  );
}

/** Email sent: mail icon tile, Headline, Meta --text-2 with the address. */
function EmailSent({ children, action }: { children: ReactNode; action: ReactNode }) {
  return (
    <AuthLayout>
      <div className="flex flex-col items-start gap-4">
        <IconTile icon={<MailCheck />} />
        <div>
          <h1 className="type-headline text-text-1">Check your email</h1>
          <p className="type-meta mt-1 text-text-2 [text-wrap:balance]">{children}</p>
        </div>
      </div>
      <div className="mt-8">{action}</div>
    </AuthLayout>
  );
}

export function AccountsUnavailable() {
  return (
    <AuthLayout title="Accounts">
      <InlineNotice icon={<CloudOff />}>
        Accounts are not set up in this version of the app. Everything you log is saved on this
        device.
      </InlineNotice>
    </AuthLayout>
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

/** Server errors: one form-level notice, read out as an alert. */
function FormError({ error }: { error: string | null }) {
  return error ? <InlineNotice tone="warning">{error}</InlineNotice> : null;
}

/** "New here? Create an account": Body --text-2 lead-in with a neutral text link. */
function FooterLine({ lead, children }: { lead?: string; children: ReactNode }) {
  return (
    <p className="type-body text-center text-text-2">
      {lead ? <>{lead} </> : null}
      {children}
    </p>
  );
}

const ACCOUNT_PITCH =
  'Your account keeps every workout backed up and the same on every device you train with.';

/** After signing in there is always somewhere to go: the app needs an account to open at all. */
const HOME = '/';

export function SignInPage() {
  usePageMeta('/sign-in');
  const account = useAccount();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'), HOME);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, onSubmit } = useSubmit(async () => {
    await signIn(email.trim(), password);
    markTourSeen();
    navigate(next, { replace: true });
  });

  if (account.status === 'unavailable') return <AccountsUnavailable />;
  if (account.status === 'signedIn' && !busy) return <Navigate to={next} replace />;

  return (
    <AuthLayout
      title="Sign in"
      intro="Welcome back. Everything you logged is waiting."
      footer={
        <>
          <FooterLine lead="New here?">
            <TextLink to={`/sign-up?next=${encodeURIComponent(next)}`}>Create an account</TextLink>
          </FooterLine>
          <FooterLine>
            <TextLink to="/forgot-password">Forgot your password?</TextLink>
          </FooterLine>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate={false}>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError error={error} />
        <PrimaryButton type="submit" block disabled={busy} className="mt-2">
          {busy ? 'Signing in...' : 'Sign in'}
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}

export function SignUpPage() {
  usePageMeta('/sign-up');
  const account = useAccount();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'), HOME);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { busy, error, onSubmit } = useSubmit(async () => {
    const result = await signUp(email.trim(), password);
    markTourSeen();
    if (result === 'confirm') setSentTo(email.trim());
    // Someone who was on their way to a particular screen keeps going there. Otherwise a new
    // account is asked whether they are coming from Hevy or Strong, then goes through setup.
    else
      navigate(
        params.get('next') ? next : `/import?welcome=1&next=${encodeURIComponent('/setup?next=/')}`,
        { replace: true },
      );
  });

  if (account.status === 'unavailable') return <AccountsUnavailable />;
  if (account.status === 'signedIn' && !busy) return <Navigate to={next} replace />;

  if (sentTo) {
    return (
      <EmailSent action={<BlockLink to="/sign-in">Go to sign in</BlockLink>}>
        We sent a link to <span className="font-semibold text-text-1">{sentTo}</span>. Open it to
        confirm your account, then sign in. It can take a minute to arrive.
      </EmailSent>
    );
  }

  return (
    <AuthLayout
      title="Create account"
      intro={ACCOUNT_PITCH}
      footer={
        <FooterLine lead="Already have an account?">
          <TextLink to={`/sign-in?next=${encodeURIComponent(next)}`}>Sign in</TextLink>
        </FooterLine>
      }
    >
      <div className="mb-6 flex items-start gap-3 rounded-nested bg-surface-2 px-4 py-3">
        <IconTile pro icon={<Crown />} />
        <p className="type-meta text-text-2">
          <strong className="font-semibold text-text-1">
            Pro is free for your first {TRIAL_DAYS} days.
          </strong>{' '}
          Every analysis feature, no payment details needed.
        </p>
      </div>
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError error={error} />
        <PrimaryButton type="submit" block disabled={busy} className="mt-2">
          {busy ? 'Creating account...' : 'Create account'}
        </PrimaryButton>
        <p className="type-meta text-text-2">
          Next: seven quick questions, and your plan is ready.
        </p>
        <p className="type-meta text-text-2">
          By creating an account you agree to the <TextLink to="/terms">Terms</TextLink> and the{' '}
          <TextLink to="/privacy">Privacy policy</TextLink>.
        </p>
      </form>
    </AuthLayout>
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
      <EmailSent action={<BlockLink to="/sign-in">Back to sign in</BlockLink>}>
        If there is an account for that email, a link to choose a new password is on its way. It can
        take a minute to arrive.
      </EmailSent>
    );
  }

  return (
    <AuthLayout
      title="Reset password"
      intro="Enter the email you signed up with and we will send you a link to choose a new password."
      footer={
        <FooterLine>
          <TextLink to="/sign-in">Back to sign in</TextLink>
        </FooterLine>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormError error={error} />
        <PrimaryButton type="submit" block disabled={busy} className="mt-2">
          {busy ? 'Sending...' : 'Send reset link'}
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}

/** Reached from the reset email (a recovery session) or from Account to change the password. */
export function NewPasswordPage() {
  const account = useAccount();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const { busy, error, onSubmit } = useSubmit(async () => {
    await updatePassword(password);
    toast('Password updated');
    navigate('/account', { replace: true });
  });

  if (account.status === 'unavailable') return <AccountsUnavailable />;
  if (account.status === 'loading') return null;
  if (account.status !== 'signedIn') {
    return (
      <AuthLayout
        title="Link expired"
        intro="This reset link has expired or was already used. Request a new one to choose a new password."
      >
        <BlockLink to="/forgot-password" variant="primary">
          Request a new link
        </BlockLink>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="New password"
      intro={account.user?.email ? `For ${account.user.email}.` : undefined}
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <PasswordField
          label="New password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError error={error} />
        <PrimaryButton type="submit" block disabled={busy} className="mt-2">
          {busy ? 'Saving...' : 'Save new password'}
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}
