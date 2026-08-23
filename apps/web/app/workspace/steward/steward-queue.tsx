'use client';

import { useState } from 'react';
import Link from 'next/link';
import { REPORT_REASON_LABELS, type ReportReason } from '@/lib/steward';

type ReportRow = {
  id: string;
  reason: ReportReason;
  note: string | null;
  status: string;
  source: string;
  created_at: string;
  artifact_id: string;
  artifacts: {
    id: string;
    question: string | null;
    public_summary: string | null;
    public_release: boolean;
    veritas_score: number | null;
    is_verified: boolean;
  } | null;
};

export default function StewardQueue({ initialReports }: { initialReports: ReportRow[] }) {
  const [reports, setReports] = useState(initialReports);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function act(reportId: string, action: 'dismiss' | 'unpublish' | 'reviewed') {
    setBusyId(reportId);
    setMessage('');
    try {
      const res = await fetch('/api/steward/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: reportId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.detail ?? data.error ?? 'Action failed');
        setBusyId(null);
        return;
      }
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setMessage(
        action === 'unpublish'
          ? 'Release unpublished and report closed.'
          : action === 'dismiss'
            ? 'Report dismissed.'
            : 'Marked reviewed.'
      );
    } catch {
      setMessage('Action failed');
    }
    setBusyId(null);
  }

  if (reports.length === 0) {
    return (
      <p className="rounded-lg border border-calm-border bg-calm-surface/60 p-4 text-sm text-calm-muted">
        No open reports. The commons is quiet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {message && <p className="text-xs text-calm-muted">{message}</p>}
      {reports.map((report) => {
        const art = report.artifacts;
        return (
          <article
            key={report.id}
            className="space-y-3 rounded-xl border border-calm-border bg-calm-surface p-4 shadow-panel"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-calm-muted">
              <span className="chip border-calm-border text-calm-text">
                {REPORT_REASON_LABELS[report.reason] ?? report.reason}
              </span>
              <span>{report.source === 'system' ? 'System signal' : 'Human report'}</span>
              <span>{new Date(report.created_at).toLocaleString()}</span>
            </div>
            <p className="text-sm text-calm-text">
              {art?.question?.trim() || 'Released study'}
            </p>
            {art?.public_summary && (
              <p className="text-xs text-calm-muted whitespace-pre-wrap break-words">
                {art.public_summary.slice(0, 400)}
                {art.public_summary.length > 400 ? '…' : ''}
              </p>
            )}
            {report.note && (
              <p className="text-xs text-calm-muted">Note: {report.note}</p>
            )}
            <div className="flex flex-wrap gap-3 text-xs">
              <Link
                href={`/explore/study/${report.artifact_id}`}
                className="underline hover:text-calm-text text-calm-accent"
              >
                View public page
              </Link>
              <button
                type="button"
                disabled={busyId === report.id}
                onClick={() => act(report.id, 'unpublish')}
                className="underline text-calm-muted hover:text-calm-text disabled:opacity-40"
              >
                Unpublish
              </button>
              <button
                type="button"
                disabled={busyId === report.id}
                onClick={() => act(report.id, 'dismiss')}
                className="underline text-calm-muted hover:text-calm-text disabled:opacity-40"
              >
                Dismiss
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
