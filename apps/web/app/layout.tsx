import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Brainpod — Carbon-Silicon Co-Creation',
  description:
    'A public-benefit collaborative network where human direction and AI agent swarms produce inspectable, verifiable results.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
