import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16 pattern-grid py-16 border-brutalist shadow-brutalist-lg">
          <div className="flex justify-center mb-6">
            <Image src="/logo-main.png" alt="Sherlock" width={200} height={200} priority />
          </div>
          <h1 className="text-3xl mb-8 max-w-2xl mx-auto">
            Secure RWA tokenization with Privacy-Preserving Oracle Feeds
          </h1>
          <div className="flex gap-4 justify-center">
            <Link href="/issuer">
              <Button size="lg" className="text-lg px-8">
                ISSUE ASSETS
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button variant="outline" size="lg" className="text-lg px-8">
                MARKETPLACE
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="hover:opacity-80 transition-opacity cursor-pointer pattern-diagonal">
            <CardContent className="p-8">
              <h3 className="text-2xl font-heading mb-4">ZK PRIVACY</h3>
              <p className="text-foreground/80">
                Verifiable ownership without revealing exact holdings. Zero-knowledge proofs for
                eligibility and range verification.
              </p>
            </CardContent>
          </Card>

          <Card className="hover:opacity-80 transition-opacity cursor-pointer pattern-v">
            <CardContent className="p-8">
              <h3 className="text-2xl font-heading mb-4">ORACLE FEEDS</h3>
              <p className="text-foreground/80">
                Real-time price data via Pyth Network. On-chain verification for all asset
                valuations and market data.
              </p>
            </CardContent>
          </Card>

          <Card className="hover:opacity-80 transition-opacity cursor-pointer pattern-diagonal-left">
            <CardContent className="p-8">
              <h3 className="text-2xl font-heading mb-4">MANTLE NETWORK</h3>
              <p className="text-foreground/80">
                Built on Mantle testnet for low-cost, high-throughput transactions with ERC-1155
                fractional ownership.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Access */}
        <div className="grid md:grid-cols-2 gap-8">
          <Card className="pattern-dots bg-secondary">
            <CardContent className="p-8">
              <h3 className="text-2xl font-heading mb-4">FOR ISSUERS</h3>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start">
                  <span className="mr-2">■</span>
                  <span>Tokenize real-world assets</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">■</span>
                  <span>Set custom lockup periods</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">■</span>
                  <span>Oracle-backed valuations</span>
                </li>
              </ul>
              <Link href="/issuer">
                <Button className="w-full">START ISSUING →</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="pattern-dots bg-secondary">
            <CardContent className="p-8">
              <h3 className="text-2xl font-heading mb-4">FOR INVESTORS</h3>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start">
                  <span className="mr-2">■</span>
                  <span>Browse tokenized assets</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">■</span>
                  <span>Private ownership verification</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">■</span>
                  <span>Track your portfolio</span>
                </li>
              </ul>
              <div className="grid grid-cols-2 gap-4">
                <Link href="/marketplace">
                  <Button variant="outline" className="w-full">
                    BROWSE →
                  </Button>
                </Link>
                <Link href="/portfolio">
                  <Button variant="outline" className="w-full">
                    PORTFOLIO →
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="text-center text-regular text-muted-foreground mt-12 py-8 border-t space-y-1">
        <span className="block">Built on Mantle Testnet</span>
        <span className="block">
          {' '}
          <a
            href="https://github.com/xavio2495"
            className="underline hover:text-foreground transition-colors"
            target="_blank"
            rel="noreferrer"
          >
            Immanuel
          </a>{' '}
          X
          {' '}
          <a
            href="https://github.com/charlesms1246"
            className="underline hover:text-foreground transition-colors"
            target="_blank"
            rel="noreferrer"
          >
            Charles
          </a>
        </span>
      </p>

    </div>
  );
}
