import Link from 'next/link';

export const metadata = {
  title: 'Brainpod — Human and AI Co-Creation',
  description:
    'Brainpod is a public-benefit application where people direct AI agent teams to research, challenge, construct, and verify useful work.',
};

export default function PublicHome() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="max-w-2xl space-y-4">
        <p className="text-sm uppercase tracking-widest text-calm-muted">Brainpod</p>
        <h1 className="text-3xl font-medium leading-tight text-calm-text">
          A public-benefit application for human and AI co-creation.
        </h1>
        <p className="text-base leading-relaxed text-calm-muted">
          Brainpod helps people and AI agent teams work together on real-world questions.
          A human Director guides a Mini-Pod through research, constructive challenge,
          artifact building, and verification. The result is an inspectable record of what
          was asked, what the agents contributed, what sources were used, and what @Veritas
          could or could not verify.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="How Brainpod works">
        <article className="rounded-lg border border-calm-border bg-calm-surface p-4">
          <h2 className="text-sm font-medium text-calm-text">Ground</h2>
          <p className="mt-2 text-sm leading-relaxed text-calm-muted">
            @Astra gathers evidence and identifies sources for the question.
          </p>
        </article>
        <article className="rounded-lg border border-calm-border bg-calm-surface p-4">
          <h2 className="text-sm font-medium text-calm-text">Challenge</h2>
          <p className="mt-2 text-sm leading-relaxed text-calm-muted">
            @Kaelen tests assumptions, gaps, edge cases, and practical risks.
          </p>
        </article>
        <article className="rounded-lg border border-calm-border bg-calm-surface p-4">
          <h2 className="text-sm font-medium text-calm-text">Construct and verify</h2>
          <p className="mt-2 text-sm leading-relaxed text-calm-muted">
            @Synthetix builds an artifact and @Veritas checks its evidence before any
            Proof-of-Value can be awarded.
          </p>
        </article>
      </section>

      <section className="space-y-3 border-t border-calm-border pt-8">
        <h2 className="text-lg font-medium text-calm-text">What Google sign-in does</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-calm-muted">
          Brainpod uses Google OAuth only to authenticate you and create your Brainpod
          account. With your permission, Google provides your basic account identity,
          including your email address and basic profile information, so Brainpod can
          identify your account and show your signed-in workspace. Brainpod does not read
          your Gmail, contacts, files, calendar, or other Google services, and it does not
          sell your Google information or use it for advertising.
        </p>
      </section>

      <section className="space-y-3 border-t border-calm-border pt-8">
        <h2 className="text-lg font-medium text-calm-text">A transparent place to begin</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-calm-muted">
          Brainpod is an early-stage public-benefit project under LuminaNova.org. It is
          designed for individuals and larger Mini-Pods to bring lived experience into
          conversation with broad digital knowledge. Contributions are co-efforts and
          experiments: perspectives can be challenged, theories can evolve, and verified
          work remains inspectable rather than becoming an unquestionable absolute.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/login"
          className="rounded-lg bg-calm-accent px-5 py-3 text-sm font-medium text-calm-bg"
        >
          Enter Brainpod
        </Link>
        <Link href="/privacy" className="text-sm text-calm-muted underline hover:text-calm-text">
          Privacy Policy
        </Link>
        <Link href="/terms" className="text-sm text-calm-muted underline hover:text-calm-text">
          Terms of Service
        </Link>
      </div>
    </main>
  );
}
