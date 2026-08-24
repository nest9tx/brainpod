import Link from 'next/link';

/**
 * Calm handoff from a public study into a private Mini-Pod.
 * Does not fork history — only seeds the Director form with the question and lineage note.
 */
export default function StartFromStudyButton({
  artifactId,
  isSignedIn,
}: {
  artifactId: string;
  isSignedIn: boolean;
}) {
  const target = `/?from_study=${encodeURIComponent(artifactId)}`;
  const href = isSignedIn
    ? target
    : `/login?next=${encodeURIComponent(target)}`;

  return (
    <div className="rounded-lg border border-calm-border bg-calm-bg/40 p-4 space-y-2">
      <p className="text-sm font-medium text-calm-text">Continue this inquiry privately</p>
      <p className="text-xs leading-relaxed text-calm-muted">
        Opens your Mini-Pod with this question ready to send. History is not copied — you start a
        fresh directed cycle with a soft link back to the public source. You choose mode and when
        to send.
      </p>
      <Link
        href={href}
        className="inline-block text-sm text-calm-accent underline hover:text-calm-text"
      >
        {isSignedIn ? 'Start from this study' : 'Sign in to start from this study'}
      </Link>
    </div>
  );
}
