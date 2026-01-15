import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import { Web3Provider } from '@/components/providers/Web3Provider';
import { Header } from '@/components/layout/Header';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Sherlock RWA Platform',
  description:
    'Privacy-focused Real World Asset tokenization platform with ZK proofs and oracle integration on Mantle',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased dark`}>
        <Web3Provider>
          <Header />
          <main>{children}</main>
          <Toaster />
        </Web3Provider>
      </body>
    </html>
  );
}
