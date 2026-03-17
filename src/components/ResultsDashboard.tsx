import { AlertTriangle, RotateCcw, ShieldAlert } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { ScanResult, Severity, Vulnerability } from '../types';

interface ResultsDashboardProps {
  result: ScanResult;
  onReset: () => void;
  onFixClick: (vulnerability: Vulnerability) => void;
}

const severityStyles: Record<Severity, string> = {
  Critical: 'bg-red-500/20 text-red-300 border-red-500/40',
  High: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  Medium: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  Low: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
};

const severityColors: Record<Severity, string> = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#f59e0b',
  Low: '#10b981'
};

const scoreTextColor = (score: number) => {
  if (score < 50) {
    return 'text-red-400';
  }
  if (score < 75) {
    return 'text-amber-300';
  }
  return 'text-vibegreen-500';
};

export const ResultsDashboard = ({ result, onReset, onFixClick }: ResultsDashboardProps) => {
  const severityCount = result.vulnerabilities.reduce(
    (acc, vuln) => {
      acc[vuln.severity] += 1;
      return acc;
    },
    {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0
    } as Record<Severity, number>
  );

  const chartData = Object.entries(severityCount)
    .map(([severity, count]) => ({
      name: severity,
      value: count,
      color: severityColors[severity as Severity]
    }))
    .filter((item) => item.value > 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:py-14">
      <header className="flex flex-col gap-4 rounded-3xl border border-gray-800 bg-gray-950/55 p-6 backdrop-blur-md md:flex-row md:items-start md:justify-between md:p-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-gray-400">Scan report</p>
          <h2 className="mt-3 text-2xl font-bold text-gray-100 md:text-3xl">{result.url}</h2>
          <p className="mt-2 text-sm text-gray-400">Completed: {result.timestamp}</p>

          <div className="mt-5 flex items-end gap-2">
            <span className={`text-5xl font-extrabold ${scoreTextColor(result.score)}`}>{result.score}</span>
            <span className="mb-1 text-gray-400">/ 100 Security Score</span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {result.techStack.map((tech) => (
              <span
                key={tech}
                className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>

        <div className="h-60 w-full rounded-2xl border border-gray-800 bg-gray-900/70 p-2 md:w-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" innerRadius={55} outerRadius={80} paddingAngle={3}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#111827',
                  border: '1px solid #1f2937',
                  color: '#e5e7eb',
                  borderRadius: '0.5rem'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </header>

      <section className="mt-6 rounded-2xl border border-gray-800 bg-gray-950/50 p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
            <ShieldAlert size={18} className="text-vibegreen-500" />
            Vulnerability Findings
          </h3>
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 transition hover:border-gray-600"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>

        <div className="space-y-3">
          {result.vulnerabilities.map((vulnerability) => (
            <article key={vulnerability.id} className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${severityStyles[vulnerability.severity]}`}
                  >
                    {vulnerability.severity}
                  </span>
                  <h4 className="mt-3 text-base font-semibold text-gray-100">{vulnerability.title}</h4>
                  <p className="mt-1 text-sm text-gray-400">{vulnerability.description}</p>
                  <p className="mt-3 font-mono text-xs text-gray-500">{vulnerability.location}</p>
                </div>

                <button
                  onClick={() => onFixClick(vulnerability)}
                  className="inline-flex items-center gap-2 rounded-lg bg-vibegreen-500 px-4 py-2 text-sm font-semibold text-gray-950 transition hover:bg-emerald-400"
                >
                  <AlertTriangle size={14} />
                  Fix with AI
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};
