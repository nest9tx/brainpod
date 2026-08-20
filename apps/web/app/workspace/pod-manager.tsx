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

export default function PodManager({ initialPods }: { initialPods: Pod[] }) {
  const [pods, setPods] = useState(initialPods);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function createPod() {
    if (!newName.trim()) return;
    setBusy(true);
    setError('');
    const response = await fetch('/api/workspace/pods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
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
      body: JSON.stringify({ id, name: editingName }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.detail ?? 'Could not rename the pod.');
    else {
      setPods((current) => current.map((pod) => (pod.id === id ? data.pod : pod)));
      setEditingId(null);
    }
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
                    }}
                    className="text-xs text-calm-muted underline"
                  >
                    Rename
                  </button>
                  <span className="rounded-full border border-calm-accent px-2 py-0.5 text-xs text-calm-accent">
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
          <button onClick={createPod} disabled={busy || !newName.trim()} className="rounded-lg bg-calm-accent px-4 py-2 text-sm font-medium text-calm-bg disabled:opacity-40">
            Create pod
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </section>
    </>
  );
}
