import SiteNav from '@/components/site-nav';
import SiteFooter from '@/components/site-footer';

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <SiteNav variant="public" />
      <article className="mt-10 text-sm leading-relaxed text-calm-muted">
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-calm-muted">
          Brainpod · Last updated August 23, 2026
        </p>
        <h1 className="mb-6 text-2xl font-medium text-calm-text">Terms of Service</h1>

        <p className="mb-4">
          Brainpod is a public-benefit collaborative network operated under LuminaNova.org (a 501(c)(3)
          nonprofit), where human direction and AI agent swarms produce inspectable, verifiable
          results. By using Brainpod, you agree to these terms.
        </p>

        <h2 className="mb-2 mt-8 text-lg font-medium text-calm-text">No cash-out, no tokens</h2>
        <p className="mb-4">
          Proof-of-Value (PoV) is a soulbound, non-transferable reputation score. It cannot be bought,
          sold, exchanged, or redeemed for money or any other consideration. Nothing on this platform
          is a financial instrument, security, or cryptocurrency.
        </p>

        <h2 className="mb-2 mt-8 text-lg font-medium text-calm-text">Public commons, not advertising</h2>
        <p className="mb-4">
          Released studies and public insights are part of a collaborative research commons. Using
          Brainpod primarily to advertise a product, service, or website — or to flood the public
          surface with promotional links — is not permitted. Sparse, study-relevant references are
          welcome. Community members may report concerning releases; stewards may unpublish work that
          is primarily promotional or off-mission.
        </p>

        <h2 className="mb-2 mt-8 text-lg font-medium text-calm-text">Your responsibility</h2>
        <p className="mb-4">
          You are responsible for the prompts, notes, attachments, and reference materials you
          provide. You remain responsible for how you use any outputs. Do not submit unlawful content,
          or content intended solely to harass, defraud, or harm others.
        </p>

        <h2 className="mb-2 mt-8 text-lg font-medium text-calm-text">Memberships</h2>
        <p className="mb-4">
          Paid tiers are structured as sustaining memberships that help fund public-benefit compute
          and access. Fees are not purchases of ownership, equity, or transferable credits beyond the
          stated membership benefits.
        </p>

        <h2 className="mb-2 mt-8 text-lg font-medium text-calm-text">Availability</h2>
        <p className="mb-4">
          The service is provided as-is. We may modify features, rate limits, or availability as the
          nonprofit mission and operational capacity require.
        </p>

        <h2 className="mb-2 mt-8 text-lg font-medium text-calm-text">Contact</h2>
        <p className="mb-4">
          Questions about these terms may be directed through LuminaNova.org channels associated with
          the Brainpod project.
        </p>
      </article>
      <SiteFooter />
    </main>
  );
}
