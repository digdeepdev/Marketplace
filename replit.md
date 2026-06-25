# VerseKit Marketplace

A Web3 marketplace where users spend VERSE token (Polygon) to buy Nigerian telecom airtime/data and branded merchandise.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/marketplace run dev` — run the frontend (port 20787)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, wagmi (Polygon/injected wallet), @tanstack/react-query, wouter, shadcn/ui, Tailwind, embla-carousel, qrcode.react
- API: Express 5 + pino logging
- Payments: VERSE token on Polygon — users send VERSE to `0xCF882686d0f8CCB72521C7Cd3A00cfcE63BCDcC7`
- DB: none required — all product data is static; rate data is fetched live
- Build: esbuild (CJS bundle for api-server)

## Where things live

- `artifacts/marketplace/src/pages/marketplace.tsx` — main page (hero carousel, airtime grid, merch grid)
- `artifacts/marketplace/src/components/airtime-modal.tsx` — wallet connect + VERSE payment + QR code modal
- `artifacts/marketplace/src/components/finalize-modal.tsx` — Tx hash submission + 3-min timer
- `artifacts/marketplace/src/assets/` — all SVG/PNG assets (network logos, merch photos, header bg)
- `artifacts/api-server/src/routes/prices.ts` — `GET /api/prices/verse-naira` (live CoinGecko rate, 60s cache)
- `artifacts/api-server/src/routes/paywall.ts` — `GET /api/paywall/verify-verse-balance`, `POST /api/paywall/confirm-purchase`

## Architecture decisions

- Contract-first with static product data. No DB needed — products are hardcoded on the frontend, rates are fetched live.
- VERSE/Naira rate uses CoinGecko (VERSE/USD + USDT/NGN), cached 60s, falls back to stale cache on API failure.
- Balance check uses multiple public Polygon RPC endpoints with fallback (Ankr → publicnode → drpc.org).
- Email notifications via SMTP (env vars) with Resend API fallback.
- Merch is "coming soon" (Q4 2026) — clicking any merch card shows a modal instead of a purchase flow.
- 2% fee added to the VERSE rate shown to users.

## Product

- **Airtime & Data**: Buy MTN, Airtel, Glo, T2 Mobile top-ups using VERSE token on Polygon
- **Merch** (coming Q4 2026): Verse-branded tees, hoodies, caps, sticker packs
- **Hero Carousel**: Auto-playing 3-slide banner with network imagery
- **Wallet Connect**: MetaMask/injected wallet via wagmi — verifies ≥2000 VERSE balance before purchase
- **QR Code**: Shows recipient wallet address as QR for mobile wallets
- **Tx Verification**: User pastes Polygon tx hash → server verifies on-chain + sends team email

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-server add <pkg>` to add server deps (zod, nodemailer already added).
- `@assets` alias in vite.config.ts points to `artifacts/marketplace/src/assets/` — all asset imports use `@assets/<filename>?url`.
- The api-server rebuilds from source on every `dev` start (esbuild, ~250ms). Restart the workflow after route changes.
- Email sending requires SMTP env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) or `RESEND_API_KEY`. Without these, purchases still complete but no email is sent.
- Recipient wallet: `0xCF882686d0f8CCB72521C7Cd3A00cfcE63BCDcC7` (hardcoded in paywall.ts and airtime-modal.tsx).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
