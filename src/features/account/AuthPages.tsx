import { reportStep } from '@/app/errorReport';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { CloudOff, Crown, MailCheck } from 'lucide-react';
import {
  AccountError,
  AccountExistsError,
  EmailNotConfirmedError,
  isBrandNew,
  MIN_PASSWORD_LENGTH,
  requestPasswordReset,
  resendSignupCode,
  sendSignInCode,
  signIn,
  signUp,
  updatePassword,
  useAccount,
  verifyEmailCode,
} from '@/app/account';
import { APP_NAME } from '@/app/navigation';
import { markTourSeen } from '@/app/seenTour';
import { markReleaseSeen } from '@/app/layout/whatsNewStore';
import {
  IconTile,
  InlineNotice,
  PasswordField,
  PrimaryButton,
  SecondaryButton,
  TextField,
  TextLink,
} from '@/components/kit';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useToast } from '@/components/ui/Toast';
import { TRIAL_HOURS } from '@/domain/entitlement/entitlement';
import { usePageMeta } from '@/app/usePageMeta';
import { safeNext } from './next';
import { AuthArt } from './AuthArt';
import { CodeEntry, GoogleSignIn } from './EmailCode';

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
  art = false,
}: {
  /** Omitted when the content shows its own heading (the email sent state). */
  title?: string;
  intro?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** The picture: above the form on phones, beside it on wide screens (sign up and sign in). */
  art?: boolean;
}) {
  if (art) {
    return (
      <div className="mx-auto grid w-full max-w-100 gap-6 pt-6 pb-8 lg:max-w-5xl lg:grid-cols-2 lg:items-stretch lg:gap-12 lg:pt-12">
        <AuthArt className="lg:order-2" />
        <div className="flex flex-col lg:justify-center">
          <p className="type-title hidden text-text-1 lg:block">{APP_NAME}</p>
          {title ? (
            <h1 className="type-display text-text-1 [text-wrap:balance] lg:mt-4">{title}</h1>
          ) : null}
          {intro ? <p className="type-body mt-2 text-text-2 [text-wrap:balance]">{intro}</p> : null}
          <div className="mt-6">{children}</div>
          {footer ? <div className="mt-6 flex flex-col items-center gap-1">{footer}</div> : null}
        </div>
      </div>
    );
  }
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
  const fromGoogle = params.get('via') === 'google';
  const [email, setEmail] = useState(() => params.get('email') ?? '');
  const [password, setPassword] = useState('');
  /** Password, or an emailed code; `codeFor` is set once a code has been sent. */
  const [mode, setMode] = useState<'password' | 'code'>('password');
  const [codeFor, setCodeFor] = useState<{ email: string; kind: 'signup' | 'signin' } | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const { busy, error, onSubmit } = useSubmit(async () => {
    setUnconfirmed(false);
    if (mode === 'code') {
      await sendSignInCode(email.trim());
      setCodeFor({ email: email.trim(), kind: 'signin' });
      return;
    }
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      if (err instanceof EmailNotConfirmedError) setUnconfirmed(true);
      throw err;
    }
    markTourSeen();
    navigate(next, { replace: true });
  });
  const confirmNow = useSubmit(async () => {
    await resendSignupCode(email.trim());
    setCodeFor({ email: email.trim(), kind: 'signup' });
  });

  // Back from Google: a brand new account counts as a sign-up (and goes to setup by itself).
  const signedIn = account.status === 'signedIn';
  const createdAt = account.user?.createdAt;
  useEffect(() => {
    if (!signedIn || !fromGoogle) return;
    markTourSeen();
    if (isBrandNew(createdAt)) {
      reportStep('signed_up');
      markReleaseSeen();
      navigate(`/setup?next=${encodeURIComponent(next)}`, { replace: true });
    } else navigate(next, { replace: true });
  }, [signedIn, fromGoogle, createdAt, navigate, next]);

  if (account.status === 'unavailable') return <AccountsUnavailable />;
  if (signedIn && fromGoogle) return null;
  if (signedIn && !busy && !codeFor) return <Navigate to={next} replace />;

  if (codeFor) {
    return (
      <AuthLayout>
        <CodeEntry
          email={codeFor.email}
          kind={codeFor.kind}
          onChangeEmail={() => setCodeFor(null)}
          onVerify={async (code) => {
            await verifyEmailCode(codeFor.email, code, codeFor.kind);
            markTourSeen();
            navigate(next, { replace: true });
          }}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      art
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
      <GoogleSignIn next={next} />
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
        {mode === 'password' ? (
          <PasswordField
            label="Password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        ) : (
          <p className="type-meta text-text-2">We email you a 6-digit code. No password needed.</p>
        )}
        <FormError error={error ?? confirmNow.error} />
        {unconfirmed && mode === 'password' ? (
          <SecondaryButton
            type="button"
            block
            loading={confirmNow.busy}
            onClick={(e) => void confirmNow.onSubmit(e)}
          >
            Send me a code to confirm
          </SecondaryButton>
        ) : null}
        <PrimaryButton type="submit" block disabled={busy} className="mt-2">
          {mode === 'code'
            ? busy
              ? 'Sending code...'
              : 'Email me a code'
            : busy
              ? 'Signing in...'
              : 'Sign in'}
        </PrimaryButton>
        <TextLink
          className="self-center"
          onClick={() => {
            setMode(mode === 'password' ? 'code' : 'password');
            setUnconfirmed(false);
          }}
        >
          {mode === 'password' ? 'Use an email code instead' : 'Use my password instead'}
        </TextLink>
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
  const [exists, setExists] = useState(false);
  const { busy, error, onSubmit } = useSubmit(async () => {
    setExists(false);
    let result: Awaited<ReturnType<typeof signUp>>;
    try {
      result = await signUp(email.trim(), password);
    } catch (err) {
      if (err instanceof AccountExistsError) setExists(true);
      throw err;
    }
    reportStep('signed_up');
    markTourSeen();
    // A new account has never used the old app: no notes on what changed in it.
    markReleaseSeen();
    if (result === 'confirm') setSentTo(email.trim());
    // A new account always goes through setup first; where they were headed comes after it.
    else navigate(`/setup?next=${encodeURIComponent(next)}`, { replace: true });
  });

  if (account.status === 'unavailable') return <AccountsUnavailable />;
  // Once a code confirms the account, onVerify itself goes to setup.
  if (account.status === 'signedIn' && !busy && !sentTo) return <Navigate to={next} replace />;

  if (sentTo) {
    return (
      <AuthLayout>
        <CodeEntry
          email={sentTo}
          kind="signup"
          onChangeEmail={() => setSentTo(null)}
          onVerify={async (code) => {
            await verifyEmailCode(sentTo, code, 'signup');
            // Confirmed and signed in: a new account always goes through setup first.
            navigate(`/setup?next=${encodeURIComponent(next)}`, { replace: true });
          }}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      art
      title="Create account"
      intro={ACCOUNT_PITCH}
      footer={
        <FooterLine lead="Already have an account?">
          <TextLink to={`/sign-in?next=${encodeURIComponent(next)}`}>Sign in</TextLink>
        </FooterLine>
      }
    >
      <GoogleSignIn next={next} />
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
        {exists && error ? (
          <BlockLink
            to={`/sign-in?next=${encodeURIComponent(next)}&email=${encodeURIComponent(email.trim())}`}
          >
            Sign in with this email
          </BlockLink>
        ) : null}
        <PrimaryButton type="submit" block disabled={busy} className="mt-2">
          {busy ? 'Creating account...' : 'Create account'}
        </PrimaryButton>
        <p className="type-meta text-text-2">
          Next: a few quick questions, and your plan is ready.
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
