'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Insight = {
  id: string;
  body: string;
  author_label: string;
  created_at: string;
  author_id: string;
};

type PublicInsightsProps = {
  artifactId: string;
  isSignedIn: boolean;
  currentUserId?: string;
};

export default function PublicInsights({
  artifactId,
  isSignedIn,
  currentUserId,
}: PublicInsightsProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'loading' | 'idle' | 'saving' | 'error' | 'done'>('loading');
  const [message, setMessage] = useState('');

  const alreadyContributed =
    !!currentUserId && insights.some((i) => i.author_id === currentUserId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/explore/insights?artifact_id=${artifactId}`);
        if (!res.ok) throw new Error('load_failed');
        const data = await res.json();
        if (!cancelled) {
          setInsights(data.insights ?? []);
          setStatus('idle');
        }
      } catch {
        if (!cancelled) {
          setStatus('error');
          setMessage('Could not load insights yet.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [artifactId]);

  async function submit() {
    if (!draft.trim() || status === 'saving') return;
    setStatus('saving');
    setMessage('');
    try {
      const res = await fetch('/api/explore/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifact_id: artifactId, body: draft.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setStatus('idle');
        setMessage(data.detail || 'You already shared an insight on this study.');
        return;
      }
      if (!res.ok) {
        setStatus('error');
        setMessage(data.detail || 'Could not save insight.');
        return;
      }
      setInsights((prev) => [...prev, data.insight]);
      setDraft('');
      setStatus('done');
      setMessage('Insight shared with the commons.');
    } catch {
      setStatus('error');
      setMessage('Could not save insight.');
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/explore/insights?id=${id}`, { method: 'DELETE' });
      if (!res.ok) return;
      setInsights((prev) => prev.filter((i) => i.id !== id));
      setMessage('');
      setStatus('idle');
    } catch {
      /* keep quiet */
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-calm-border bg-calm-surface p-6">
      <div className="space-y-1">
        <h2 className="text-sm font-medium text-calm-text">Public insights</h2>
        <p className="text-xs leading-relaxed text-calm-muted">
          Short observations from Directors who read this release. One note per person keeps the
          commons calm. Insights are not @Veritas verification and do not change Proof-of-Value.
        </p>
      </div>

      {status === 'loading' && <p className="text-xs text-calm-muted">Loading insights…</p>}

      {insights.length === 0 && status !== 'loading' && (
        <p className="text-xs text-calm-muted">No public insights yet. Be the first calm note.</p>
      )}

      {insights.length > 0 && (
        <ul className="space-y-3">
          {insights.map((insight) => (
            <li
              key={insight.id}
              className="rounded-md border border-calm-border/60 bg-calm-bg/40 px-3 py-2.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-medium text-calm-accent">{insight.author_label}</p>
                <p className="text-[11px] text-calm-muted">
                  {new Date(insight.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <p className="mt-1.5 break-words text-sm leading-relaxed text-calm-text whitespace-pre-wrap">
                {insight.body}
              </p>
              {currentUserId && insight.author_id === currentUserId && (
                <button
                  type="button"
                  onClick={() => remove(insight.id)}
                  className="mt-2 text-[11px] text-calm-muted underline hover:text-calm-text"
                >
                  Remove my insight
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!isSignedIn && (
        <p className="text-xs text-calm-muted">
          <Link href="/login" className="underline hover:text-calm-text">
            Sign in
          </Link>{' '}
          to share a short insight on this released study.
        </p>
      )}

      {isSignedIn && !alreadyContributed && (
        <div className="space-y-2 border-t border-calm-border pt-4">
          <label htmlFor="insight-draft" className="text-xs text-calm-muted">
            Your insight (optional, one per study)
          </label>
          <textarea
            id="insight-draft"
            rows={3}
            maxLength={800}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="A careful observation, question, or practical next step…"
            className="w-full rounded-lg border border-calm-border bg-calm-bg/40 p-2.5 text-sm text-calm-text placeholder:text-calm-muted/70 focus:border-calm-accent focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim() || status === 'saving'}
              className="rounded-lg bg-calm-accent px-3 py-1.5 text-xs font-medium text-calm-bg disabled:opacity-40"
            >
              {status === 'saving' ? 'Sharing…' : 'Share insight'}
            </button>
            <p className="text-[11px] text-calm-muted">{draft.length}/800</p>
          </div>
        </div>
      )}

      {isSignedIn && alreadyContributed && status !== 'done' && (
        <p className="text-xs text-calm-muted border-t border-calm-border pt-3">
          You already shared an insight on this study.
        </p>
      )}

      {message && <p className="text-xs text-calm-muted">{message}</p>}
    </section>
  );
}
