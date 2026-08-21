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
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setStatus('saving');
    setMessage('');
    const response = await fetch('/api/workspace/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: trimmed }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus('error');
      setMessage(data.detail ?? 'Could not update display name.');
      return;
    }
    setName(data.profile.display_name);
    setStatus('saved');
    setMessage(
      'Display name updated. New directed work will use this name. Earlier turns keep the name that was set when they were written.'
    );
  }

  return (
    <section className="space-y-3 rounded-lg border border-calm-border bg-calm-surface p-4">
      <div className="space-y-1">
        <h2 className="text-sm font-medium text-calm-text">Director display name</h2>
        <p className="text-xs text-calm-muted">
          Shown on questions you direct in shared pods. Names are unique regardless of
          capitalization (Admin and admin are the same). Prefer a stable name — frequent changes
          make it harder for collaborators to recognize your contributions. Account email stays
          private to auth.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setStatus('idle');
          }}
          maxLength={40}
          className="min-w-0 flex-1 rounded border border-calm-border bg-calm-bg px-3 py-1.5 text-sm text-calm-text"
          placeholder="How you appear as Director"
        />
        <button
          onClick={save}
          disabled={status === 'saving' || !name.trim()}
          className="rounded border border-calm-border px-3 py-1.5 text-xs text-calm-text disabled:opacity-40"
        >
          {status === 'saving' ? 'Saving…' : 'Save name'}
        </button>
      </div>
      <p className="text-xs text-calm-muted">Signed in as {email}</p>
      {message && (
        <p className={`text-xs ${status === 'error' ? 'text-red-400' : 'text-calm-muted'}`}>{message}</p>
      )}
    </section>
  );
}
