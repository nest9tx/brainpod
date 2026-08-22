'use client';

import { useState } from 'react';

export default function DisplayNameEditor({
  initialName,
  email,
}: {
  initialName: string;
  email: string;
}) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function save() {
    const next = name.trim();
    if (!next) return;
    setBusy(true);
    setError('');
    setMessage('');
    const response = await fetch('/api/workspace/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: next }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.detail ?? data.error ?? 'Could not update display name.');
    } else {
      setName(data.display_name ?? next);
      setMessage(
        'Saved. New work will show this name; past turns keep the name used when they were directed.'
      );
    }
    setBusy(false);
  }

  return (
    <section className="panel space-y-3 p-4 sm:p-5">
      <div className="space-y-1">
        <h2 className="text-sm font-medium text-calm-text">Director display name</h2>
        <p className="text-xs leading-relaxed text-calm-muted">
          Shown on questions you direct. Changing it does not rewrite historical labels. Avoid
          frequent changes so collaborators can recognize you. Names are unique ignoring case.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          className="min-w-0 flex-1 rounded-lg border border-calm-border bg-calm-bg px-3 py-2 text-sm text-calm-text"
          placeholder="Display name"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy || !name.trim()}
          className="rounded-lg bg-calm-accent px-4 py-2 text-sm font-medium text-calm-bg disabled:opacity-40"
        >
          Save
        </button>
      </div>
      <p className="text-[11px] text-calm-muted">Signed in as {email}</p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-calm-muted">{message}</p>}
    </section>
  );
}
