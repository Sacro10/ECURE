import { Copy, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { generateFixWithGemini } from '../services/gemini';
import type { BillingUsageSummary } from '../services/billing';
import type { Vulnerability } from '../types';

interface FixModalProps {
  vulnerability: Vulnerability | null;
  techStack: string[];
  onClose: () => void;
  onUsageSummary?: (summary: BillingUsageSummary) => void;
}

const toModalErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : 'Unknown error occurred.';
};

export const FixModal = ({ vulnerability, techStack, onClose, onUsageSummary }: FixModalProps) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!vulnerability) {
      return;
    }

    let isCancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      setContent('');
      setCopied(false);

      try {
        const result = await generateFixWithGemini(vulnerability, techStack);
        if (!isCancelled) {
          setContent(result.markdown);
          if (result.usageSummary) {
            onUsageSummary?.(result.usageSummary);
          }
        }
      } catch (unknownError) {
        if (!isCancelled) {
          setError(toModalErrorMessage(unknownError));
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      isCancelled = true;
    };
  }, [onUsageSummary, techStack, vulnerability]);

  const canCopy = useMemo(() => Boolean(content) && !loading, [content, loading]);

  if (!vulnerability) {
    return null;
  }

  const handleCopy = async () => {
    if (!content) {
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-800 bg-gray-950 shadow-glow">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-vibegreen-500">AI Remediation</p>
            <h3 className="mt-1 text-lg font-semibold text-gray-100">{vulnerability.title}</h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!canCopy}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 transition hover:border-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Copy size={14} />
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-700 p-2 text-gray-300 transition hover:border-gray-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(90vh-80px)] overflow-auto p-5">
          {loading && (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-gray-300">
              <div className="rounded-full border border-vibegreen-500/30 bg-vibegreen-500/10 p-4 text-vibegreen-500">
                <Sparkles className="animate-spin" size={28} />
              </div>
              <p className="font-mono text-xs">Synthesizing secure patch via Gemini...</p>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
          )}

          {!loading && !error && content && (
            <div className="space-y-3 text-sm text-gray-300">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 className="text-xl font-semibold text-gray-100">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-lg font-semibold text-gray-100">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-base font-semibold text-gray-100">{children}</h3>,
                  p: ({ children }) => <p className="leading-7 text-gray-300">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc space-y-1 pl-6 text-gray-300">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-6 text-gray-300">{children}</ol>,
                  li: ({ children }) => <li>{children}</li>,
                  code({ className, children, ...props }) {
                    const language = className?.replace('language-', '') ?? 'text';
                    return className ? (
                      <div className="my-4 overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
                        <div className="border-b border-gray-800 px-3 py-2 font-mono text-xs text-gray-400">{language}</div>
                        <pre className="overflow-auto p-4 text-sm">
                          <code className="font-mono text-gray-200" {...props}>
                            {children}
                          </code>
                        </pre>
                      </div>
                    ) : (
                      <code className="rounded bg-gray-900 px-1.5 py-0.5 font-mono text-sm text-vibegreen-500" {...props}>
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
