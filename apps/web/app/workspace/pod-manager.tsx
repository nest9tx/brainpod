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
    else setArtifacts((current) => current.map((item) => item.id === artifact.id ? data.artifact : item));
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
                <div className="flex items-center gap-3">
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
                    {categories.find((category) => category.slug === pod.category_slug)?.display_name ?? pod.category_slug}
                  </span>
                  <span className="rounded-full border border-calm-border px-2 py-0.5 text-xs text-calm-muted">
                    {pod.status === 'private_isolated' ? 'Private' : pod.status}
                  </span>
                </div>
              )}
              <p className="max-w-xl text-sm leading-relaxed text-calm-muted">{pod.rolling_summary}</p>
            </div>
            <a href={`/?pod=${pod.id}`} className="shrink-0 rounded-lg bg-calm-accent px-4 py-2 text-sm font-medium text-calm-bg">
              Open pod
            </a>
          </article>
        ))}
      </section>

      {artifacts.length > 0 && (
        <section className="space-y-3 border-t border-calm-border pt-8">
          <h2 className="text-lg font-medium text-calm-text">Studies in your pods</h2>
          {artifacts.map((artifact) => (
            <article key={artifact.id} className="rounded-lg border border-calm-border bg-calm-surface p-4">
              <p className="text-sm text-calm-text">{artifact.question ?? 'Untitled study'}</p>
              <p className="mt-1 text-xs text-calm-muted">
                {artifact.is_verified ? `Verified · ${artifact.veritas_score ?? '—'}/100` : 'Not verified'}
              </p>
              <textarea
                value={summaryDrafts[artifact.id] ?? ''}
                onChange={(event) =>
                  setSummaryDrafts((current) => ({ ...current, [artifact.id]: event.target.value }))
                }
                placeholder="Write a distinct public summary of this study"
                rows={2}
                className="mt-3 w-full rounded border border-calm-border bg-calm-bg p-2 text-sm text-calm-text"
              />
              <button
                onClick={() => setArtifactPublished(artifact)}
                disabled={busy}
                className="mt-2 text-xs text-calm-muted underline"
              >
                {artifact.public_release ? 'Unpublish study summary' : 'Publish study summary'}
              </button>
            </article>
          ))}
        </section>
      )}

      <section className="space-y-3 border-t border-calm-border pt-8">
        <h2 className="text-lg font-medium text-calm-text">Create a private pod</h2>
        <p className="text-sm leading-relaxed text-calm-muted">
          Start a separate room for a different question, domain, or experiment. It belongs to this account until invitations are added.
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
          <button onClick={createPod} disabled={busy || !newName.trim()} className="rounded-lg bg-calm-accent px-4 py-2 text-sm font-medium text-calm-bg disabled:opacity-40">
            Create pod
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </section>
    </>
  );
}
