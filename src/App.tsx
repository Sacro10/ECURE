import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { LogOut, Settings as SettingsIcon } from 'lucide-react';
import { AuthView } from './components/AuthView';
import { BrandLogo } from './components/BrandLogo';
import { HomeView } from './components/HomeView';
import { ScannerView } from './components/ScannerView';
import { SettingsView } from './components/SettingsView';
import { buildMockResult } from './data/mockData';
import type { AuthUser } from './services/auth';
import { clearRecoveryParamsInUrl, getCurrentUser, isRecoverySessionInUrl, logout, subscribeToAuthState } from './services/auth';
import { fetchUsageSummary, recordUsage, setPlan, type BillingPlanCode, type BillingUsageSummary } from './services/billing';
import { confirmStripeCheckoutSession, redirectToStripeCheckout } from './services/stripe';
import type { ScanResult, Vulnerability } from './types';

type ViewState = 'home' | 'scanning' | 'results' | 'settings';

const ResultsDashboard = lazy(async () => {
  const module = await import('./components/ResultsDashboard');
  return { default: module.ResultsDashboard };
});

const FixModal = lazy(async () => {
  const module = await import('./components/FixModal');
  return { default: module.FixModal };
});

const GlobalBrand = () => (
  <div className="pointer-events-none fixed left-4 top-4 z-40 md:left-6 md:top-5">
    <BrandLogo className="h-12 md:h-14" />
  </div>
);

const SiteFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative z-30 border-t border-white/10 px-6 py-4 text-xs text-gray-400">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <a href="/terms-and-conditions.html" target="_blank" rel="noreferrer" className="transition hover:text-vibegreen-500">
            Terms and Conditions
          </a>
          <a href="/privacy-policy.html" target="_blank" rel="noreferrer" className="transition hover:text-vibegreen-500">
            Privacy Policy
          </a>
        </div>
        <p>Copyright (c) {currentYear} Vibesec. All rights reserved.</p>
      </div>
    </footer>
  );
};

const toUiErrorMessage = (error: unknown, fallback: string) => {
  const rawMessage = error instanceof Error ? error.message : fallback;
  const message = typeof rawMessage === 'string' ? rawMessage.trim() : '';

  if (!message) {
    return fallback;
  }

  return message;
};

const App = () => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authBootstrapError, setAuthBootstrapError] = useState('');
  const [isRecoveryMode, setIsRecoveryMode] = useState(() => isRecoverySessionInUrl());
  const [usageSummary, setUsageSummary] = useState<BillingUsageSummary | null>(null);
  const [usageNotice, setUsageNotice] = useState('');
  const [isStartingScan, setIsStartingScan] = useState(false);
  const [planChangeTarget, setPlanChangeTarget] = useState<BillingPlanCode | null>(null);
  const [view, setView] = useState<ViewState>('home');
  const [targetUrl, setTargetUrl] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedVulnerability, setSelectedVulnerability] = useState<Vulnerability | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const checkoutHandledRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get('checkout');
    const sessionId = params.get('session_id');

    if (window.location.hash === '#settings') {
      setView('settings');
    }

    if (!checkoutStatus) {
      return;
    }

    const clearCheckoutParams = () => {
      params.delete('checkout');
      params.delete('session_id');
      const cleaned = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', cleaned);
    };

    setView('settings');

    if (checkoutStatus === 'canceled') {
      setUsageNotice('Checkout canceled.');
      clearCheckoutParams();
      return;
    }

    if (checkoutStatus !== 'success') {
      clearCheckoutParams();
      return;
    }

    if (checkoutHandledRef.current || !authUser) {
      return;
    }

    checkoutHandledRef.current = true;
    let isCancelled = false;

    const finalizeCheckout = async () => {
      setUsageNotice('Finalizing checkout...');
      try {
        const summary = await confirmStripeCheckoutSession(sessionId ?? '');
        if (!isCancelled && summary) {
          setUsageSummary(summary);
        }
        if (!isCancelled) {
          setUsageNotice('Plan updated successfully.');
        }
      } catch (error) {
        if (!isCancelled) {
          setUsageNotice(toUiErrorMessage(error, 'Unable to finalize checkout.'));
        }
      } finally {
        if (!isCancelled) {
          clearCheckoutParams();
        }
      }
    };

    void finalizeCheckout();

    return () => {
      isCancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        const sessionUser = await getCurrentUser();
        if (isMounted) {
          setAuthUser(sessionUser);
          setAuthBootstrapError('');
        }
      } catch (error) {
        if (isMounted) {
          setAuthBootstrapError(toUiErrorMessage(error, 'Unable to load auth session.'));
        }
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    };

    loadSession();

    let unsubscribe: (() => void) | null = null;
    try {
      const subscription = subscribeToAuthState((nextUser, event) => {
        if (!isMounted) {
          return;
        }

        setAuthUser(nextUser);
        setIsAuthLoading(false);
        if (event === 'PASSWORD_RECOVERY') {
          setIsRecoveryMode(true);
          setAuthBootstrapError('');
        }
        if (!nextUser) {
          if (event !== 'PASSWORD_RECOVERY') {
            setIsRecoveryMode(false);
          }
          setUsageSummary(null);
          setUsageNotice('');
          setPlanChangeTarget(null);
          setTargetUrl('');
          setScanResult(null);
          setSelectedVulnerability(null);
          setView('home');
        }
      });

      unsubscribe = () => subscription.unsubscribe();
    } catch (error) {
      if (isMounted) {
        setAuthBootstrapError(toUiErrorMessage(error, 'Unable to initialize auth listeners.'));
        setIsAuthLoading(false);
      }
    }

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    let isCancelled = false;

    const loadUsageSummary = async () => {
      try {
        const summary = await fetchUsageSummary();
        if (!isCancelled) {
          setUsageSummary(summary);
          setUsageNotice('');
        }
      } catch (error) {
        if (!isCancelled) {
          setUsageNotice(toUiErrorMessage(error, 'Unable to load usage.'));
        }
      }
    };

    loadUsageSummary();

    return () => {
      isCancelled = true;
    };
  }, [authUser]);

  const startScan = async (url: string) => {
    setUsageNotice('');
    setIsStartingScan(true);
    try {
      const decision = await recordUsage('scan_run', { target_url: url });
      setUsageSummary(decision.summary);

      if (!decision.allowed) {
        setUsageNotice(decision.reason ?? 'Scan quota reached for this billing period.');
        return;
      }

      setTargetUrl(url);
      setSelectedVulnerability(null);
      setView('scanning');
    } catch (error) {
      setUsageNotice(toUiErrorMessage(error, 'Unable to start scan.'));
    } finally {
      setIsStartingScan(false);
    }
  };

  const handlePlanChange = async (planCode: BillingPlanCode) => {
    setUsageNotice('');
    setPlanChangeTarget(planCode);

    try {
      if (planCode === 'starter') {
        const summary = await setPlan(planCode);
        setUsageSummary(summary);
        return;
      }

      await redirectToStripeCheckout(planCode);
    } catch (error) {
      setUsageNotice(toUiErrorMessage(error, 'Unable to change plan.'));
    } finally {
      setPlanChangeTarget(null);
    }
  };

  const handleOpenSettings = () => {
    setIsAccountMenuOpen(false);
    setView('settings');
  };

  const completeScan = () => {
    setScanResult(buildMockResult(targetUrl));
    setView('results');
  };

  const resetApp = () => {
    setTargetUrl('');
    setScanResult(null);
    setSelectedVulnerability(null);
    setView('home');
  };

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const menuElement = accountMenuRef.current;
      if (menuElement && !menuElement.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isAccountMenuOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      setIsAccountMenuOpen(false);
      setAuthUser(null);
      setAuthBootstrapError('');
      setIsRecoveryMode(false);
      setUsageSummary(null);
      setUsageNotice('');
      setPlanChangeTarget(null);
      resetApp();
    } catch (error) {
      setAuthBootstrapError(toUiErrorMessage(error, 'Unable to log out.'));
    }
  };

  const userInitial = authUser?.email.trim().charAt(0).toUpperCase() || 'U';

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#030712] text-gray-100">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(16,185,129,0.12),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(99,102,241,0.14),transparent_40%)]" />
        <GlobalBrand />
        <main className="relative flex flex-1 items-center justify-center px-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-vibegreen-500">Loading session...</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="flex min-h-screen flex-col bg-[#030712] text-gray-100">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(16,185,129,0.12),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(99,102,241,0.14),transparent_40%)]" />
        <GlobalBrand />
        <div className="relative flex-1">
          <AuthView
            onAuthenticated={(user) => {
              setAuthBootstrapError('');
              setAuthUser(user);
            }}
            globalError={authBootstrapError}
            passwordRecoveryMode={isRecoveryMode}
            onPasswordResetComplete={(user) => {
              setAuthBootstrapError('');
              setIsRecoveryMode(false);
              clearRecoveryParamsInUrl();
              setAuthUser(user);
            }}
            onCancelRecovery={() => {
              setIsRecoveryMode(false);
              clearRecoveryParamsInUrl();
            }}
          />
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (isRecoveryMode) {
    return (
      <div className="flex min-h-screen flex-col bg-[#030712] text-gray-100">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(16,185,129,0.12),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(99,102,241,0.14),transparent_40%)]" />
        <GlobalBrand />
        <div className="relative flex-1">
          <AuthView
            onAuthenticated={setAuthUser}
            globalError={authBootstrapError}
            passwordRecoveryMode
            onPasswordResetComplete={(user) => {
              setAuthBootstrapError('');
              setIsRecoveryMode(false);
              clearRecoveryParamsInUrl();
              setAuthUser(user);
            }}
            onCancelRecovery={() => {
              setIsRecoveryMode(false);
              clearRecoveryParamsInUrl();
            }}
          />
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#030712] text-gray-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(16,185,129,0.12),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(99,102,241,0.14),transparent_40%)]" />
      <header className="relative z-30 px-4 sm:px-6">
        <div className="mx-auto flex h-28 w-full max-w-6xl items-center justify-between gap-4 sm:h-32">
          <div className="flex h-full items-center">
            <BrandLogo className="h-[69%] w-auto" />
          </div>

          <div className="relative" ref={accountMenuRef}>
            <div className="pointer-events-none absolute -inset-2 rounded-3xl bg-[radial-gradient(circle_at_80%_30%,rgba(16,185,129,0.25),transparent_55%)] blur-xl" />
            <button
              type="button"
              onClick={() => setIsAccountMenuOpen((open) => !open)}
              className="group relative inline-flex max-w-[calc(100vw-2rem)] items-center gap-3 overflow-hidden rounded-2xl border border-[#2b4668] bg-[linear-gradient(140deg,rgba(8,19,40,0.96),rgba(8,26,53,0.94))] px-3 py-2 text-left shadow-[0_14px_36px_rgba(3,8,20,0.62)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-[#3f6691] hover:shadow-[0_18px_40px_rgba(3,12,28,0.72)] sm:max-w-[24rem] sm:px-4 sm:py-3"
              aria-haspopup="menu"
              aria-expanded={isAccountMenuOpen}
            >
              <span className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_20%_-20%,rgba(16,185,129,0.23),transparent_45%),radial-gradient(circle_at_95%_120%,rgba(99,102,241,0.24),transparent_50%)]" />
              <span className="relative min-w-0 flex-1 truncate text-sm font-semibold text-slate-100 sm:text-[1.08rem]">{authUser.email}</span>
              <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d5fff2] bg-[#b8ffe8] text-base font-extrabold text-[#063025] shadow-[0_8px_18px_rgba(16,185,129,0.35)] transition group-hover:scale-[1.04]">
                {userInitial}
              </span>
            </button>

            {isAccountMenuOpen && (
              <div className="absolute right-0 mt-3 w-[17rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[#2c4768] bg-[linear-gradient(165deg,rgba(8,20,43,0.98),rgba(8,28,58,0.97))] shadow-[0_22px_50px_rgba(2,8,21,0.78)] backdrop-blur">
                <button
                  type="button"
                  onClick={handleOpenSettings}
                  className="inline-flex w-full items-center gap-3 px-4 py-4 text-base font-semibold text-slate-100 transition hover:bg-white/5"
                >
                  <SettingsIcon size={18} />
                  Settings
                </button>
                <div className="h-px bg-white/10" />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex w-full items-center gap-3 px-4 py-4 text-base font-semibold text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200"
                >
                  <LogOut size={18} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="relative flex-1 py-4">
        {view === 'home' && (
          <HomeView initialUrl={targetUrl} onStartScan={startScan} scanCtaDisabled={isStartingScan} notice={usageNotice} />
        )}
        {view === 'scanning' && <ScannerView targetUrl={targetUrl} onComplete={completeScan} />}
        {view === 'results' && scanResult && (
          <Suspense fallback={<div className="mx-auto max-w-6xl px-6 py-14 text-sm text-gray-400">Loading report...</div>}>
            <ResultsDashboard
              result={scanResult}
              onReset={resetApp}
              onFixClick={(vulnerability) => setSelectedVulnerability(vulnerability)}
            />
          </Suspense>
        )}
        {view === 'settings' && (
          <SettingsView
            usageSummary={usageSummary}
            currentPlan={usageSummary?.planCode ?? 'starter'}
            onPlanChange={handlePlanChange}
            planChangeTarget={planChangeTarget}
            notice={usageNotice}
            onBack={() => {
              setUsageNotice('');
              setView('home');
            }}
          />
        )}
      </main>
      <SiteFooter />

      {selectedVulnerability && (
        <Suspense fallback={null}>
          <FixModal
            vulnerability={selectedVulnerability}
            techStack={scanResult?.techStack ?? []}
            onUsageSummary={setUsageSummary}
            onClose={() => setSelectedVulnerability(null)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default App;
