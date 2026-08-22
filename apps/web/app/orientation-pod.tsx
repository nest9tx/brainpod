'use client';

import { useState } from 'react';
import SiteNav from '@/components/site-nav';
import SiteFooter from '@/components/site-footer';

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
  directorLabel?: string;
  turns: SwarmTurn[];
  verdict?: Verdict | null;
  mode?: WorkMode;
  directorNote?: string | null;
  referenceUrl?: string | null;
  attachmentName?: string | null;
};

type OrientationPodProps = {
  podId: string;
  podName: string;
  podSummary: string;
  initialRemainingPrompts: number;
  initialCycles: {
    question: string;
    turns: SwarmTurn[];
    directorLabel?: string;
    directorNote?: string | null;
    referenceUrl?: string | null;
    attachmentName?: string | null;
  }[];
  userEmail: string;
  currentDirectorLabel?: string;
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

function formatCyclePlainText(cycle: Cycle, podName: string): string {
  const lines = [
    `Brainpod · ${podName}`,
    `Directed by: ${cycle.directorLabel ?? 'Director'}`,
    cycle.mode ? `Mode: ${cycle.mode}` : null,
    cycle.verdict
      ? `Verification: ${cycle.verdict.score ?? '—'}/100 · ${cycle.verdict.pov_eligible ? 'verified' : 'not verified'}`
      : null,
    '',
    'Director question:',
    cycle.question,
    cycle.directorNote ? `\nDirector note:\n${cycle.directorNote}` : null,
    cycle.referenceUrl ? `\nReference: ${cycle.referenceUrl}` : null,
    cycle.attachmentName ? `\nAttachment: ${cycle.attachmentName}` : null,
    '',
  ].filter((line) => line !== null) as string[];
  for (const turn of cycle.turns) {
    lines.push(`${turn.agent}:`);
    lines.push(turn.summary_conclusion);
    lines.push('');
  }
  lines.push('---');
  lines.push(
    'Shared from Brainpod (LuminaNova.org 501(c)(3)). Attribution is collective; not independently verified evidence solely because it was copied.'
  );
  return lines.join('\n');
}

function buildPriorContextFromCycle(
  cycle: Cycle,
  directorNote?: string,
  referenceUrl?: string
): string {
  const agentBits = cycle.turns
    .map((t) => `${t.agent}: ${t.summary_conclusion.slice(0, 600)}`)
    .join('\n');
  const directorName = cycle.directorLabel ?? 'Director';
  let context = `${directorName}: ${cycle.question}\n${agentBits}`;
  if (cycle.directorNote) context += `\nDirector note (prior): ${cycle.directorNote}`;
  if (cycle.referenceUrl) context += `\nReference (prior): ${cycle.referenceUrl}`;
  if (directorNote?.trim()) {
    context += `\n\n---\n\nDirector note / additional context for this continuation:\n${directorNote.trim()}`;
  }
  if (referenceUrl?.trim()) {
    context += `\nReference for this continuation: ${referenceUrl.trim()}`;
  }
  return context;
}

function buildPriorContext(
  cycles: Cycle[],
  directorNote?: string,
  referenceUrl?: string
): string {
  if (cycles.length === 0 && !directorNote?.trim() && !referenceUrl?.trim()) return '';
  const chronological = [...cycles].reverse();
  const history = chronological
    .map((c) => {
      const agentBits = c.turns
        .map((t) => `${t.agent}: ${t.summary_conclusion.slice(0, 500)}`)
        .join('\n');
      const directorName = c.directorLabel ?? 'Director';
      let block = `${directorName}: ${c.question}\n${agentBits}`;
      if (c.directorNote) block += `\nDirector note: ${c.directorNote}`;
      if (c.referenceUrl) block += `\nReference: ${c.referenceUrl}`;
      return block;
    })
    .join('\n\n---\n\n');
  let extra = history;
  if (directorNote?.trim()) {
    extra += `\n\n---\n\nDirector note / additional context for this continuation:\n${directorNote.trim()}`;
  }
  if (referenceUrl?.trim()) {
    extra += `\nReference for this continuation: ${referenceUrl.trim()}`;
  }
  return extra;
}

const MODE_OPTIONS: { id: WorkMode; label: string; description: string }[] = [
  { id: 'brainstorm', label: 'Brainstorm', description: 'Open perspectives and collective exploration. Light scoring.' },
  { id: 'assist', label: 'Assist / Think with me', description: 'Help clarify, structure, or pressure-test an idea you already have.' },
  { id: 'construct', label: 'Construct & Verify', description: 'Produce a structured artifact that can earn Proof-of-Value.' },
];

const AGENT_STYLE: Record<
  string,
  { label: string; role: string; accent: string; border: string; chip: string; mark: string }
> = {
  '@Astra': { label: '@Astra', role: 'Researcher & Grounder', accent: 'text-calm-astra', border: 'border-calm-astra/35', chip: 'border-calm-astra/40 bg-calm-astra/10 text-calm-astra', mark: 'A' },
  '@Kaelen': { label: '@Kaelen', role: 'Adversarial Critic', accent: 'text-calm-kaelen', border: 'border-calm-kaelen/35', chip: 'border-calm-kaelen/40 bg-calm-kaelen/10 text-calm-kaelen', mark: 'K' },
  '@Synthetix': { label: '@Synthetix', role: 'Builder', accent: 'text-calm-synthetix', border: 'border-calm-synthetix/35', chip: 'border-calm-synthetix/40 bg-calm-synthetix/10 text-calm-synthetix', mark: 'S' },
  '@Veritas': { label: '@Veritas', role: 'Verification Sentinel', accent: 'text-calm-veritas', border: 'border-calm-veritas/35', chip: 'border-calm-veritas/40 bg-calm-veritas/10 text-calm-veritas', mark: 'V' },
};

function AgentTurn({ turn }: { turn: SwarmTurn }) {
  const style = AGENT_STYLE[turn.agent] ?? {
    label: turn.agent, role: 'Contributor', accent: 'text-calm-accent', border: 'border-calm-border',
    chip: 'border-calm-border text-calm-muted', mark: '·',
  };
  return (
    <div className={`rounded-lg border ${style.border} bg-calm-bg/40 p-3 sm:p-4`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${style.chip}`} aria-hidden>
          {style.mark}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-xs font-medium tracking-wide ${style.accent}`}>{style.label}</p>
            <span className={`chip ${style.chip}`}>{style.role}</span>
          </div>
          <p className="mt-2 break-words text-sm leading-relaxed text-calm-text whitespace-pre-wrap [overflow-wrap:anywhere]">
            {turn.summary_conclusion}
          </p>
        </div>
      </div>
    </div>
  );
}

function ContributionNote({ verdict }: { verdict: Verdict }) {
  if (verdict.pov_eligible) {
    return (
      <div className="rounded-md border border-calm-accent/40 bg-calm-accent/10 px-3 py-2.5 text-xs text-calm-text">
        <p className="font-medium text-calm-accent">Collaborative contribution advanced</p>
        <p className="mt-1 text-calm-muted">
          This cycle was verified. Proof-of-Value was recorded for the collaborative artifact under human direction — not a ranking of agents or Directors. Score {verdict.score}/100.
        </p>
      </div>
    );
  }
  const score = verdict.score ?? 0;
  if (score >= 70) {
    return (
      <div className="rounded-md border border-calm-border bg-calm-bg px-3 py-2.5 text-xs text-calm-muted">
        <p className="font-medium text-calm-text">Strong collaborative progress</p>
        <p className="mt-1">Score {score}/100. Not yet verified for Proof-of-Value. You can continue the thread to strengthen grounding, clarity, or structure.</p>
      </div>
    );
  }
  return (
    <div className="rounded-md bg-calm-bg px-3 py-2 text-xs text-calm-muted">
      Not yet verified — no Proof-of-Value awarded. Score {verdict.score ?? '—'}/100. You can continue the thread to improve it.
    </div>
  );
}

export default function OrientationPod({
  podId, podName, podSummary, initialRemainingPrompts, initialCycles, userEmail, currentDirectorLabel = 'Director',
}: OrientationPodProps) {
  const [directorPrompt, setDirectorPrompt] = useState('');
  const [directorNote, setDirectorNote] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentText, setAttachmentText] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const [attachmentInputKey, setAttachmentInputKey] = useState(0);
  const [mode, setMode] = useState<WorkMode>('construct');
  const [liveSummary, setLiveSummary] = useState(podSummary);
  const [cycles, setCycles] = useState<Cycle[]>(
    initialCycles.map((cycle) => ({
      ...cycle,
      directorLabel: cycle.directorLabel ?? 'Director',
      verdict: parseVerdictFromVeritasText(cycle.turns.find((t) => t.agent === '@Veritas')?.summary_conclusion),
    }))
  );
  const [expandedCycle, setExpandedCycle] = useState<number | null>(initialCycles.length > 0 ? 0 : null);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'thinking' | 'error' | 'limit_reached' | 'duplicate'>('idle');
  const [remainingPrompts, setRemainingPrompts] = useState(initialRemainingPrompts);
  const [isFollowUp, setIsFollowUp] = useState(initialCycles.length > 0);
  const [resumeCycleIndex, setResumeCycleIndex] = useState<number | null>(initialCycles.length > 0 ? 0 : null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  async function handleDirect() {
    if (!directorPrompt.trim() || remainingPrompts <= 0) return;
    setStatus('thinking');
    setPendingQuestion(directorPrompt);
    let priorContext = '';
    if (isFollowUp && cycles.length > 0) {
      if (resumeCycleIndex !== null && cycles[resumeCycleIndex]) {
        priorContext = buildPriorContextFromCycle(cycles[resumeCycleIndex], directorNote, referenceUrl);
      } else {
        priorContext = buildPriorContext(cycles, directorNote, referenceUrl);
      }
    } else if (directorNote.trim() || referenceUrl.trim()) {
      priorContext = [
        directorNote.trim() && `Director note / additional context:\n${directorNote.trim()}`,
        referenceUrl.trim() && `Reference: ${referenceUrl.trim()}`,
      ].filter(Boolean).join('\n');
    }
    try {
      const res = await fetch('/api/orchestra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          director_prompt: directorPrompt,
          pod_id: podId,
          prior_context: priorContext || undefined,
          mode,
          director_note: directorNote.trim() || undefined,
          reference_url: referenceUrl.trim() || undefined,
          attachment_name: attachmentName || undefined,
          attachment_text: attachmentText || undefined,
        }),
      });
      if (res.status === 429) { setStatus('limit_reached'); setRemainingPrompts(0); setPendingQuestion(null); return; }
      if (res.status === 409) { setStatus('duplicate'); setPendingQuestion(null); return; }
      if (!res.ok) throw new Error('orchestra_unavailable');
      const data = await res.json();
      setCycles((prev) => [{
        question: directorPrompt,
        directorLabel: data.director_label || currentDirectorLabel,
        turns: data.turns ?? [],
        verdict: data.verification ?? null,
        mode: (data.mode as WorkMode) ?? mode,
        directorNote: data.director_note ?? (directorNote.trim() || null),
        referenceUrl: data.reference_url ?? (referenceUrl.trim() || null),
        attachmentName: data.attachment_name ?? (attachmentName || null),
      }, ...prev]);
      if (typeof data.rolling_summary === 'string' && data.rolling_summary.trim()) setLiveSummary(data.rolling_summary);
      setExpandedCycle(0); setResumeCycleIndex(0); setPendingQuestion(null);
      setDirectorPrompt(''); setDirectorNote(''); setReferenceUrl('');
      setAttachmentName(''); setAttachmentText(''); setAttachmentError('');
      setAttachmentInputKey((k) => k + 1); setIsFollowUp(true);
      setRemainingPrompts((n) => Math.max(n - 1, 0)); setStatus('idle');
    } catch {
      setStatus('error'); setPendingQuestion(null);
    }
  }

  function startFresh() {
    setIsFollowUp(false); setResumeCycleIndex(null); setDirectorPrompt('');
    setDirectorNote(''); setReferenceUrl(''); setAttachmentName(''); setAttachmentText('');
    setAttachmentError(''); setAttachmentInputKey((k) => k + 1);
  }

  async function onAttachmentSelected(file: File | null) {
    setAttachmentError(''); setAttachmentName(''); setAttachmentText('');
    if (!file) return;
    if (!/\.(txt|md|csv|json|text)$/i.test(file.name)) { setAttachmentError('Text files only for now (.txt, .md, .csv, .json).'); return; }
    if (file.size > 40 * 1024) { setAttachmentError('Keep attachments under 40KB for this phase.'); return; }
    try {
      const text = await file.text();
      if (!text.trim()) { setAttachmentError('That file looks empty.'); return; }
      setAttachmentName(file.name); setAttachmentText(text.slice(0, 12000));
    } catch { setAttachmentError('Could not read that file.'); }
  }

  function continueFromCycle(index: number) {
    setIsFollowUp(true); setResumeCycleIndex(index); setExpandedCycle(index);
    setDirectorPrompt(''); setDirectorNote(''); setReferenceUrl('');
    setAttachmentName(''); setAttachmentText(''); setAttachmentError('');
    setAttachmentInputKey((k) => k + 1);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function copyCycle(index: number) {
    const cycle = cycles[index];
    if (!cycle) return;
    const text = formatCyclePlainText(cycle, podName);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 2000);
    } catch { window.prompt('Copy this study thread:', text); }
  }

  const activeCycle = isFollowUp && resumeCycleIndex !== null ? cycles[resumeCycleIndex] : cycles[0];
  const activeModeLabel = MODE_OPTIONS.find((o) => o.id === mode)?.label ?? 'Construct & Verify';
  const isFirstExperience = cycles.length === 0 && !pendingQuestion;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-12">
      <SiteNav variant="app" userEmail={userEmail} />

      <header className="space-y-3 rounded-xl border border-calm-border-soft bg-calm-surface/60 p-4 shadow-glow sm:p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-calm-muted">Brainpod · {podName} Mini-Pod</p>
        <h1 className="text-2xl font-medium leading-snug text-calm-text">Human direction. Verified results.</h1>
        {liveSummary && <p className="text-sm leading-relaxed text-calm-muted">{liveSummary}</p>}
        <p className="text-xs leading-relaxed text-calm-muted">
          Choose the kind of work you want, then direct the swarm. Continue a thread or start fresh. Nothing earns Proof-of-Value until @Veritas says so — no cash-out, no gaming the ledger.
        </p>
      </header>

      <div className="panel p-4 text-sm text-calm-muted">
        {remainingPrompts} Director prompt{remainingPrompts === 1 ? '' : 's'} remaining today · resets 00:00 UTC
      </div>

      {isFirstExperience && (
        <div className="rounded-lg border border-calm-accent/30 bg-calm-accent/5 p-4 text-sm text-calm-text">
          <p className="font-medium">Welcome, Director.</p>
          <p className="mt-2 text-calm-muted">
            This is your Orientation Mini-Pod. Start with any mode that fits what you need right now. Brainstorm for open exploration, Assist when you already have an idea to refine, or Construct when you want a structured result that can be verified.
          </p>
        </div>
      )}

      <section className="panel space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-calm-muted">What kind of work is this?</p>
          <p className="chip border-calm-accent/40 bg-calm-accent-soft text-calm-accent">{activeModeLabel}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODE_OPTIONS.map((opt) => (
            <button key={opt.id} type="button" onClick={() => setMode(opt.id)}
              className={`rounded-lg border p-3 text-left transition ${
                mode === opt.id
                  ? 'border-calm-accent bg-calm-accent/10 text-calm-text ring-1 ring-calm-accent/40'
                  : 'border-calm-border bg-calm-surface text-calm-muted hover:border-calm-accent/50'
              }`}>
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="mt-1 text-xs opacity-80">{opt.description}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="panel-elevated space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="director-prompt" className="text-sm font-medium text-calm-text">
            {isFollowUp ? 'Continue the conversation' : 'Direct the swarm'}
          </label>
          {isFollowUp && cycles.length > 0 && (
            <button onClick={startFresh} className="text-xs text-calm-muted underline hover:text-calm-text">Start a fresh question instead</button>
          )}
        </div>
        {isFollowUp && activeCycle && (
          <div className="rounded-md border border-calm-border/60 bg-calm-bg/50 px-3 py-2 text-xs text-calm-muted">
            Continuing from: “{activeCycle.question.slice(0, 120)}{activeCycle.question.length > 120 ? '…' : ''}”
            {activeCycle.directorLabel ? ` · directed by ${activeCycle.directorLabel}` : ''}
            {activeCycle.mode ? ` · previous mode: ${activeCycle.mode}` : ''}
          </div>
        )}
        <textarea id="director-prompt" rows={3} value={directorPrompt} onChange={(e) => setDirectorPrompt(e.target.value)}
          className="w-full rounded-lg border border-calm-border bg-calm-surface p-3 text-sm text-calm-text focus:border-calm-accent focus:outline-none"
          placeholder={isFollowUp ? 'Add a follow-up, new angle, clarification, or additional context…' : mode === 'brainstorm' ? 'What would you like to explore or brainstorm together?' : mode === 'assist' ? 'What idea or problem would you like help thinking through?' : SUGGESTED_PROMPT}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="director-note" className="text-xs text-calm-muted">Optional note (short)</label>
            <textarea id="director-note" rows={2} maxLength={800} value={directorNote} onChange={(e) => setDirectorNote(e.target.value)}
              className="w-full rounded-lg border border-calm-border/70 bg-calm-bg/40 p-2.5 text-xs text-calm-text placeholder:text-calm-muted/70 focus:border-calm-accent focus:outline-none"
              placeholder="Constraint, prior decision, or brief clarification…" />
          </div>
          <div className="space-y-1">
            <label htmlFor="reference-url" className="text-xs text-calm-muted">Optional reference link</label>
            <input id="reference-url" type="url" maxLength={500} value={referenceUrl} onChange={(e) => setReferenceUrl(e.target.value)}
              className="w-full rounded-lg border border-calm-border/70 bg-calm-bg/40 p-2.5 text-xs text-calm-text placeholder:text-calm-muted/70 focus:border-calm-accent focus:outline-none"
              placeholder="https://…" />
            <p className="text-[11px] text-calm-muted">Public http(s) URL only.</p>
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor="director-attachment" className="text-xs text-calm-muted">Optional text attachment</label>
          <input key={attachmentInputKey} id="director-attachment" type="file"
            accept=".txt,.md,.csv,.json,.text,text/plain,text/markdown,text/csv,application/json"
            className="block w-full text-xs text-calm-muted file:mr-3 file:rounded file:border-0 file:bg-calm-surface file:px-3 file:py-2 file:text-xs file:text-calm-text"
            onChange={(e) => onAttachmentSelected(e.target.files?.[0] ?? null)} />
          {attachmentName && <p className="text-[11px] text-calm-accent">Attached: {attachmentName}</p>}
          {attachmentError && <p className="text-[11px] text-red-400">{attachmentError}</p>}
          <p className="text-[11px] text-calm-muted">.txt / .md / .csv / .json · under 40KB. PDF and images come later.</p>
        </div>
        <p className="text-xs text-calm-muted">
          {isFollowUp ? `Continuing in ${activeModeLabel} mode. Change the mode above if you want a different kind of response.` : mode === 'brainstorm' ? 'Brainstorm mode prioritizes open perspectives over scoring.' : mode === 'assist' ? 'Assist mode focuses on clarifying and strengthening your thinking.' : 'Construct mode aims for a structured artifact that can be verified.'}
        </p>
        <button onClick={handleDirect} disabled={status === 'thinking' || remainingPrompts <= 0 || !directorPrompt.trim()}
          className="rounded-lg bg-calm-accent px-4 py-2 text-sm font-medium text-calm-bg disabled:opacity-40">
          {status === 'thinking' ? 'Swarm is working…' : isFollowUp ? 'Continue with swarm' : 'Send to swarm'}
        </button>
        {status === 'error' && <p className="text-sm text-red-400">The orchestra service isn’t reachable yet — this is expected until apps/orchestra is running and its API keys are configured.</p>}
        {status === 'limit_reached' && <p className="text-sm text-calm-muted">You've used today's Director prompts for your membership tier. They reset at 00:00 UTC.</p>}
        {status === 'duplicate' && <p className="text-sm text-calm-muted">This exact question already has a verified result — try a new angle or a different question to earn Proof-of-Value.</p>}
      </section>

      <section className="space-y-3">
        {pendingQuestion && (
          <article className="rounded-xl border border-calm-border bg-calm-surface p-4 shadow-panel">
            <p className="text-xs text-calm-muted">Directed by {currentDirectorLabel}</p>
            <p className="mt-1 text-sm text-calm-text">{pendingQuestion}</p>
            <p className="mt-2 text-xs text-calm-muted">Swarm is working…</p>
          </article>
        )}
        {cycles.length > 0 && (
          <p className="text-xs text-calm-muted">
            Prior work in this pod. Use <span className="text-calm-text">Continue</span> to resume, or <span className="text-calm-text">Copy thread</span> for a plain-text takeaway.
          </p>
        )}
        {cycles.map((cycle, i) => {
          const isExpanded = expandedCycle === i;
          const isActiveResume = isFollowUp && resumeCycleIndex === i;
          return (
            <article key={i} className={`rounded-xl border bg-calm-surface shadow-panel ${
              isActiveResume ? 'border-calm-accent/50 shadow-glow' : 'border-calm-border'
            }`}>
              <div className="flex items-start gap-3 p-4">
                <button onClick={() => setExpandedCycle(isExpanded ? null : i)} className="min-w-0 flex-1 text-left">
                  <p className="text-xs text-calm-accent">Directed by {cycle.directorLabel ?? 'Director'}</p>
                  <p className="mt-1 text-sm text-calm-text">{cycle.question}</p>
                  <p className="mt-1 text-xs text-calm-muted">
                    {cycle.mode ? `${cycle.mode} · ` : ''}{cycle.turns.map((t) => t.agent).join(' → ')}
                    {cycle.referenceUrl ? ' · has reference' : ''}{cycle.attachmentName ? ' · has file' : ''}{isActiveResume ? ' · continuing' : ''}
                  </p>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${
                    cycle.verdict?.pov_eligible ? 'border-calm-accent text-calm-accent' : 'border-calm-border text-calm-muted'
                  }`}>{cycle.verdict ? `${cycle.verdict.score ?? '—'}/100` : '…'}</span>
                  <button type="button" onClick={() => continueFromCycle(i)}
                    className={`text-xs underline ${isActiveResume ? 'text-calm-accent' : 'text-calm-muted hover:text-calm-text'}`}>
                    {isActiveResume ? 'Continuing' : 'Continue'}
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div className="space-y-5 border-t border-calm-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-calm-muted">Expanded thread</p>
                    <button type="button" onClick={() => copyCycle(i)} className="text-xs text-calm-accent underline hover:text-calm-text">
                      {copiedIndex === i ? 'Copied' : 'Copy thread'}
                    </button>
                  </div>
                  <div className="rounded-lg border border-calm-accent/30 bg-calm-accent-soft/30 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-calm-accent/40 bg-calm-accent-soft text-xs font-semibold text-calm-accent">D</span>
                      <div>
                        <p className="text-xs font-medium tracking-wide text-calm-accent">{cycle.directorLabel ?? 'Director'}</p>
                        <p className="text-[11px] text-calm-muted">Human Director</p>
                      </div>
                    </div>
                    <p className="mt-3 break-words text-sm leading-relaxed text-calm-text whitespace-pre-wrap">{cycle.question}</p>
                    {cycle.directorNote && <p className="mt-2 text-xs text-calm-muted whitespace-pre-wrap">Note: {cycle.directorNote}</p>}
                    {cycle.referenceUrl && (
                      <p className="mt-1 text-xs">
                        <a href={cycle.referenceUrl} target="_blank" rel="noopener noreferrer" className="text-calm-accent underline hover:text-calm-text">Reference link</a>
                      </p>
                    )}
                    {cycle.attachmentName && <p className="mt-1 text-xs text-calm-muted">Attachment: {cycle.attachmentName}</p>}
                  </div>
                  {cycle.turns.map((turn, j) => <AgentTurn key={j} turn={turn} />)}
                  {cycle.verdict && <ContributionNote verdict={cycle.verdict} />}
                </div>
              )}
            </article>
          );
        })}
      </section>

      <SiteFooter />
    </main>
  );
}
