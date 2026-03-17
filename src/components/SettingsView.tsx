import { ArrowLeft, Check } from 'lucide-react';
import type { BillingPlanCode, BillingUsageSummary } from '../services/billing';

interface SettingsViewProps {
  usageSummary: BillingUsageSummary | null;
  currentPlan: BillingPlanCode;
  onPlanChange: (planCode: BillingPlanCode) => void | Promise<void>;
  planChangeTarget?: BillingPlanCode | null;
  notice?: string;
  onBack: () => void;
}

const toPercent = (used: number, included: number) => {
  if (included <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((Math.min(used, included) / included) * 100));
};

export const SettingsView = ({
  usageSummary,
  currentPlan,
  onPlanChange,
  planChangeTarget = null,
  notice = '',
  onBack
}: SettingsViewProps) => {
  const tiers = [
    {
      code: 'starter' as BillingPlanCode,
      title: 'Starter',
      priceLabel: 'Free',
      description: 'Perfect for getting started',
      features: ['5 scans per month', '10 AI fixes included', 'Core vulnerability dashboard', 'Community support']
    },
    {
      code: 'pro' as BillingPlanCode,
      title: 'Pro',
      priceLabel: '$29/month',
      description: 'For growing engineering teams',
      features: ['100 scans per month', '300 AI fixes included', '$0.03 per extra AI fix', 'Priority support'],
      isPopular: true
    },
    {
      code: 'team' as BillingPlanCode,
      title: 'Team',
      priceLabel: '$99/month',
      description: 'For high-volume shipping teams',
      features: ['500 scans per month', '2,000 AI fixes included', '$0.02 per extra AI fix', '5 included team seats']
    }
  ];

  const planOrder: Record<BillingPlanCode, number> = {
    starter: 0,
    pro: 1,
    team: 2
  };

  const buildActionLabel = (target: BillingPlanCode, title: string) => {
    if (currentPlan === target) {
      return 'Current Plan';
    }

    return planOrder[target] > planOrder[currentPlan] ? `Upgrade to ${title}` : `Switch to ${title}`;
  };

  const handlePlanClick = (planCode: BillingPlanCode) => {
    if (planCode === currentPlan || planChangeTarget) {
      return;
    }

    void onPlanChange(planCode);
  };

  return (
    <div className="relative mx-auto max-w-6xl px-6 py-10 md:py-16">
      <div className="pointer-events-none absolute -left-10 top-12 h-52 w-52 rounded-full bg-vibegreen-500/18 blur-3xl" />
      <div className="pointer-events-none absolute -right-12 top-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />

      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-xl border border-[#334b72] bg-[#182746] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-[#3f5f90]"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="mt-5">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gray-400">Settings</p>
        <h2 className="mt-2 text-3xl font-extrabold text-white">Subscription & Billing</h2>
        {notice && <p className="mt-3 text-sm text-amber-300">{notice}</p>}
      </div>

      {usageSummary && (
        <section className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/60 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-200">
              Plan: <span className="font-semibold uppercase text-vibegreen-500">{usageSummary.planCode}</span>
            </p>
            <p className="text-xs text-gray-400">Renews {new Date(usageSummary.periodEnd).toLocaleDateString()}</p>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-gray-400">
                Scans {usageSummary.usedScans}/{usageSummary.includedScans}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-vibegreen-500 transition-all"
                  style={{ width: `${toPercent(usageSummary.usedScans, usageSummary.includedScans)}%` }}
                />
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-gray-400">
                AI fixes {usageSummary.usedAiFixes}/{usageSummary.includedAiFixes}
                {usageSummary.overageAiFixes > 0 ? ` (+${usageSummary.overageAiFixes} overage)` : ''}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-indigo-400 transition-all"
                  style={{ width: `${toPercent(usageSummary.usedAiFixes, usageSummary.includedAiFixes)}%` }}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="relative mt-8 grid gap-5 lg:grid-cols-3">
        {tiers.map((tier) => {
          const isCurrent = tier.code === currentPlan;
          const isUpdatingThis = planChangeTarget === tier.code;
          const buttonLabel = isUpdatingThis ? 'Updating...' : buildActionLabel(tier.code, tier.title);

          return (
            <article
              key={tier.code}
              className={`relative overflow-hidden rounded-[1.8rem] border bg-[linear-gradient(160deg,rgba(8,20,43,0.95),rgba(7,25,53,0.93))] p-8 shadow-[0_18px_52px_rgba(4,10,24,0.55)] ${
                tier.isPopular
                  ? 'border-vibegreen-400/70 shadow-[0_0_0_1px_rgba(16,185,129,0.5),0_20px_54px_rgba(16,185,129,0.2)]'
                  : 'border-[#31486d]'
              }`}
            >
              <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_10%_-5%,rgba(16,185,129,0.17),transparent_40%),radial-gradient(circle_at_100%_100%,rgba(99,102,241,0.15),transparent_48%)]" />

              {tier.isPopular && (
                <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-gradient-to-r from-vibegreen-500 to-indigo-400 px-5 py-1 text-xs font-extrabold uppercase tracking-[0.12em] text-[#051322]">
                  Most Popular
                </div>
              )}

              <div className="relative">
                <p className="text-3xl font-extrabold uppercase tracking-tight text-white">{tier.title}</p>
                <p className="mt-4 text-5xl font-extrabold text-white">{tier.priceLabel}</p>
                <p className="mt-3 text-xl text-slate-300">{tier.description}</p>

                <ul className="mt-7 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-lg text-slate-100">
                      <Check size={19} className="mt-0.5 shrink-0 text-vibegreen-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={isCurrent || Boolean(planChangeTarget)}
                  onClick={() => handlePlanClick(tier.code)}
                  className={`mt-9 w-full rounded-2xl px-5 py-4 text-lg font-bold transition ${
                    isCurrent
                      ? 'cursor-not-allowed border border-[#3a5073] bg-[#2a3958] text-slate-400'
                      : 'bg-gradient-to-r from-vibegreen-500 via-emerald-400 to-indigo-400 text-[#041321] hover:brightness-110'
                  }`}
                >
                  {buttonLabel}
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
};
