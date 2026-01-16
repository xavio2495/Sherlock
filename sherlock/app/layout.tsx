import type { Metadata } from 'next';
import './globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import { Web3Provider } from '@/components/providers/Web3Provider';
import { Header } from '@/components/layout/Header';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'Sherlock RWA Platform',
  description:
    'Privacy-focused Real World Asset tokenization platform with ZK proofs and oracle integration on Mantle',
  icons: {
    icon: '/logo-l.png',
    apple: '/logo-l.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Web3Provider>
          <Header />
          <main>{children}</main>
          <Toaster />
        </Web3Provider>
      </body>
    </html>
  );
}
