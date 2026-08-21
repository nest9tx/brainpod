'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const SUGGESTED_PROMPT =
  'Help me understand how a Ground → Pressure-test → Construct → Verify cycle would tackle a small, well-defined problem.';

type WorkMode = 'brainstorm' | 'assist' | 'construct';

export type SwarmTurn = {
  agent: string;
  summary_conclusion: string;
  collapsed_reasoning?: string;
};
type Verdict = { verdict: string; score: number | null; pov_eligible: boolean };
type Cycle = {
  question: string;
  turns: SwarmTurn[];
  verdict?: Verdict | null;
  mode?: WorkMode;
};

type OrientationPodProps = {
  podId: string;
  podName: string;
  podSummary: string;
  initialRemainingPrompts: number;
  initialCycles: { question: string; turns: SwarmTurn[] }[];
  userEmail: string;
};

function parseVerdictFromVeritasText(text: string | undefined): Verdict | null {
  if (!text) return null;
  const match = text.match(/\{[^{}]*\}(?![\s\S]*\{[^{}]*\})/);
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

function buildPriorContext(cycles: Cycle[], directorNote?: string): string {
  if (cycles.length === 0 && !directorNote?.trim()) return '';
  const chronological = [...cycles].reverse();
  const history = chronological
    .map((c) => {
      const agentBits = c.turns
        .map((t) => `${t.agent}: ${t.summary_conclusion.slice(0, 500)}`)
        .join('\n');
      return `Director: ${c.question}\n${agentBits}`;
    })
    .join('\n\n---\n\n');

  if (directorNote?.trim()) {
    return `${history}\n\n---\n\nDirector note / additional context for this continuation:\n${directorNote.trim()}`;
  }
  return history;
}

const MODE_OPTIONS: { id: WorkMode; label: string; description: string }[] = [
  {
    id: 'brainstorm',
    label: 'Brainstorm',
    description: 'Open perspectives and collective exploration. Light scoring.',
  },
  {
    id: 'assist',
    label: 'Assist / Think with me',
    description: 'Help clarify, structure, or pressure-test an idea you already have.',
  },
  {
    id: 'construct',
    label: 'Construct & Verify',
    description: 'Produce a structured artifact that can earn Proof-of-Value.',
  },
];

/** Subtle identity for each native agent — keeps the calm palette while making roles distinct. */
const AGENT_STYLE: Record<
  string,
  { label: string; role: string; accent: string; border: string }
> = {
  '@Astra': {
    label: '@Astra',
    role: 'Researcher & Grounder',
    accent: 'text-sky-300',
    border: 'border-sky-500/30',
  },
  '@Kaelen': {
    label: '@Kaelen',
    role: 'Adversarial Critic',
    accent: 'text-amber-300',
    border: 'border-amber-500/30',
  },
  '@Synthetix': {
    label: '@Synthetix',
    role: 'Builder',
    accent: 'text-emerald-300',
    border: 'border-emerald-500/30',
  },
  '@Veritas': {
    label: '@Veritas',
    role: 'Verification Sentinel',
    accent: 'text-violet-300',
    border: 'border-violet-500/30',
  },
};

function AgentTurn({ turn }: { turn: SwarmTurn }) {
  const style = AGENT_STYLE[turn.agent] ?? {
    label: turn.agent,
    role: 'Contributor',
    accent: 'text-calm-accent',
    border: 'border-calm-border',
  };

  return (
    <div className={`rounded-md border-l-2 ${style.border} pl-3`}>
      <div className="flex items-baseline gap-2">
        <p className={`text-xs font-medium uppercase tracking-wide ${style.accent}`}>
          {style.label}
        </p>
        <p className="text-xs text-calm-muted">{style.role}</p>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-calm-text whitespace-pre-wrap">
        {turn.summary_conclusion}
      </p>
    </div>
  );
}

function ContributionNote({ verdict }: { verdict: Verdict }) {
  if (verdict.pov_eligible) {
    return (
      <div className="rounded-md border border-calm-accent/40 bg-calm-accent/10 px-3 py-2.5 text-xs text-calm-text">
        <p className="font-medium text-calm-accent">Collaborative contribution advanced</p>
        <p className="mt-1 text-calm-muted">
          This cycle was verified. Proof-of-Value was recorded for the work produced under human
          direction with the swarm. Score {verdict.score}/100.
        </p>
      </div>
    );
  }

  const score = verdict.score ?? 0;
  if (score >= 70) {
    return (
      <div className="rounded-md border border-calm-border bg-calm-bg px-3 py-2.5 text-xs text-calm-muted">
        <p className="font-medium text-calm-text">Strong collaborative progress</p>
        <p className="mt-1">
          Score {score}/100. Not yet verified for Proof-of-Value. You can continue the thread to
          strengthen grounding, clarity, or structure.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md bg-calm-bg px-3 py-2 text-xs text-calm-muted">
      Not yet verified — no Proof-of-Value awarded. Score {verdict.score ?? '—'}/100. You can
      continue the thread to improve it.
    </div>
  );
}

export default function OrientationPod({
  podId,
  podName,
  podSummary,
  initialRemainingPrompts,
  initialCycles,
  userEmail,
}: OrientationPodProps) {
  const [directorPrompt, setDirectorPrompt] = useState('');
  const [directorNote, setDirectorNote] = useState('');
  const [mode, setMode] = useState<WorkMode>('construct');
  const [cycles, setCycles] = useState<Cycle[]>(
    initialCycles.map((cycle) => ({
      ...cycle,
      verdict: parseVerdictFromVeritasText(
        cycle.turns.find((t) => t.agent === '@Veritas')?.summary_conclusion
      ),
    }))
  );
  const [expandedCycle, setExpandedCycle] = useState<number | null>(
    initialCycles.length > 0 ? 0 : null
  );
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'thinking' | 'error' | 'limit_reached' | 'duplicate'
  >('idle');
  const [remainingPrompts, setRemainingPrompts] = useState(initialRemainingPrompts);
  const [isFollowUp, setIsFollowUp] = useState(false);

  async function handleDirect() {
    if (!directorPrompt.trim() || remainingPrompts <= 0) return;
    setStatus('thinking');
    setPendingQuestion(directorPrompt);

    const priorContext = isFollowUp
      ? buildPriorContext(cycles, directorNote)
      : directorNote.trim()
        ? `Director note / additional context:\n${directorNote.trim()}`
        : '';

    try {
      const res = await fetch('/api/orchestra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          director_prompt: directorPrompt,
          pod_id: podId,
          prior_context: priorContext || undefined,
          mode,
        }),
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
        {
          question: directorPrompt,
          turns: data.turns ?? [],
          verdict: data.verification ?? null,
          mode: (data.mode as WorkMode) ?? mode,
        },
        ...prev,
      ]);
      setExpandedCycle(0);
      setPendingQuestion(null);
      setDirectorPrompt('');
      setDirectorNote('');
      setIsFollowUp(true);
      setRemainingPrompts((n) => Math.max(n - 1, 0));
      setStatus('idle');
    } catch {
      setStatus('error');
      setPendingQuestion(null);
    }
  }

  function startFresh() {
    setIsFollowUp(false);
    setDirectorPrompt('');
    setDirectorNote('');
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  const latestCycle = cycles[0];
  const activeModeLabel =
    MODE_OPTIONS.find((o) => o.id === mode)?.label ?? 'Construct & Verify';
  const isFirstExperience = cycles.length === 0 && !pendingQuestion;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <div className="flex items-center justify-between text-xs text-calm-muted">
        <span>Signed in as {userEmail}</span>
        <div className="flex items-center gap-4">
          <Link href="/workspace" className="underline hover:text-calm-text">
            Workspace
          </Link>
          <Link href="/explore" className="underline hover:text-calm-text">
            Explore
          </Link>
          <button onClick={handleSignOut} className="underline hover:text-calm-text">
            Sign out
          </button>
        </div>
      </div>

      <header className="space-y-3">
        <p className="text-sm uppercase tracking-widest text-calm-muted">
          Brainpod · {podName} Mini-Pod
        </p>
        <h1 className="text-2xl font-medium text-calm-text">
          Human direction. Verified results. No cash-out, no gaming the ledger.
        </h1>
        {podSummary && <p className="text-sm leading-relaxed text-calm-muted">{podSummary}</p>}
        <p className="text-xs text-calm-muted">
          Choose the kind of work you want, then direct the swarm. You can continue a thread
          or start fresh. Nothing earns Proof-of-Value until @Veritas says so.
        </p>
      </header>

      <div className="rounded-lg border border-calm-border bg-calm-surface p-4 text-sm text-calm-muted">
        {remainingPrompts} free Director prompt{remainingPrompts === 1 ? '' : 's'} remaining
        today · resets 00:00 UTC
      </div>

      {isFirstExperience && (
        <div className="rounded-lg border border-calm-accent/30 bg-calm-accent/5 p-4 text-sm text-calm-text">
          <p className="font-medium">Welcome, Director.</p>
          <p className="mt-2 text-calm-muted">
            This is your Orientation Mini-Pod. Start with any mode that fits what you need right now.
            Brainstorm for open exploration, Assist when you already have an idea to refine, or
            Construct when you want a structured result that can be verified. You can always continue
            a thread or begin again. The swarm is here to collaborate, not to test you.
          </p>
        </div>
      )}

      {/* Work Mode Selector — always visible */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-calm-muted">What kind of work is this?</p>
          <p className="text-xs text-calm-accent">Active: {activeModeLabel}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMode(opt.id)}
              className={`rounded-lg border p-3 text-left transition ${
                mode === opt.id
                  ? 'border-calm-accent bg-calm-accent/10 text-calm-text ring-1 ring-calm-accent/40'
                  : 'border-calm-border bg-calm-surface text-calm-muted hover:border-calm-accent/50'
              }`}
            >
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="mt-1 text-xs opacity-80">{opt.description}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <label htmlFor="director-prompt" className="text-sm text-calm-muted">
            {isFollowUp ? 'Continue the conversation' : 'Direct the swarm'}
          </label>
          {isFollowUp && cycles.length > 0 && (
            <button
              onClick={startFresh}
              className="text-xs text-calm-muted underline hover:text-calm-text"
            >
              Start a fresh question instead
            </button>
          )}
        </div>

        {isFollowUp && latestCycle && (
          <div className="rounded-md border border-calm-border/60 bg-calm-bg/50 px-3 py-2 text-xs text-calm-muted">
            Continuing from: “{latestCycle.question.slice(0, 120)}
            {latestCycle.question.length > 120 ? '…' : ''}”
            {latestCycle.mode ? ` · previous mode: ${latestCycle.mode}` : ''}
          </div>
        )}

        <textarea
          id="director-prompt"
          className="w-full rounded-lg border border-calm-border bg-calm-surface p-3 text-sm text-calm-text focus:border-calm-accent focus:outline-none"
          rows={3}
          placeholder={
            isFollowUp
              ? 'Add a follow-up, new angle, clarification, or additional context…'
              : mode === 'brainstorm'
                ? 'What would you like to explore or brainstorm together?'
                : mode === 'assist'
                  ? 'What idea or problem would you like help thinking through?'
                  : SUGGESTED_PROMPT
          }
          value={directorPrompt}
          onChange={(e) => setDirectorPrompt(e.target.value)}
        />

        {/* Lightweight note / reference — available on every send, especially useful on continuation */}
        <div className="space-y-1">
          <label htmlFor="director-note" className="text-xs text-calm-muted">
            Optional note or reference (short)
          </label>
          <textarea
            id="director-note"
            className="w-full rounded-lg border border-calm-border/70 bg-calm-bg/40 p-2.5 text-xs text-calm-text placeholder:text-calm-muted/70 focus:border-calm-accent focus:outline-none"
            rows={2}
            placeholder="e.g. constraint, prior decision, link, or brief clarification for the swarm…"
            value={directorNote}
            onChange={(e) => setDirectorNote(e.target.value)}
            maxLength={800}
          />
        </div>

        <p className="text-xs text-calm-muted">
          {isFollowUp
            ? `Continuing in ${activeModeLabel} mode. Change the mode above if you want a different kind of response.`
            : mode === 'brainstorm'
              ? 'Brainstorm mode prioritizes open perspectives over scoring.'
              : mode === 'assist'
                ? 'Assist mode focuses on clarifying and strengthening your thinking.'
                : 'Construct mode aims for a structured artifact that can be verified.'}
        </p>
        <button
          onClick={handleDirect}
          disabled={status === 'thinking' || remainingPrompts <= 0 || !directorPrompt.trim()}
          className="rounded-lg bg-calm-accent px-4 py-2 text-sm font-medium text-calm-bg disabled:opacity-40"
        >
          {status === 'thinking'
            ? 'Swarm is working…'
            : isFollowUp
              ? 'Continue with swarm'
              : 'Send to swarm'}
        </button>
        {status === 'error' && (
          <p className="text-sm text-red-400">
            The orchestra service isn’t reachable yet — this is expected until
            apps/orchestra is running and its API keys are configured.
          </p>
        )}
        {status === 'limit_reached' && (
          <p className="text-sm text-calm-muted">
            You’ve used today’s free Director prompts. They reset at 00:00 UTC.
          </p>
        )}
        {status === 'duplicate' && (
          <p className="text-sm text-calm-muted">
            This exact question already has a verified result in this pod — try a new angle
            or a different question to earn Proof-of-Value.
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
                <div className="space-y-1">
                  <p className="text-sm text-calm-text">{cycle.question}</p>
                  <p className="text-xs text-calm-muted">
                    {cycle.mode ? `${cycle.mode} · ` : ''}
                    {cycle.turns.map((t) => t.agent).join(' → ')}
                  </p>
                </div>
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
                <div className="space-y-5 border-t border-calm-border p-4">
                  {cycle.turns.map((turn, j) => (
                    <AgentTurn key={j} turn={turn} />
                  ))}
                  {cycle.verdict && <ContributionNote verdict={cycle.verdict} />}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
