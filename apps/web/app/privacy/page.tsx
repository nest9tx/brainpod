import SiteNav from '@/components/site-nav';
import SiteFooter from '@/components/site-footer';

export const metadata = { title: 'Privacy Policy — Brainpod' };

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16 text-sm leading-relaxed text-calm-muted">
      <SiteNav variant="public" />

      <div>
        <p className="mb-6 text-xs uppercase tracking-widest text-calm-muted">
          Brainpod · Privacy Policy · Last updated August 20, 2026
        </p>
        <h1 className="mb-6 text-2xl font-medium text-calm-text">Privacy Policy</h1>

        <p className="mb-4">
          Brainpod is operated under the public-benefit umbrella of LuminaNova.org (a 501(c)(3)
          nonprofit). This policy describes what we collect, why, and how it&apos;s handled. This is
          an early-stage, actively developed product — this policy will be revised as the platform
          grows, and we&apos;ll note material changes here.
        </p>

        <h2 className="mb-2 mt-8 text-lg font-medium text-calm-text">What we collect</h2>
        <ul className="mb-4 list-disc space-y-2 pl-5">
          <li>
            <strong className="text-calm-text">Your email address</strong>, used only to sign you in
            (via a one-time link or Google sign-in) and to enforce your daily free-prompt count. We do
            not sell, rent, or share your email with third parties for marketing.
          </li>
          <li>
            <strong className="text-calm-text">Content you submit</strong> (your Director prompts)
            and the swarm&apos;s responses to them, stored so a Mini-Pod&apos;s history and
            Proof-of-Value ledger are inspectable and auditable. Public Mini-Pods are visible to other
            users; private Mini-Pods are restricted to profiles you&apos;ve granted access to.
          </li>
          <li>
            <strong className="text-calm-text">Basic usage data</strong> (e.g. daily prompt counts)
            needed to enforce tier limits.
          </li>
          <li>
            If you opt in, <strong className="text-calm-text">research consent status</strong> is
            recorded so anonymized contributions can be included in aggregate research. This is off by
            default and never assumed.
          </li>
        </ul>

        <h2 className="mb-2 mt-8 text-lg font-medium text-calm-text">Who processes it</h2>
        <p className="mb-4">
          We use a small number of infrastructure providers to operate the service: Supabase (database
          and authentication), Vercel (web hosting), Render (swarm orchestration hosting), OpenAI
          (language model inference), Tavily (web search grounding), and, if you choose it, Google
          (sign-in). Your Director prompts are sent to OpenAI and Tavily to generate and ground the
          swarm&apos;s responses. We do not use your data to train models ourselves, and we don&apos;t
          run advertising trackers.
        </p>

        <h2 className="mb-2 mt-8 text-lg font-medium text-calm-text">Google user data</h2>
        <p className="mb-4">
          If you choose Google sign-in, Brainpod receives only the basic identity information Google
          provides for authentication, such as your email address, name, and profile image when
          available. We use this information to create or identify your Brainpod account, maintain your
          signed-in session, display your account identity, and enforce usage limits. Brainpod does not
          request or access Gmail, Google Drive, contacts, calendar, location, or other Google services.
          We do not sell Google user data, use it for advertising, or transfer it to data brokers.
          Google sign-in data is handled by Supabase Authentication and the Brainpod application
          database as needed to provide the service.
        </p>

        <h2 className="mb-2 mt-8 text-lg font-medium text-calm-text">Your choices</h2>
        <p className="mb-4">
          You can request deletion of your account and associated data at any time by contacting us.
          Research participation is opt-in and can be withdrawn at any time. Proof-of-Value ledger
          entries are, by design, permanent and public once earned — this is a core, disclosed feature
          of the platform, not incidental data retention.
        </p>

        <h2 className="mb-2 mt-8 text-lg font-medium text-calm-text">Contact</h2>
        <p>Questions about this policy or your data can be directed to LuminaNova.org.</p>
      </div>

      <SiteFooter />
    </main>
  );
}
