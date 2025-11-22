# Antidote 🛡️

**Institutional Margin Call Protection on Uniswap v4**

Antidote is the first fully permissioned margin call protection protocol built directly into Uniswap v4 hooks, providing institutional-grade risk management with regulatory compliance.

## 🚀 Key Features

- **🔄 Atomic Protection**: Real-time margin call detection within Uniswap v4 hooks
- **🏛️ Institutional Access**: KYC-gated via Coinbase x402 & CDP Facilitator
- **📊 Live Pricing**: Pyth Oracle integration with Hermes pull architecture  
- **🔒 Privacy-Preserving**: zk-SNARK claims with Poseidon hashing
- **💸 Tokenized Risk**: Fractional insurance shares in permissioned secondary markets

## 🎯 Use Cases
- **Institutional lending protocols
- **DeFi hedge funds
- **Market makers & liquidity providers
- **Treasury management

## 🏗️ Architecture

![alt text](<Compact Horizontal_antidote.svg>)

## 🛠️ Tech Stack

- **Smart Contracts**: Solidity, Uniswap v4, Pyth EVM SDK
- **Frontend**: Next.js, React, Wagmi, TailwindCSS
- **Access Payments & Wallet verification**: Coinbase x402, CDP Facilitator
- **Oracles**: Pyth Network (Hermes pull architecture)
- **Deployment**: Foundry, Vercel

## 📋 Quick Start

1. **Connect Wallet** → Any Ethereum/Base wallet
2. **Pay Access Fee** → 1 USDC via Coinbase x402
3. **Get Protection** → Deposit into Uniswap v4 pools
4. **Auto-Coverage** → Margin calls trigger instant payouts

## 🌐 Networks

- **Payment**: Base Sepolia (x402 compliance verification)
- **Platform**: Ethereum Sepolia (insurance operations)

## 🛠️ Local Development

### Prerequisites

- Node.js 18+
- Coinbase Developer Platform account
- Alchemy account

### Environment Setup

Create a `.env.local` file with the following variables:

```env
# x402 Seller Wallet (you generate this)
X402_SELLER_PRIVATE_KEY=yourx402sellerprivatekey
NEXT_PUBLIC_X402_SELLER_ADDRESS=youraddress

NEXT_PUBLIC_ACCESS_FEE_USDC=1
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Payment Network (Base Sepolia)
NEXT_PUBLIC_PAYMENT_CHAIN_ID=84532
NEXT_PUBLIC_PAYMENT_NETWORK=base-sepolia

# Platform Network (Ethereum Sepolia) 
NEXT_PUBLIC_PLATFORM_CHAIN_ID=11155111
NEXT_PUBLIC_PLATFORM_NETWORK=ethereum-sepolia

# Poseidon Addresses (for ZK proofs)
NEXT_PUBLIC_POSEIDON_T3=0x3333333C0A88F9BE4fd23ed0536F9B6c427e3B93
NEXT_PUBLIC_POSEIDON_T4=0x4443338EF595F44e0121df4C21102677B142ECF0
NEXT_PUBLIC_POSEIDON_T5=0x555333f3f677Ca3930Bf7c56ffc75144c51D9767
NEXT_PUBLIC_POSEIDON_T6=0x666333F371685334CdD69bdDdaFBABc87CE7c7Db

# Private environment variables (server-side only)
CDP_API_KEY_ID=yourkey
CDP_API_KEY_SECRET=yoursecret

PRIVATE_KEY=yourwalletprivatekey

# Alchemy RPC URLs 
ALCHEMY_BASE_SEPOLIA_URL=https://base-sepolia.g.alchemy.com/v2/your-key
ALCHEMY_ETHEREUM_SEPOLIA_URL=https://eth-sepolia.g.alchemy.com/v2/your-key