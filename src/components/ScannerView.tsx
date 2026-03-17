import { Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SCAN_STEPS } from '../data/mockData';

interface ScannerViewProps {
  targetUrl: string;
  onComplete: () => void;
}

export const ScannerView = ({ targetUrl, onComplete }: ScannerViewProps) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let currentStep = 0;
    const totalSteps = SCAN_STEPS.length;

    const intervalId = window.setInterval(() => {
      if (currentStep >= totalSteps) {
        window.clearInterval(intervalId);
        window.setTimeout(onComplete, 600);
        return;
      }

      setLogs((previousLogs) => [...previousLogs, SCAN_STEPS[currentStep]]);
      currentStep += 1;
      setProgress(Math.round((currentStep / totalSteps) * 100));
    }, 650);

    return () => window.clearInterval(intervalId);
  }, [onComplete]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col px-6 py-12">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-vibegreen-500">Active scan session</p>
      <h2 className="mt-3 text-2xl font-bold text-gray-100 md:text-3xl">Penetration testing simulation in progress</h2>
      <p className="mt-2 max-w-2xl text-sm text-gray-400">Target: {targetUrl}</p>

      <div className="mt-8 grid gap-6 md:grid-cols-[340px,1fr]">
        <section className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6 shadow-glow backdrop-blur-md">
          <div className="relative mx-auto mt-2 flex h-56 w-56 items-center justify-center">
            <div className="absolute h-full w-full animate-ping rounded-full border border-vibegreen-500/40" />
            <div className="absolute h-44 w-44 animate-pulse rounded-full border border-vibegreen-500/50" />
            <div className="absolute h-32 w-32 rounded-full border border-vibegreen-500/40" />
            <div className="relative rounded-full border border-vibegreen-500/50 bg-vibegreen-500/10 p-6 text-vibegreen-500 shadow-glow">
              <Shield size={46} strokeWidth={1.8} />
            </div>
          </div>

          <div className="mt-7">
            <div className="mb-2 flex items-center justify-between font-mono text-xs text-gray-400">
              <span>Analysis completion</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
              <div className="h-full rounded-full bg-gradient-to-r from-vibegreen-500 to-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </section>

        <section className="terminal-scan relative overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 p-4 font-mono text-xs text-gray-300">
          <div className="mb-3 flex items-center gap-2 border-b border-gray-800 pb-3 text-gray-400">
            <span className="h-2 w-2 rounded-full bg-red-400/80" />
            <span className="h-2 w-2 rounded-full bg-yellow-300/80" />
            <span className="h-2 w-2 rounded-full bg-green-400/80" />
            <span className="ml-2">vibesec-scanner.log</span>
          </div>

          <div className="h-64 space-y-2 overflow-auto pr-1 md:h-[22rem]">
            {logs.map((log, index) => (
              <p key={`${log}-${index}`} className="leading-relaxed text-gray-300">
                <span className="text-vibegreen-500">[{String(index + 1).padStart(2, '0')}]</span> {log}
              </p>
            ))}
            <p className="animate-pulse text-vibegreen-500">▋</p>
          </div>
        </section>
      </div>
    </div>
  );
};
