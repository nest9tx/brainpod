'use client';

import { useState } from 'react';

type Pod = {
  id: string;
  name: string;
  category_slug: string;
  status: string;
  rolling_summary: string;
  created_at: string;
};

type Category = {
  slug: string;
  display_name: string;
  description: string | null;
};
type Artifact = {
  id: string;
  pod_id: string;
  question: string | null;
  public_release: boolean;
  public_summary: string | null;
  veritas_score: number | null;
  is_verified: boolean;
};

function studyStatusLabel(artifact: Artifact): { label: string; tone: string } {
  if (artifact.is_verified) {
    return {
      label: `Verified · ${artifact.veritas_score ?? '—'}/100`,
      tone: 'border-calm-accent text-calm-accent',
    };
  }
  const score = artifact.veritas_score;
  if (typeof score === 'number' && score >= 70) {
    return {
      label: `Strong progress · ${score}/100`,
      tone: 'border-calm-border text-calm-text',
    };
  }
  if (typeof score === 'number') {
    return {
      label: `Not verified · ${score}/100`,
      tone: 'border-calm-border text-calm-muted',
    };
  }
  return {
    label: 'Not verified',
    tone: 'border-calm-border text-calm-muted',
  };
}

export default function PodManager({
  initialPods,
  categories,
  initialArtifacts,
}: {
  initialPods: Pod[];
  categories: Category[];
  initialArtifacts: Artifact[];
}) {
  const [pods, setPods] = useState(initialPods);
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [summaryDrafts, setSummaryDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initialArtifacts.map((artifact) => [artifact.id, artifact.public_summary ?? '']))
  );
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState(categories[0]?.slug ?? '');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingCategory, setEditingCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const groupedArtifacts = Array.from(
    artifacts
      .reduce((groups, artifact) => {
        const key = artifact.question?.trim().toLowerCase() ?? artifact.id;
        const group = groups.get(key) ?? [];
        group.push(artifact);
        groups.set(key, group);
        return groups;
      }, new Map<string, Artifact[]>())
      .values()
  );
  const [expandedStudy, setExpandedStudy] = useState<string | null>(null);

  async function createPod() {
    if (!newName.trim()) return;
    setBusy(true);
    setError('');
    const response = await fetch('/api/workspace/pods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, category_slug: newCategory }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.detail ?? 'Could not create the pod.');
    else {
      setPods((current) => [...current, data.pod]);
      setNewName('');
    }
    setBusy(false);
  }

  async function renamePod(id: string) {
    if (!editingName.trim()) return;
    setBusy(true);
    setError('');
    const response = await fetch('/api/workspace/pods', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: editingName, category_slug: editingCategory }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.detail ?? 'Could not rename the pod.');
    else {
      setPods((current) => current.map((pod) => (pod.id === id ? data.pod : pod)));
      setEditingId(null);
    }
    setBusy(false);
  }

  async function setArtifactPublished(artifact: Artifact) {
    const publish = !artifact.public_release;
    const summary = summaryDrafts[artifact.id]?.trim() ?? '';
    setBusy(true);
    setError('');
    const response = await fetch('/api/workspace/artifacts/publish', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: artifact.id, publish, public_summary: summary }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.detail ?? data.error ?? 'Could not update study visibility.');
    else setArtifacts((current) => current.map((item) => (item.id === artifact.id ? data.artifact : item)));
    setBusy(false);
  }

  return (
    <>
      <section className="space-y-3" aria-label="Your Mini-Pods">
        {pods.map((pod) => (
          <article
            key={pod.id}
            className="flex items-center justify-between gap-5 rounded-lg border border-calm-border bg-calm-surface p-5"
          >
            <div className="min-w-0 space-y-2">
              {editingId === pod.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    className="rounded border border-calm-border bg-calm-bg px-2 py-1 text-sm text-calm-text"
                    maxLength={100}
                  />
                  <select
                    value={editingCategory}
                    onChange={(event) => setEditingCategory(event.target.value)}
                    className="rounded border border-calm-border bg-calm-bg px-2 py-1 text-sm text-calm-text"
                  >
                    {categories.map((category) => (
                      <option key={category.slug} value={category.slug}>
                        {category.display_name}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => renamePod(pod.id)} disabled={busy} className="text-xs text-calm-accent underline">
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-calm-muted underline">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-base font-medium text-calm-text">{pod.name}</h2>
                  <button
                    onClick={() => {
                      setEditingId(pod.id);
                      setEditingName(pod.name);
                      setEditingCategory(pod.category_slug);
                    }}
                    className="text-xs text-calm-muted underline"
                  >
                    Rename
                  </button>
                  <span className="rounded-full border border-calm-accent px-2 py-0.5 text-xs text-calm-accent">
                    {categories.find((category) => category.slug === pod.category_slug)?.display_name ??
                      pod.category_slug}
                  </span>
                  <span className="rounded-full border border-calm-border px-2 py-0.5 text-xs text-calm-muted">
                    {pod.status === 'private_isolated' ? 'Private' : pod.status}
                  </span>
                </div>
              )}
              <p className="max-w-xl text-sm leading-relaxed text-calm-muted">{pod.rolling_summary}</p>
            </div>
            <a
              href={`/?pod=${pod.id}`}
              className="shrink-0 rounded-lg bg-calm-accent px-4 py-2 text-sm font-medium text-calm-bg"
            >
              Open pod
            </a>
          </article>
        ))}
      </section>

      {artifacts.length > 0 && (
        <section className="space-y-3 border-t border-calm-border pt-8">
          <div className="space-y-1">
            <h2 className="text-lg font-medium text-calm-text">Studies in your pods</h2>
            <p className="text-xs text-calm-muted">
              Review collaborative work across your Mini-Pods. Verified studies can be given a public
              summary when you choose to release them.
            </p>
          </div>

          {groupedArtifacts.map((attempts) => {
            const questionKey = attempts[0].question?.trim().toLowerCase() ?? attempts[0].id;
            const isExpanded = expandedStudy === questionKey;
            const best = attempts.reduce((acc, a) => {
              if (a.is_verified) return a;
              if (!acc.is_verified && (a.veritas_score ?? 0) > (acc.veritas_score ?? 0)) return a;
              return acc;
            }, attempts[0]);
            const bestStatus = studyStatusLabel(best);
            const verifiedCount = attempts.filter((a) => a.is_verified).length;

            return (
              <article
                key={questionKey}
                className={`rounded-lg border bg-calm-surface p-4 ${
                  best.is_verified ? 'border-calm-accent/40' : 'border-calm-border'
                }`}
              >
                <button
                  onClick={() => setExpandedStudy(isExpanded ? null : questionKey)}
                  className="flex w-full items-start justify-between gap-4 text-left"
                >
                  <div className="min-w-0 space-y-1">
                    <span className="text-sm text-calm-text">{attempts[0].question ?? 'Untitled study'}</span>
                    <p className="text-xs text-calm-muted">
                      {attempts.length} attempt{attempts.length === 1 ? '' : 's'}
                      {verifiedCount > 0 ? ` · ${verifiedCount} verified` : ''}
                      {best.public_release ? ' · public summary released' : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${bestStatus.tone}`}>
                      {bestStatus.label}
                    </span>
                    <span className="text-xs text-calm-muted">{isExpanded ? 'Hide' : 'Review'}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-4 space-y-4 border-t border-calm-border pt-4">
                    {attempts.map((artifact, index) => {
                      const status = studyStatusLabel(artifact);
                      return (
                        <div
                          key={artifact.id}
                          className="border-b border-calm-border pb-4 last:border-0 last:pb-0"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs uppercase tracking-wide text-calm-muted">
                              Attempt {attempts.length - index}
                            </p>
                            <span className={`rounded-full border px-2 py-0.5 text-xs ${status.tone}`}>
                              {status.label}
                            </span>
                          </div>

                          {artifact.is_verified && (
                            <p className="mt-2 text-xs text-calm-accent">
                              Collaborative contribution advanced under human direction with the swarm.
                            </p>
                          )}

                          <textarea
                            value={summaryDrafts[artifact.id] ?? ''}
                            onChange={(event) =>
                              setSummaryDrafts((current) => ({
                                ...current,
                                [artifact.id]: event.target.value,
                              }))
                            }
                            placeholder="Optional public summary of this study (shown if you release it)"
                            rows={2}
                            className="mt-3 w-full rounded border border-calm-border bg-calm-bg p-2 text-sm text-calm-text"
                          />
                          <button
                            onClick={() => setArtifactPublished(artifact)}
                            disabled={busy}
                            className="mt-2 text-xs text-calm-muted underline hover:text-calm-text"
                          >
                            {artifact.public_release
                              ? 'Unpublish study summary'
                              : 'Release public summary'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      <section className="space-y-3 border-t border-calm-border pt-8">
        <h2 className="text-lg font-medium text-calm-text">Create a private pod</h2>
        <p className="text-sm leading-relaxed text-calm-muted">
          Start a separate room for a different question, domain, or experiment. It belongs to this
          account until invitations are added.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Pod name"
            maxLength={100}
            className="min-w-0 flex-1 rounded-lg border border-calm-border bg-calm-surface px-3 py-2 text-sm text-calm-text"
          />
          <select
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            className="rounded-lg border border-calm-border bg-calm-surface px-3 py-2 text-sm text-calm-text"
          >
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.display_name}
              </option>
            ))}
          </select>
          <button
            onClick={createPod}
            disabled={busy || !newName.trim()}
            className="rounded-lg bg-calm-accent px-4 py-2 text-sm font-medium text-calm-bg disabled:opacity-40"
          >
            Create pod
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </section>
    </>
  );
}
