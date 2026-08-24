/** Structured Markdown for a public (or exportable) Brainpod study. */

export type StudyMarkdownInput = {
  question: string | null;
  podName: string;
  category: string;
  publicSummary: string | null;
  content: string | null;
  isVerified: boolean;
  score: number | null;
  releasedAt?: string | null;
  studyUrl?: string | null;
};

export function formatStudyMarkdown(args: StudyMarkdownInput): string {
  const verification = args.isVerified
    ? `Verified · ${args.score ?? '—'}/100`
    : typeof args.score === 'number'
      ? `${args.score}/100 · not verified`
      : 'Not verified';

  const lines: string[] = [
    `# ${args.question?.trim() || 'Released study'}`,
    '',
    `**Commons:** Brainpod · ${args.category}`,
    `**From:** ${args.podName}`,
    `**Verification:** ${verification}`,
  ];

  if (args.releasedAt) {
    lines.push(`**Released:** ${args.releasedAt}`);
  }
  if (args.studyUrl) {
    lines.push(`**URL:** ${args.studyUrl}`);
  }

  lines.push('', '## Director question', '', args.question?.trim() || 'Released study');

  lines.push(
    '',
    '## Director release note',
    '',
    args.publicSummary?.trim() ||
      '_No public summary was provided for this release._'
  );

  if (args.content?.trim()) {
    lines.push('', '## Constructed artifact', '', args.content.trim());
  }

  lines.push(
    '',
    '## How to read this study',
    '',
    'Proof-of-Value (verification) is **study-level rigor** under the Director’s stated materials and constraints — not a ranking of agents, and not a payment or marketplace signal.',
    '',
    'The Director release note is human-authored and separate from @Veritas. Public insights on the live page are optional peer notes, not a second verification pass.',
    '',
    '---',
    '',
    '_Shared from Brainpod (LuminaNova.org 501(c)(3)). Attribution is collective; appearance here is not independent scientific certification by itself._'
  );

  return lines.join('\n');
}

export function studyMarkdownFilename(question: string | null, artifactId: string): string {
  const base = (question || 'brainpod-study')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return `${base || 'brainpod-study'}-${artifactId.slice(0, 8)}.md`;
}
