import { Bot, ShieldCheck, WandSparkles } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';

interface HomeViewProps {
  initialUrl: string;
  onStartScan: (url: string) => void | Promise<void>;
  scanCtaDisabled?: boolean;
  notice?: string;
}

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'OWASP Top 10 Coverage',
    body: 'Automated checks tuned for common AI-generated app weaknesses and critical exploit paths.'
  },
  {
    icon: Bot,
    title: 'Stack Detection',
    body: 'Identifies framework, database, auth providers, and risky patterns before generating fixes.'
  },
  {
    icon: WandSparkles,
    title: 'One-Click Fix',
    body: 'Get practical before/after remediation guidance powered by Gemini for each finding.'
  }
];

export const HomeView = ({ initialUrl, onStartScan, scanCtaDisabled = false, notice = '' }: HomeViewProps) => {
  const [url, setUrl] = useState(initialUrl);

  const submitScan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = url.trim();
    if (!normalized) {
      return;
    }
    void onStartScan(normalized);
  };

  return (
    <div className="relative mx-auto max-w-6xl px-6 py-10 md:py-16">
      <div className="pointer-events-none absolute -left-16 top-8 h-48 w-48 rounded-full bg-vibegreen-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-8 top-44 h-56 w-56 rounded-full bg-indigo-500/25 blur-3xl" />

      <section className="relative overflow-hidden rounded-3xl border border-gray-800/90 bg-gray-950/50 p-8 shadow-glow backdrop-blur-lg md:p-14">
        <p className="mb-4 inline-flex items-center rounded-full border border-vibegreen-500/30 bg-vibegreen-500/10 px-3 py-1 font-mono text-xs text-vibegreen-500">
          AI Security for Vibe-Coded Software
        </p>
        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white md:text-6xl">
          Secure your{' '}
          <span className="bg-gradient-to-r from-vibegreen-500 via-emerald-300 to-indigo-400 bg-clip-text text-transparent">
            vibe coded
          </span>{' '}
          apps
        </h1>
        <p className="mt-5 max-w-2xl text-base text-gray-300 md:text-lg">
          Simulate autonomous penetration testing against a GitHub repo or live URL, then generate actionable fixes using Gemini.
        </p>

        <form className="mt-8 flex flex-col gap-3 md:flex-row" onSubmit={submitScan}>
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://github.com/your-org/your-app"
            className="h-12 flex-1 rounded-xl border border-gray-700 bg-gray-900/70 px-4 text-sm text-gray-100 outline-none ring-vibegreen-500/30 transition focus:border-vibegreen-500 focus:ring"
          />
          <button
            type="submit"
            disabled={scanCtaDisabled}
            className="h-12 rounded-xl bg-vibegreen-500 px-6 text-sm font-semibold text-gray-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Start Scan
          </button>
        </form>

        {notice && <p className="mt-3 text-sm text-amber-300">{notice}</p>}
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <article
              key={feature.title}
              className="rounded-2xl border border-gray-800 bg-gray-900/45 p-5 backdrop-blur-md transition hover:-translate-y-0.5 hover:border-gray-700"
            >
              <div className="mb-4 inline-flex rounded-lg border border-vibegreen-500/30 bg-vibegreen-500/10 p-2 text-vibegreen-500">
                <Icon size={18} />
              </div>
              <h3 className="font-semibold text-gray-100">{feature.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{feature.body}</p>
            </article>
          );
        })}
      </section>
    </div>
  );
};
