'use client';

import { useState } from 'react';

const SUGGESTED_PROMPT =
  'Help me understand how a Ground → Pressure-test → Construct → Verify cycle would tackle a small, well-defined problem.';

type SwarmTurn = {
  agent: string;
  summary_conclusion: string;
  collapsed_reasoning?: string;
};
type Verdict = { verdict: string; score: number | null; pov_eligible: boolean };

type OrientationPodProps = {
  podName: string;
  podSummary: string;
  initialRemainingPrompts: number;
  initialHistory: SwarmTurn[];
};

// Pre-account calmed landing (outline §5): mission first, one gentle call to action,
// no raw message firehose. This is the Orientation Mini-Pod's entry surface.
export default function OrientationPod({
  podName,
  podSummary,
  initialRemainingPrompts,
  initialHistory,
}: OrientationPodProps) {
  const [directorPrompt, setDirectorPrompt] = useState(SUGGESTED_PROMPT);
  const [turns, setTurns] = useState<SwarmTurn[]>(initialHistory);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [expandedTurn, setExpandedTurn] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'thinking' | 'error' | 'limit_reached'>('idle');
  const [remainingPrompts, setRemainingPrompts] = useState(initialRemainingPrompts);

  async function handleDirect() {
    if (!directorPrompt.trim() || remainingPrompts <= 0) return;
    setStatus('thinking');
    setTurns((prev) => [...prev, { agent: 'You', summary_conclusion: directorPrompt }]);

    try {
      const res = await fetch('/api/orchestra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ director_prompt: directorPrompt }),
      });

      if (res.status === 429) {
        setStatus('limit_reached');
        setRemainingPrompts(0);
        return;
      }
      if (!res.ok) throw new Error('orchestra_unavailable');

      const data = await res.json();
      setTurns((prev) => [...prev, ...(data.turns ?? [])]);
      setVerdict(data.verification ?? null);
      setRemainingPrompts((n) => Math.max(n - 1, 0));
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-widest text-calm-muted">
          Brainpod · {podName} Mini-Pod
        </p>
        <h1 className="text-2xl font-medium text-calm-text">
          Human direction. Verified results. No cash-out, no gaming the ledger.
        </h1>
        {podSummary && <p className="text-sm leading-relaxed text-calm-muted">{podSummary}</p>}
        <p className="text-xs text-calm-muted">
          Every message below — yours and the swarm&apos;s — is saved to this pod, in order.
          Nothing here is verified or worth Proof-of-Value until @Veritas says so at the end
          of a cycle.
        </p>
      </header>

      <div className="rounded-lg border border-calm-border bg-calm-surface p-4 text-sm text-calm-muted">
        {remainingPrompts} free Director prompt{remainingPrompts === 1 ? '' : 's'} remaining
        today · resets 00:00 UTC
      </div>

      <section className="space-y-3">
        <label htmlFor="director-prompt" className="text-sm text-calm-muted">
          Direct the swarm
        </label>
        <textarea
          id="director-prompt"
          className="w-full rounded-lg border border-calm-border bg-calm-surface p-3 text-sm text-calm-text focus:border-calm-accent focus:outline-none"
          rows={3}
          value={directorPrompt}
          onChange={(e) => setDirectorPrompt(e.target.value)}
        />
        <button
          onClick={handleDirect}
          disabled={status === 'thinking' || remainingPrompts <= 0}
          className="rounded-lg bg-calm-accent px-4 py-2 text-sm font-medium text-calm-bg disabled:opacity-40"
        >
          {status === 'thinking' ? 'Swarm is working…' : 'Send to swarm'}
        </button>
        {status === 'error' && (
          <p className="text-sm text-red-400">
            The orchestra service isn&apos;t reachable yet — this is expected until
            apps/orchestra is running and its API keys are configured.
          </p>
        )}
        {status === 'limit_reached' && (
          <p className="text-sm text-calm-muted">
            You&apos;ve used today&apos;s free Director prompts. They reset at 00:00 UTC.
          </p>
        )}
      </section>

      {turns.length > 0 && (
        <section className="space-y-3">
          {turns.map((turn, i) => (
            <article key={i} className="rounded-lg border border-calm-border bg-calm-surface p-4">
              <p className="text-xs uppercase tracking-wide text-calm-accent">{turn.agent}</p>
              <p className="mt-1 text-sm text-calm-text">{turn.summary_conclusion}</p>
              {turn.collapsed_reasoning && (
                <button
                  className="mt-2 text-xs text-calm-muted underline"
                  onClick={() => setExpandedTurn(expandedTurn === i ? null : i)}
                >
                  {expandedTurn === i ? 'Hide reasoning' : 'Show reasoning'}
                </button>
              )}
              {expandedTurn === i && (
                <p className="mt-2 text-xs text-calm-muted">{turn.collapsed_reasoning}</p>
              )}
            </article>
          ))}
        </section>
      )}

      {verdict && (
        <section
          className={`rounded-lg border p-4 text-sm ${
            verdict.pov_eligible
              ? 'border-calm-accent text-calm-accent'
              : 'border-calm-border text-calm-muted'
          }`}
        >
          {verdict.pov_eligible
            ? `@Veritas verified this artifact (score ${verdict.score}/100) — Proof-of-Value awarded to @Synthetix.`
            : `@Veritas did not verify this artifact (score ${verdict.score ?? '—'}/100) — no Proof-of-Value awarded.`}
        </section>
      )}
    </main>
  );
}
