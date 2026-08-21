import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-calm-border pt-8">
      <div className="flex flex-wrap items-center gap-4 text-sm text-calm-muted">
        <Link href="/" className="underline hover:text-calm-text">
          Home
        </Link>
        <Link href="/workspace" className="underline hover:text-calm-text">
          Workspace
        </Link>
        <Link href="/explore" className="underline hover:text-calm-text">
          Explore
        </Link>
        <Link href="/privacy" className="underline hover:text-calm-text">
          Privacy
        </Link>
        <Link href="/terms" className="underline hover:text-calm-text">
          Terms
        </Link>
      </div>
      <p className="mt-3 text-xs text-calm-muted">
        Public-benefit collaborative infrastructure under LuminaNova.org (501(c)(3)).
      </p>
    </footer>
  );
}
