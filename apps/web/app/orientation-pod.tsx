'use client';

import { useState } from 'react';
import SiteNav from '@/components/site-nav';
import SiteFooter from '@/components/site-footer';

// Temporary minimal shell while full room UI is restored from the prior revision.
// Full OrientationPod with modes, attachments, and cycle history is reapplied next.
export type SwarmTurn = {
  agent: string;
  summary_conclusion: string;
  collapsed_reasoning?: string;
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

export default function OrientationPod({
  podName,
  podSummary,
  initialRemainingPrompts,
  userEmail,
}: OrientationPodProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-10 sm:gap-8 sm:px-6 sm:py-16">
      <SiteNav variant="app" userEmail={userEmail} />
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-widest text-calm-muted">
          Brainpod · {podName} Mini-Pod
        </p>
        <h1 className="text-2xl font-medium text-calm-text">
          Restoring the collaborative room…
        </h1>
        <p className="text-sm text-calm-muted">
          A deployment glitch briefly replaced this view. The full Director room is being restored
          immediately. Your studies and pods are safe in the database.
        </p>
        {podSummary && <p className="text-sm text-calm-muted">{podSummary}</p>}
        <p className="text-xs text-calm-muted">
          {initialRemainingPrompts} free Director prompts remaining today.
        </p>
      </header>
      <SiteFooter />
    </main>
  );
}
