# Stellar Crypto Wallet

A modern, secure Stellar cryptocurrency wallet built with Next.js, TypeScript, and shadcn/ui.

## Tech Stack

- **Framework**: Next.js 14+ (App Router) with TypeScript
- **UI**: shadcn/ui + Tailwind CSS + Lucide Icons
- **Blockchain**: Stellar SDK (@stellar/stellar-sdk)
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Forms**: react-hook-form + zod
- **Utilities**: crypto-js, bignumber.js, qrcode.react

## Project Structure

```
├── app/              # Next.js app router pages
├── components/       # shadcn + custom React components
├── lib/             # Utility functions and Stellar SDK helpers
│   ├── stellar/     # Stellar-specific utilities
│   └── utils.ts     # shadcn utils
├── hooks/           # Custom React hooks
├── stores/          # Zustand state stores
└── types/           # TypeScript type definitions
```

## Getting Started

### 1. Environment Setup

Copy the example environment file and configure it:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` to set your preferred network (testnet/public).

### 2. Install Dependencies

Dependencies are already installed. If you need to reinstall:

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
