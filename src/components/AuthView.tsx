import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { AuthUser } from '../services/auth';
import { login, requestPasswordReset, signUp, updatePassword } from '../services/auth';

interface AuthViewProps {
  onAuthenticated: (user: AuthUser) => void;
  globalError?: string;
  passwordRecoveryMode?: boolean;
  onPasswordResetComplete?: (user: AuthUser) => void;
  onCancelRecovery?: () => void;
}

type AuthMode = 'login' | 'signup' | 'forgot' | 'recovery';

const SEO_RESOURCES = [
  { href: '/seo/ai-security-scanner.html', label: 'AI Security Scanner' },
  { href: '/seo/owasp-top-10-scanner.html', label: 'OWASP Top 10 Scanner' },
  { href: '/seo/github-security-scanner.html', label: 'GitHub Security Scanner' },
  { href: '/seo/web-application-security-scanner.html', label: 'Web App Security Scanner' },
  { href: '/seo/devsecops-automated-security-testing.html', label: 'DevSecOps Security Testing' },
  { href: '/seo/index.html', label: 'All Security Guides' }
] as const;

export const AuthView = ({
  onAuthenticated,
  globalError,
  passwordRecoveryMode = false,
  onPasswordResetComplete,
  onCancelRecovery
}: AuthViewProps) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (passwordRecoveryMode) {
      setMode('recovery');
      setError('');
      setNotice('');
      setPassword('');
      setConfirmPassword('');
      return;
    }

    if (mode === 'recovery') {
      setMode('login');
      setError('');
      setNotice('');
      setPassword('');
      setConfirmPassword('');
    }
  }, [mode, passwordRecoveryMode]);

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    setError('');
    setNotice('');

    setIsSubmitting(true);
    try {
      if (mode === 'forgot') {
        if (!normalizedEmail) {
          setError('Email is required.');
          return;
        }

        await requestPasswordReset(normalizedEmail);
        setNotice('Password reset link sent. Check your email to continue.');
        setMode('login');
        return;
      }

      if (mode === 'recovery') {
        if (!password) {
          setError('New password is required.');
          return;
        }

        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          return;
        }

        const user = await updatePassword(password);
        setNotice('Password updated successfully.');
        onPasswordResetComplete?.(user);
        return;
      }

      if (!normalizedEmail || !password) {
        setError('Email and password are required.');
        return;
      }

      if (mode === 'signup') {
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          return;
        }

        const signUpResult = await signUp(normalizedEmail, password);
        if (signUpResult.user) {
          onAuthenticated(signUpResult.user);
          return;
        }

        if (signUpResult.requiresEmailConfirmation) {
          setNotice('Account created. Check your email to confirm your account, then log in.');
          setMode('login');
          setPassword('');
          setConfirmPassword('');
          return;
        }
      }

      const user = await login(normalizedEmail, password);
      onAuthenticated(user);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to authenticate. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoginMode = mode === 'login';
  const isSignUpMode = mode === 'signup';
  const isForgotMode = mode === 'forgot';
  const isRecoveryMode = mode === 'recovery';
  const showEmailField = !isRecoveryMode;
  const showPasswordField = !isForgotMode;
  const showConfirmPasswordField = isSignUpMode || isRecoveryMode;
  const marketingTitle = 'AI Security Scanner for Vibe-Coded Apps';

  const primaryTitle = isRecoveryMode
    ? 'Reset your password'
    : isForgotMode
      ? 'Forgot your password?'
      : isLoginMode
        ? 'Welcome back to Vibesec'
        : 'Create your Vibesec account';

  const formTitle = isRecoveryMode
    ? 'Set new password'
    : isForgotMode
      ? 'Request reset link'
      : isLoginMode
        ? 'Log in'
        : 'Sign up';

  const submitLabel = isSubmitting
    ? 'Please wait...'
    : isRecoveryMode
      ? 'Update Password'
      : isForgotMode
        ? 'Send Reset Link'
        : isLoginMode
          ? 'Log In'
          : 'Create Account';

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-10">
      <div className="grid w-full gap-8 rounded-3xl border border-gray-800 bg-gray-950/50 p-6 backdrop-blur-md md:grid-cols-[1.1fr,1fr] md:p-10">
        <section className="rounded-2xl border border-vibegreen-500/20 bg-gradient-to-b from-vibegreen-500/10 to-transparent p-6 md:p-8">
          <p className="inline-flex items-center gap-2 rounded-full border border-vibegreen-500/30 bg-vibegreen-500/10 px-3 py-1 font-mono text-xs text-vibegreen-400">
            <ShieldCheck size={14} />
            AI Application Security Platform
          </p>
          <h1 className="mt-5 text-3xl font-extrabold text-white md:text-4xl">{marketingTitle}</h1>
          <p className="mt-4 max-w-lg text-sm text-gray-300">
            {primaryTitle}. Use Vibesec to run automated OWASP Top 10 scans, analyze exploit paths, and generate
            practical remediation guidance.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-gray-300">
            <li>Automated web app vulnerability scanning for modern JavaScript stacks.</li>
            <li>Security findings prioritized by severity and exploitability.</li>
            <li>AI-assisted code fix recommendations mapped to each finding.</li>
          </ul>
          <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-xs text-gray-400">
            Authentication is handled by Supabase Auth.
          </div>
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6 md:p-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
            <LockKeyhole size={16} className="text-vibegreen-500" />
            {formTitle}
          </h2>

          <form onSubmit={submitAuth} className="mt-5 space-y-4">
            {showEmailField && (
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-gray-400">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  className="h-11 w-full rounded-xl border border-gray-700 bg-gray-950 px-3 text-sm text-gray-100 outline-none ring-vibegreen-500/30 transition focus:border-vibegreen-500 focus:ring"
                  placeholder="you@company.com"
                />
              </div>
            )}

            {showPasswordField && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-medium uppercase tracking-[0.14em] text-gray-400">
                    {isRecoveryMode ? 'New password' : 'Password'}
                  </label>
                  {isLoginMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError('');
                        setNotice('');
                        setPassword('');
                        setConfirmPassword('');
                      }}
                      className="text-xs font-medium text-vibegreen-400 transition hover:text-vibegreen-300"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={isLoginMode ? 'current-password' : 'new-password'}
                  className="h-11 w-full rounded-xl border border-gray-700 bg-gray-950 px-3 text-sm text-gray-100 outline-none ring-vibegreen-500/30 transition focus:border-vibegreen-500 focus:ring"
                  placeholder="Minimum 8 characters"
                />
              </div>
            )}

            {showConfirmPasswordField && (
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-gray-400">Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  className="h-11 w-full rounded-xl border border-gray-700 bg-gray-950 px-3 text-sm text-gray-100 outline-none ring-vibegreen-500/30 transition focus:border-vibegreen-500 focus:ring"
                  placeholder="Retype password"
                />
              </div>
            )}

            {notice && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{notice}</p>}
            {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
            {globalError && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{globalError}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full rounded-xl bg-vibegreen-500 px-4 text-sm font-semibold text-gray-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700"
            >
              {submitLabel}
            </button>
          </form>

          {!passwordRecoveryMode && !isForgotMode && (
            <p className="mt-5 text-sm text-gray-400">
              {isLoginMode ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(isLoginMode ? 'signup' : 'login');
                  setError('');
                  setNotice('');
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="font-medium text-vibegreen-400 transition hover:text-vibegreen-300"
              >
                {isLoginMode ? 'Sign up' : 'Log in'}
              </button>
            </p>
          )}

          {isForgotMode && (
            <p className="mt-5 text-sm text-gray-400">
              Remembered your password?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setNotice('');
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="font-medium text-vibegreen-400 transition hover:text-vibegreen-300"
              >
                Back to log in
              </button>
            </p>
          )}

          {passwordRecoveryMode && (
            <p className="mt-5 text-sm text-gray-400">
              Need a new reset link?{' '}
              <button
                type="button"
                onClick={() => {
                  onCancelRecovery?.();
                  setMode('forgot');
                  setError('');
                  setNotice('');
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="font-medium text-vibegreen-400 transition hover:text-vibegreen-300"
              >
                Request another link
              </button>
            </p>
          )}
        </section>
      </div>

      <section className="mt-8 w-full rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-300">Security Scanner Guides</h2>
        <p className="mt-2 text-sm text-gray-400">
          Explore practical application security topics and workflows used by engineering teams.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {SEO_RESOURCES.map((resource) => (
            <a
              key={resource.href}
              href={resource.href}
              className="rounded-full border border-vibegreen-500/30 bg-vibegreen-500/10 px-3 py-1 text-xs font-medium text-vibegreen-300 transition hover:border-vibegreen-400 hover:text-vibegreen-200"
            >
              {resource.label}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
};
