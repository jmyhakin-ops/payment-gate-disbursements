import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KenyaPay Platform',
  description: 'Multi-Rail Payment & Payout Platform for Kenya',
  themeColor: '#1a56db',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
