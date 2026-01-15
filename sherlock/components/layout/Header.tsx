'use client';

import Link from 'next/link';
import Image from 'next/image';
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
    { href: '/issuer', label: 'MINT' },
    { href: '/marketplace', label: 'MARKETPLACE' },
    { href: '/portfolio', label: 'PORTFOLIO' },
    { href: '/oracle', label: 'ORACLE' },
  ];

  return (
    <header className="sticky top-0 z-90 border-b-[3px] border-primary bg-background min-w-[1280px]">
      <div className="container mx-auto px-4 py-1">
        <div className="flex items-center justify-between">
          {/* Logo and Navigation */}
          <div className="flex items-center gap-8">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <Image src="/logo-main.png" alt="Sherlock" width={50} height={50} priority />
            </Link>

            <nav className="flex items-center gap-2">
              {navLinks.map((link) => (
                <Button
                  key={link.href}
                  asChild
                  variant={pathname === link.href ? 'default' : 'ghost'}
                  size="default"
                  className="font-bold text-base"
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
                className={isCorrectNetwork ? 'border-verified' : 'border-warning'}
              >
                {isCorrectNetwork ? 'MANTLE SEPOLIA' : 'WRONG NETWORK'}
              </Badge>
            )}

            {/* Low Balance Warning */}
            {address && hasLowBalance && (
              <a
                href="https://faucet.sepolia.mantle.xyz/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm border-brutalist px-3 py-1 border-warning hover:opacity-80 transition-opacity bg-background"
              >
                ⚠ LOW BALANCE. GET MNT →
              </a>
            )}

            {/* Connect Button */}
            <div className="[&_button]:hover:opacity-80 [&_button]:transition-opacity">
              <ConnectButton />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

