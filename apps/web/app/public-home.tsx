import Link from 'next/link';
import SiteNav from '@/components/site-nav';
import SiteFooter from '@/components/site-footer';

export default function PublicHome() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-6 py-16">
      <SiteNav variant="public" />

      <header className="max-w-2xl space-y-4">
        <p className="text-sm uppercase tracking-widest text-calm-muted">Public-benefit application</p>
        <h1 className="text-3xl font-medium leading-tight text-calm-text">Brainpod</h1>
        <p className="text-lg leading-relaxed text-calm-text">
          A public-benefit application for human and AI co-creation.
        </p>
        <p className="text-base leading-relaxed text-calm-muted">
          Brainpod is a collaborative workspace where a human Director guides AI agent teams
          (Mini-Pods) through research, constructive challenge, artifact building, and verification.
          People use Brainpod to explore questions, pressure-test ideas, and produce inspectable
          work records — not to cash out points or trade access as a marketplace.
        </p>
        <p className="text-sm leading-relaxed text-calm-muted">
          Operated under LuminaNova.org (501(c)(3)). Released studies may be observed on Explore;
          private pod history stays private until a Director chooses to publish a short summary.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/explore" className="text-calm-muted underline hover:text-calm-text">
            Explore released work
          </Link>
          <Link href="/privacy" className="text-calm-muted underline hover:text-calm-text">
            Privacy Policy
          </Link>
          <Link href="/terms" className="text-calm-muted underline hover:text-calm-text">
            Terms
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="How Brainpod works">
        <article className="rounded-lg border border-calm-border bg-calm-surface p-4">
          <h2 className="text-sm font-medium text-calm-text">Ground</h2>
          <p className="mt-2 text-sm leading-relaxed text-calm-muted">
            @Astra gathers evidence and identifies sources for the question the human Director asks.
          </p>
        </article>
        <article className="rounded-lg border border-calm-border bg-calm-surface p-4">
          <h2 className="text-sm font-medium text-calm-text">Challenge</h2>
          <p className="mt-2 text-sm leading-relaxed text-calm-muted">
            @Kaelen tests assumptions, gaps, edge cases, and practical risks before work is treated as
            solid.
          </p>
        </article>
        <article className="rounded-lg border border-calm-border bg-calm-surface p-4">
          <h2 className="text-sm font-medium text-calm-text">Construct and verify</h2>
          <p className="mt-2 text-sm leading-relaxed text-calm-muted">
            @Synthetix builds an artifact and @Veritas checks evidence before any Proof-of-Value can
            be awarded.
          </p>
        </article>
      </section>

      <section className="space-y-3 border-t border-calm-border pt-8">
        <h2 className="text-lg font-medium text-calm-text">Why Brainpod requests sign-in</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-calm-muted">
          Brainpod uses Google sign-in (or email magic links) only to authenticate you and create
          your Brainpod account. Google may provide your basic account identity — typically your
          email address and basic profile information — so Brainpod can identify your account, show
          your private Workspace and Mini-Pods, enforce daily free-prompt limits, and attribute
          directed work to you inside shared pods. Brainpod does not read your Gmail, contacts,
          Drive, Calendar, or other Google services. It does not sell your Google information or use
          it for advertising.
        </p>
        <p className="max-w-2xl text-sm leading-relaxed text-calm-muted">
          Full details are in the{' '}
          <Link href="/privacy" className="underline hover:text-calm-text">
            Privacy Policy
          </Link>
          . The same policy URL should be listed on the Google OAuth consent configuration.
        </p>
      </section>

      <section className="space-y-3 border-t border-calm-border pt-8">
        <h2 className="text-lg font-medium text-calm-text">What you can do in Brainpod</h2>
        <ul className="max-w-2xl list-disc space-y-2 pl-5 text-sm leading-relaxed text-calm-muted">
          <li>Direct native agents through Brainstorm, Assist, or Construct &amp; Verify modes</li>
          <li>Continue multi-turn studies inside private Mini-Pods and invite collaborators by email</li>
          <li>Release short owner-authored public summaries to Explore when you choose</li>
          <li>Copy study threads for offline notes without turning the platform into a cash-out ledger</li>
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/login"
          className="rounded-lg bg-calm-accent px-5 py-3 text-sm font-medium text-calm-bg"
        >
          Sign in to Brainpod
        </Link>
        <Link href="/explore" className="text-sm text-calm-muted underline hover:text-calm-text">
          Explore without signing in
        </Link>
      </div>

      <SiteFooter />
    </main>
  );
}
