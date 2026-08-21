'use client';

import { useState } from 'react';
import Link from 'next/link';

type Pod = {
  id: string;
  name: string;
  category_slug: string;
  status: string;
  rolling_summary: string;
  created_at: string;
  is_owner?: boolean;
  can_direct?: boolean;
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

type PendingInvite = {
  id: string;
  token: string;
  pod_name: string;
  expires_at: string;
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
  pendingInvites = [],
}: {
  initialPods: Pod[];
  categories: Category[];
  initialArtifacts: Artifact[];
  pendingInvites?: PendingInvite[];
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
  const [inviteEmailByPod, setInviteEmailByPod] = useState<Record<string, string>>({});
  const [lastInviteUrlByPod, setLastInviteUrlByPod] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const podNameById = Object.fromEntries(pods.map((pod) => [pod.id, pod.name]));

  const groupedArtifacts = Array.from(
    artifacts
      .reduce((groups, artifact) => {
        const key = `${artifact.pod_id}::${artifact.question?.trim().toLowerCase() ?? artifact.id}`;
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
      setPods((current) => [...current, { ...data.pod, is_owner: true, can_direct: true }]);
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
      setPods((current) =>
        current.map((pod) => (pod.id === id ? { ...pod, ...data.pod, is_owner: true } : pod))
      );
      setEditingId(null);
    }
    setBusy(false);
  }

  async function setArtifactRelease(artifact: Artifact, publish: boolean) {
    const summary = summaryDrafts[artifact.id]?.trim() ?? '';
    setBusy(true);
    setError('');
    const response = await fetch('/api/workspace/artifacts/publish', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: artifact.id, publish, public_summary: summary }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.detail ?? data.error ?? 'Could not update study visibility.');
    } else {
      setArtifacts((current) =>
        current.map((item) => (item.id === artifact.id ? data.artifact : item))
      );
      if (typeof data.artifact?.public_summary === 'string') {
        setSummaryDrafts((current) => ({
          ...current,
          [artifact.id]: data.artifact.public_summary ?? '',
        }));
      }
    }
    setBusy(false);
  }

  async function sendInvite(podId: string) {
    const email = (inviteEmailByPod[podId] ?? '').trim();
    if (!email) return;
    setBusy(true);
    setError('');
    setInfo('');
    const response = await fetch('/api/workspace/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pod_id: podId, email, can_direct: true }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.detail ?? data.error ?? 'Could not create the invitation.');
    } else {
      setLastInviteUrlByPod((current) => ({ ...current, [podId]: data.invite_url }));
      setInviteEmailByPod((current) => ({ ...current, [podId]: '' }));
      if (data.email?.sent) {
        setInfo(`Invitation emailed to ${data.invite.invited_email}.`);
      } else {
        setInfo(
          `Invitation created for ${data.invite.invited_email}. Copy the link below to share it (email delivery is not configured yet).`
        );
      }
    }
    setBusy(false);
  }

  return (
    <>
      {pendingInvites.length > 0 && (
        <section className="space-y-3 rounded-lg border border-calm-accent/30 bg-calm-accent/5 p-4">
          <h2 className="text-sm font-medium text-calm-text">Pending invitations for you</h2>
          {pendingInvites.map((invite) => (
            <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-calm-muted">
                {invite.pod_name}
              </span>
              <Link
                href={`/invite/${invite.token}`}
                className="text-calm-accent underline hover:text-calm-text"
              >
                Review & accept
              </Link>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3" aria-label="Your Mini-Pods">
        {pods.map((pod) => (
          <article
            key={pod.id}
            className="space-y-3 rounded-lg border border-calm-border bg-calm-surface p-5"
          >
            <div className="flex items-start justify-between gap-5">
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
                    <button
                      onClick={() => renamePod(pod.id)}
                      disabled={busy}
                      className="text-xs text-calm-accent underline"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-calm-muted underline"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-base font-medium text-calm-text">{pod.name}</h2>
                    {pod.is_owner && (
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
                    )}
                    <span className="rounded-full border border-calm-accent px-2 py-0.5 text-xs text-calm-accent">
                      {categories.find((category) => category.slug === pod.category_slug)
                        ?.display_name ?? pod.category_slug}
                    </span>
                    <span className="rounded-full border border-calm-border px-2 py-0.5 text-xs text-calm-muted">
                      {pod.is_owner ? 'Owner' : 'Shared with you'}
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
            </div>

            {pod.is_owner && (
              <div className="space-y-2 border-t border-calm-border pt-3">
                <p className="text-xs text-calm-muted">
                  Invite a collaborator by email (5 invites/day). They can sign up with that email if
                  needed.
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="email"
                    value={inviteEmailByPod[pod.id] ?? ''}
                    onChange={(event) =>
                      setInviteEmailByPod((current) => ({
                        ...current,
                        [pod.id]: event.target.value,
                      }))
                    }
                    placeholder="collaborator@example.com"
                    className="min-w-0 flex-1 rounded border border-calm-border bg-calm-bg px-3 py-1.5 text-sm text-calm-text"
                  />
                  <button
                    onClick={() => sendInvite(pod.id)}
                    disabled={busy || !(inviteEmailByPod[pod.id] ?? '').trim()}
                    className="rounded border border-calm-border px-3 py-1.5 text-xs text-calm-text disabled:opacity-40"
                  >
                    Send invite
                  </button>
                </div>
                {lastInviteUrlByPod[pod.id] && (
                  <p className="break-all text-xs text-calm-muted">
                    Invite link:{' '}
                    <a
                      href={lastInviteUrlByPod[pod.id]}
                      className="text-calm-accent underline"
                    >
                      {lastInviteUrlByPod[pod.id]}
                    </a>
                  </p>
                )}
              </div>
            )}
          </article>
        ))}
      </section>

      {(error || info) && (
        <p className={`text-sm ${error ? 'text-red-400' : 'text-calm-muted'}`}>{error || info}</p>
      )}

      {artifacts.length > 0 && (
        <section className="space-y-3 border-t border-calm-border pt-8">
          <div className="space-y-1">
            <h2 className="text-lg font-medium text-calm-text">Studies in your pods</h2>
            <p className="text-xs text-calm-muted">
              Review collaborative work across your Mini-Pods. Use Continue to open the originating pod.
            </p>
          </div>

          {groupedArtifacts.map((attempts) => {
            const first = attempts[0];
            const questionKey = `${first.pod_id}::${first.question?.trim().toLowerCase() ?? first.id}`;
            const isExpanded = expandedStudy === questionKey;
            const best = attempts.reduce((acc, a) => {
              if (a.is_verified) return a;
              if (!acc.is_verified && (a.veritas_score ?? 0) > (acc.veritas_score ?? 0)) return a;
              return acc;
            }, attempts[0]);
            const bestStatus = studyStatusLabel(best);
            const verifiedCount = attempts.filter((a) => a.is_verified).length;
            const podName = podNameById[first.pod_id] ?? 'Unknown pod';

            return (
              <article
                key={questionKey}
                className={`rounded-lg border bg-calm-surface p-4 ${
                  best.is_verified ? 'border-calm-accent/40' : 'border-calm-border'
                }`}
              >
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => setExpandedStudy(isExpanded ? null : questionKey)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="text-sm text-calm-text">{first.question ?? 'Untitled study'}</span>
                    <p className="mt-1 text-xs text-calm-muted">
                      In <span className="text-calm-text">{podName}</span>
                      {' · '}
                      {attempts.length} attempt{attempts.length === 1 ? '' : 's'}
                      {verifiedCount > 0 ? ` · ${verifiedCount} verified` : ''}
                      {best.public_release ? ' · public summary released' : ''}
                    </p>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${bestStatus.tone}`}>
                      {bestStatus.label}
                    </span>
                    <div className="flex items-center gap-3 text-xs">
                      <a
                        href={`/?pod=${first.pod_id}`}
                        className="text-calm-accent underline hover:text-calm-text"
                      >
                        Continue
                      </a>
                      <button
                        type="button"
                        onClick={() => setExpandedStudy(isExpanded ? null : questionKey)}
                        className="text-calm-muted underline hover:text-calm-text"
                      >
                        {isExpanded ? 'Hide' : 'Review'}
                      </button>
                    </div>
                  </div>
                </div>

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

                          <textarea
                            value={summaryDrafts[artifact.id] ?? ''}
                            onChange={(event) =>
                              setSummaryDrafts((current) => ({
                                ...current,
                                [artifact.id]: event.target.value,
                              }))
                            }
                            placeholder="Write a short public summary in your own words (required to release)"
                            rows={3}
                            className="mt-3 w-full rounded border border-calm-border bg-calm-bg p-2 text-sm text-calm-text"
                          />

                          <div className="mt-2 flex flex-wrap items-center gap-4">
                            {artifact.public_release ? (
                              <>
                                <button
                                  onClick={() => setArtifactRelease(artifact, true)}
                                  disabled={busy}
                                  className="text-xs text-calm-accent underline hover:text-calm-text"
                                >
                                  Update public summary
                                </button>
                                <button
                                  onClick={() => setArtifactRelease(artifact, false)}
                                  disabled={busy}
                                  className="text-xs text-calm-muted underline hover:text-calm-text"
                                >
                                  Unpublish
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setArtifactRelease(artifact, true)}
                                disabled={busy}
                                className="text-xs text-calm-accent underline hover:text-calm-text"
                              >
                                Release public summary
                              </button>
                            )}
                          </div>
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
          Start a separate room for a different question, domain, or experiment. Invite collaborators
          after it exists.
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
      </section>
    </>
  );
}
