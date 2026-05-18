# AJYN

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
- `npm run playwright:install` installs the Chromium browser used by Playwright.
- `npm run test:e2e` builds the app and runs the local Playwright smoke suite.
- `npm run test:e2e:mobile` builds the app and runs the mobile Chromium smoke suite.
- `npm run test:e2e:headed` runs the same Playwright smoke suite with a visible browser.
- `npm run test:e2e:live` runs the opt-in deployed auth smoke check when `PLAYWRIGHT_LIVE_BASE_URL` is set.
- `npm run preview` serves the production build locally.
- `npm run cap:sync` builds the Vite app and syncs web assets into the native Capacitor projects.
- `npm run cap:open:android` opens the Android project in Android Studio.
- `npm run cap:open:ios` opens the iOS project in Xcode on macOS.
- `npm run cap:run:android` syncs and runs the Android app on a connected emulator or device.
- `npm run cap:run:ios` syncs and runs the iOS app on a connected simulator or device on macOS.

## Native Apps

Capacitor is configured for Android and iOS with app ID `com.ajyn.app`, app name `AJYN`, and Vite output directory `dist`.

1. Run `npm run cap:sync` after web changes.
2. Use Android Studio for `android/`.
3. Use Xcode on macOS for `ios/`.
4. Keep native build artifacts, generated web assets, local SDK paths, and signing keys out of git.

## Notes

- This repo no longer stores placeholder Lovable project URLs because those links are environment-specific.
- Google OAuth must allow each deployed app origin and redirect back to `${APP_ORIGIN}/auth`.
- Live Paystack validation still needs a deployed checkout flow and a real test order path.
