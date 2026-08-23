'use client';

import { useState } from 'react';
import { REPORT_REASON_LABELS, type ReportReason } from '@/lib/steward';

const REASONS = Object.keys(REPORT_REASON_LABELS) as ReportReason[];

export default function ReportStudyButton({
  artifactId,
  isSignedIn,
}: {
  artifactId: string;
  isSignedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('self_promotion');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit() {
    setStatus('sending');
    setMessage('');
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifact_id: artifactId,
          reason,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setMessage(data.detail ?? data.error ?? 'Could not send report.');
        return;
      }
      setStatus('done');
      setMessage(data.message ?? 'Report received.');
      setOpen(false);
    } catch {
      setStatus('error');
      setMessage('Could not send report.');
    }
  }

  if (!isSignedIn) {
    return (
      <p className="text-xs text-calm-muted">
        <a href="/login" className="underline hover:text-calm-text">
          Sign in
        </a>{' '}
        to report releases that look like advertising or spam.
      </p>
    );
  }

  if (status === 'done') {
    return <p className="text-xs text-calm-muted">{message}</p>;
  }

  return (
    <div className="space-y-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-calm-muted underline hover:text-calm-text"
        >
          Report this release
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border border-calm-border bg-calm-bg/40 p-3">
          <p className="text-xs text-calm-text">
            Help keep the commons free of advertising and empty noise. Reports go to a human
            steward — not an automatic ban hammer.
          </p>
          <label className="block text-xs text-calm-muted">
            Reason
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
              className="mt-1 w-full rounded-md border border-calm-border bg-calm-surface px-2 py-1.5 text-sm text-calm-text"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {REPORT_REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-calm-muted">
            Optional note (private to stewards)
            <textarea
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-md border border-calm-border bg-calm-surface p-2 text-sm text-calm-text"
              placeholder="What looks promotional or off-mission?"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={status === 'sending'}
              className="rounded-lg bg-calm-accent px-3 py-1.5 text-xs font-medium text-calm-bg disabled:opacity-40"
            >
              {status === 'sending' ? 'Sending…' : 'Submit report'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-calm-muted underline hover:text-calm-text"
            >
              Cancel
            </button>
          </div>
          {message && <p className="text-xs text-calm-muted">{message}</p>}
        </div>
      )}
    </div>
  );
}
