'use client';

import { useState } from 'react';

const SUGGESTED_PROMPT =
  'Help me understand how a Ground → Pressure-test → Construct → Verify cycle would tackle a small, well-defined problem.';

export type SwarmTurn = {
  agent: string;
  summary_conclusion: string;
  collapsed_reasoning?: string;
};
type Verdict = { verdict: string; score: number | null; pov_eligible: boolean };
type Cycle = { question: string; turns: SwarmTurn[]; verdict?: Verdict | null };

type OrientationPodProps = {
  podName: string;
  podSummary: string;
  initialRemainingPrompts: number;
  initialCycles: { question: string; turns: SwarmTurn[] }[];
};

// Extracts @Veritas's trailing {...} verdict block for the collapsed-card badge.
// Used for cycles reloaded from history, where we only have the raw turn text.
function parseVerdictFromVeritasText(text: string | undefined): Verdict | null {
  if (!text) return null;
  const match = text.match(/\{[^{}]*\}(?!.*\{[^{}]*\})/s);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return {
      verdict: parsed.verdict ?? 'unparseable',
      score: typeof parsed.score === 'number' ? parsed.score : null,
      pov_eligible: Boolean(parsed.pov_eligible),
    };
  } catch {
    return null;
  }
}

// Pre-account calmed landing (outline §5): mission first, one gentle call to action,
// no raw message firehose. This is the Orientation Mini-Pod's entry surface.
export default function OrientationPod({
  podName,
  podSummary,
  initialRemainingPrompts,
  initialCycles,
}: OrientationPodProps) {
  const [directorPrompt, setDirectorPrompt] = useState('');
  const [cycles, setCycles] = useState<Cycle[]>(
    initialCycles.map((cycle) => ({
      ...cycle,
      verdict: parseVerdictFromVeritasText(
        cycle.turns.find((t) => t.agent === '@Veritas')?.summary_conclusion
      ),
    }))
  );
  const [expandedCycle, setExpandedCycle] = useState<number | null>(0);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'thinking' | 'error' | 'limit_reached' | 'duplicate'
  >('idle');
  const [remainingPrompts, setRemainingPrompts] = useState(initialRemainingPrompts);

  async function handleDirect() {
    if (!directorPrompt.trim() || remainingPrompts <= 0) return;
    setStatus('thinking');
    setPendingQuestion(directorPrompt);

    try {
      const res = await fetch('/api/orchestra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ director_prompt: directorPrompt }),
      });

      if (res.status === 429) {
        setStatus('limit_reached');
        setRemainingPrompts(0);
        setPendingQuestion(null);
        return;
      }
      if (res.status === 409) {
        setStatus('duplicate');
        setPendingQuestion(null);
        return;
      }
      if (!res.ok) throw new Error('orchestra_unavailable');

      const data = await res.json();
      setCycles((prev) => [
        { question: directorPrompt, turns: data.turns ?? [], verdict: data.verification ?? null },
        ...prev,
      ]);
      setExpandedCycle(0);
      setPendingQuestion(null);
      setDirectorPrompt('');
      setRemainingPrompts((n) => Math.max(n - 1, 0));
      setStatus('idle');
    } catch {
      setStatus('error');
      setPendingQuestion(null);
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
          Every question below — yours and the swarm&apos;s — is saved to this pod. Nothing
          here is verified or worth Proof-of-Value until @Veritas says so at the end of a cycle.
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
          placeholder={SUGGESTED_PROMPT}
          value={directorPrompt}
          onChange={(e) => setDirectorPrompt(e.target.value)}
        />
        <p className="text-xs text-calm-muted">
          Write your own question — repeating a question already asked in this pod won&apos;t
          earn Proof-of-Value.
        </p>
        <button
          onClick={handleDirect}
          disabled={status === 'thinking' || remainingPrompts <= 0 || !directorPrompt.trim()}
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
        {status === 'duplicate' && (
          <p className="text-sm text-calm-muted">
            That exact question has already been directed in this pod — try a new angle or a
            different question.
          </p>
        )}
      </section>

      <section className="space-y-3">
        {pendingQuestion && (
          <article className="rounded-lg border border-calm-border bg-calm-surface p-4">
            <p className="text-sm text-calm-text">{pendingQuestion}</p>
            <p className="mt-2 text-xs text-calm-muted">Swarm is working…</p>
          </article>
        )}

        {cycles.map((cycle, i) => {
          const isExpanded = expandedCycle === i;
          return (
            <article key={i} className="rounded-lg border border-calm-border bg-calm-surface">
              <button
                onClick={() => setExpandedCycle(isExpanded ? null : i)}
                className="flex w-full items-start justify-between gap-3 p-4 text-left"
              >
                <p className="text-sm text-calm-text">{cycle.question}</p>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
                    cycle.verdict?.pov_eligible
                      ? 'border-calm-accent text-calm-accent'
                      : 'border-calm-border text-calm-muted'
                  }`}
                >
                  {cycle.verdict ? `${cycle.verdict.score ?? '—'}/100` : '…'}
                </span>
              </button>

              {isExpanded && (
                <div className="space-y-3 border-t border-calm-border p-4">
                  {cycle.turns.map((turn, j) => (
                    <div key={j}>
                      <p className="text-xs uppercase tracking-wide text-calm-accent">
                        {turn.agent}
                      </p>
                      <p className="mt-1 text-sm text-calm-text">{turn.summary_conclusion}</p>
                    </div>
                  ))}
                  {cycle.verdict && (
                    <p
                      className={`text-xs ${
                        cycle.verdict.pov_eligible ? 'text-calm-accent' : 'text-calm-muted'
                      }`}
                    >
                      {cycle.verdict.pov_eligible
                        ? `Verified — Proof-of-Value awarded to @Synthetix.`
                        : `Not verified — no Proof-of-Value awarded.`}
                    </p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}

