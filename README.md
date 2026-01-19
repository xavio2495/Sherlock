<div align="center">
<img src="./assets/logo-l.png" alt="Sherlock-logo" width="300"/>

### Secure RWAs with Privacy-Preserving Oracle Feeds
</div>



## About
Sherlock is an innovative, lightweight DApp designed specifically for the Mantle Network. This project addresses key challenges in the RealFi (Real-World Finance) space by enabling the secure, privacy-preserving tokenization of real-world assets (RWAs) such as invoices, bonds, or even fractional real estate.

Sherlock focuses on integrating zero-knowledge (ZK) proofs for privacy with real-time oracle data feeds, creating a compliant and dynamic platform for asset issuers and buyers. The core value proposition is to bring tangible, yield-bearing assets on-chain without exposing sensitive user or ownership data, leveraging Mantle's modular stack for seamless EVM compatibility, sub-cent gas fees, and high throughput (up to 1,000+ TPS).

#### Live Demo: https://sherlock-mantle.vercel.app

## Key Features and Workflow

#### 1. Issuer-Driven RWA Tokenization:

- Issuers (e.g., businesses or asset holders) can easily mint tokenized RWAs using ERC-1155 standards, which support both unique whole assets and customizable fractional shares. For example, an invoice worth $10,000 can be tokenized with issuer-defined specs like total supply (e.g., 100 fractions), minimum fraction size (e.g., $100 equivalent), and optional lockup periods to prevent premature transfers.

- The process starts with a simple asset upload: Issuers provide basic metadata (e.g., asset description, total value) and a verification hash (e.g., of an off-chain document like a PDF invoice). This hash is stored on-chain for immutability, ensuring tamper-proof backing without complex third-party audits in the MVP stage.

#### 2. Simple ZK-KYC for Compliance and Privacy:

- To ensure regulatory compatibility (e.g., with US SEC Reg D or EU MiCA standards), users (issuers and buyers) must prove eligibility via a streamlined ZK-KYC system, allowing proofs for attributes such as "accredited investor status" (net worth >$1M), age (>18), or non-sanctioned jurisdiction—without revealing full personal details.

- Buyers interact by generating and submitting ZK proofs off-chain (via a backend service) before claiming tokens, verifying compliance selectively (e.g., prove "eligible" to the contract). This minimizes data exposure risks common in traditional KYC, making it suitable for global users.

#### 3. Real-Time Oracle Integration for Dynamic Pricing and Data Feeds:

- Powered by Pyth Network, the platform pulls live price and reference data feeds directly into the tokenization process, ensuring asset valuations remain accurate and market-responsive.

- Oracles are queried on-demand during minting or viewing, with pull-based mechanics to avoid unnecessary gas costs, enabling features like variable yield previews, where the token's smart contract computes a simple yield estimate based on the latest feed.

#### 4. ZK-Enhanced Privacy for Ownership and Fractions:

- The project's standout innovation lies in ZK range proofs, which hides exact fraction ownership details while allowing verifiable claims. For example, a buyer can prove they hold "at least 5% of the asset" for compliance checks or yield claims, without revealing their full holdings or identity—preventing chain analysis attacks. By embedding ZK directly into the token logic, enabling "yield-proof" mechanisms where users privately verify accrual without exposing portfolios.

- Fractions are issuer-defined and fungible within the asset (e.g., recombine smaller shares into larger ones via burn/mint functions), with privacy extended to transfers: Shielded metadata ensures ownership remains confidential yet auditable via selective disclosure (e.g., for regulators).

#### 5. Simplified Asset Verification and Yield Mechanics:

- Verification is streamlined: At minting, the contract captures an oracle snapshot (e.g., current asset price) alongside the issuer's signed hash, creating a verifiable on-chain record. No advanced hierarchies or IPFS—just direct off-chain storage references (e.g., via contract events emitting JSON-like metadata).

- Yield distribution is preview-only in the MVP: The contract computes and displays estimated yields based on oracle data (e.g., monthly payouts for invoice cash flows), with automatic triggers for future expansions. This ties into Mantle's ecosystem for potential integrations like bridges to other L2s.

## Technical Highlights

- **Contracts:** Solidity contracts (deployed via Foundry/Mantle SDK) with OpenZeppelin libraries for security.

- **Backend:** Node.js for ZK proof generation.

- **Frontend:** React with Wagmi for wallet interactions. Oracles: Pyth for real-time efficiency.

- Mantle Optimization: Leverages Mantle's Data Availability (DA) layer for cheap proof storage and low-fee oracle pulls, making privacy features accessible for everyday users.

- Security and Compliance: Contracts are upgradeable (UUPS proxy) with basic role-based access (issuer-only mints). Focus on global regs: Built-in hooks for sanction checks via oracles.

## Repo Structure

### Structure
- `contracts/` — Solidity (Foundry) for RWA factory, verifiers, oracle reader
- `backend/` — Node/Express API, ZK proof generation, oracle polling
- `sherlock/` — Next.js 14 frontend (App Router) with RainbowKit/Wagmi UI

### Quickstart
1) **Contracts**
	- `cd contracts`
	- `forge build && forge test`
	- Deploy (example): `forge script script/Deploy.s.sol --rpc-url $RPC --private-key $PK --broadcast`

2) **Backend**
	- `cd backend && npm install`
	- Copy `.env.example` (or set API/contract addresses)
	- Run: `npm run dev` (defaults to port 3001)

3) **Frontend**
	- `cd sherlock && npm install`
	- Set `.env.local` with API URL, WalletConnect project ID, contract addresses
	- Run: `npm run dev` (port 3000)

### Useful Scripts
- Backend: `npm run dev` (API), `./scripts/setup-circuits.sh` (ZK circuits)
- Frontend: `npm run lint`, `npm run build`
- Contracts: `forge test -vvv`, `forge script ... --broadcast`
- All-in-one setup: `./setup-all.sh` (Linux/macOS) or `./setup-all.ps1` (Windows)

<div align="center">

<h3>Built By <br>

[Immanuel](https://github.com/xavio2495) X
[Charles](https://github.com/charlesms1246)
</h3>
</div>
