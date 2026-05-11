# Ihsan

Premium e-commerce storefront for curated cross-border shopping, built with React, Vite, TypeScript, Tailwind, and Supabase.

## Stack

- React 18
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- Paystack

## Local Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Fill in the Supabase, email, and payment environment variables.
4. Start the app with `npm run dev`.

## Scripts

- `npm run dev` starts the Vite dev server.
- `npm run build` creates the production bundle.
- `npm run lint` runs ESLint across the repo.
- `npm run test` runs the Vitest suite.
- `npm run test:coverage` runs the Vitest suite with V8 coverage.
- `npm run preview` serves the production build locally.

## Notes

- This repo no longer stores placeholder Lovable project URLs because those links are environment-specific.
- Google OAuth must allow each deployed app origin and redirect back to `${APP_ORIGIN}/auth`.
- Live Paystack validation still needs a deployed checkout flow and a real test order path.
