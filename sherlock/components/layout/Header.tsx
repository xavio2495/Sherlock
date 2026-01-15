'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance } from 'wagmi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatUnits } from 'viem';

export function Header() {
  const pathname = usePathname();
  const { address, chain } = useAccount();
  const { data: balanceData } = useBalance({
    address: address as `0x${string}` | undefined,
  });

  const isCorrectNetwork = chain?.id === 5003;
  const balanceValue = balanceData
    ? Number(formatUnits(balanceData.value, balanceData.decimals))
    : 0;
  const hasLowBalance = balanceValue > 0 && balanceValue < 0.01;

  const navLinks = [
    { href: '/issuer', label: 'Mint' },
    { href: '/marketplace', label: 'Marketplace' },
    { href: '/portfolio', label: 'Portfolio' },
    { href: '/oracle', label: 'Oracle' },
  ];

  return (
    <header className="border-b border-gray-800 bg-black min-w-[1280px]">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Navigation */}
          <div className="flex items-center gap-8">
            <Link href="/" className="text-2xl font-bold text-white">
              Sherlock <span className="text-mantle-secondary">RWA</span>
            </Link>

            <nav className="flex items-center gap-2">
              {navLinks.map((link) => (
                <Button
                  key={link.href}
                  asChild
                  variant="ghost"
                  className={
                    pathname === link.href
                      ? 'text-mantle-secondary hover:text-mantle-secondary'
                      : 'text-gray-300 hover:text-white'
                  }
                >
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ))}
            </nav>
          </div>

          {/* Wallet Connection */}
          <div className="flex items-center gap-4">
            {/* Network Badge */}
            {address && (
              <Badge
                variant={isCorrectNetwork ? 'default' : 'destructive'}
                className={isCorrectNetwork ? 'bg-green-600' : ''}
              >
                {isCorrectNetwork ? 'Mantle Sepolia' : 'Wrong Network'}
              </Badge>
            )}

            {/* Low Balance Warning */}
            {address && hasLowBalance && (
              <a
                href="https://faucet.sepolia.mantle.xyz/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-yellow-500 hover:text-yellow-400 transition-colors"
              >
                ⚠️ Low balance. Get testnet MNT →
              </a>
            )}

            {/* Connect Button */}
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  );
}
