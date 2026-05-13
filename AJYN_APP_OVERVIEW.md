# AJYN - Premium E-Commerce Platform

**Tagline:** Global Shopping Made Simple  
**Stack:** React 18 + Vite + TypeScript + Tailwind + Supabase + Paystack + Framer Motion + PWA  
**Currency:** Ghana Cedis (GHS), enforced throughout the product  
**Design philosophy:** Admin is the system. Shipping, pricing, and fulfillment stay under manual control instead of pretending to be fully automated.

---

## 1. Product Catalog and Discovery

- Products support multiple variants with per-variant pricing and stock.
- Special categories include Ready Now and Combo Bundles.
- Product media includes gallery, zoom, pan, and drag support.
- Discovery features include Quick View, Compare, Wishlist, Grid/List toggle, Recently Viewed, Related Products, Frequently Bought Together, and recommendation surfaces.
- Customers can subscribe to price drop and back-in-stock alerts.
- Reviews are limited to verified buyers.
- Product Q&A is available on product detail pages.

## 2. Cart and Checkout

- Cart is persistent and supports per-item selection.
- Shipping options are admin-controlled and filtered by product restrictions.
- Wallet credit can be redeemed at checkout.
- Free-shipping overrides are supported.
- Fragile-item packaging flow is supported.
- Paystack payments are verified server-side.
- Customs duty estimation is available.
- Checkout recovery data is stored locally for reminder and resume flows.

## 3. Orders and Fulfillment

- Order lifecycle is driven by manual admin statuses.
- Customers can confirm payment and confirm delivery.
- Tracking supports status history plus map-based delivery context.
- Realtime, push, and in-app notifications are sent on status changes.
- Admin receipts include QR verification and itemized totals.
- Refunds are handled manually for delivered orders.
- Proof-of-delivery and fulfillment handoff details are captured in the admin flow.

## 4. Admin Console

- Dashboard includes analytics and CSV export.
- Orders support bulk actions, notes, fulfillment updates, and refund processing.
- Mobile admin order cards support swipe-based status updates with haptics.
- Swipe hint overlay is stored once per device with local storage.
- Message templates exist as a standalone admin page and can now be inserted directly into order status notes.
- Products, categories, bundles, variants, stock, shipping, promotions, loyalty, referrals, wallets, users, reviews, support, refunds, notifications, and settings are all managed from admin.

## 5. Group Buy System

- Group buys support participant minimums, deadlines, and discount tiers.
- Customers can start, join, share, and monitor group buys.

## 6. Customer Account

- Profile and address management are included.
- Wallet balance and transaction history are available.
- Push notification preferences are configurable.
- Two-factor auth includes setup, verification, recovery codes, and management.
- Session management is exposed in the UI.
- Loyalty points, referrals, and order history are available in profile flows.

## 7. Authentication and Security

- Email/password auth and Google OAuth are supported through Supabase.
- Email verification is required.
- Password reset and resend verification flows are included.
- Remember-me behavior differentiates between session and persistent login.
- Roles are stored in dedicated role tables rather than on mutable profile fields.
- OAuth failures surface clearer user-facing error states.

## 8. Support and Engagement

- Help center includes FAQs and contact flows.
- Realtime support chat is available.
- Abandoned-cart reminders and checkout recovery flows are supported.
- Welcome modal, cookie consent, and maintenance mode are present.

## 9. PWA and Mobile

- The app is installable as a PWA.
- Push support is wired through the service worker.
- Mobile navigation includes safe-area handling and haptic polish.

## 10. Branding and SEO

- Branding centers on AJYN and the Global Shopping Made Simple tagline.
- Favicon, OG metadata, and semantic HTML are in place.
- Dark mode is supported.
- Social sharing and lazy-loaded routes are implemented.

---

## Backend

**Core tables:** products, product_variants, categories, bundles, orders, order_items, shipping_options, product_shipping_rules, reviews, qa_questions, group_buys, group_buy_participants, promotions, loyalty_points, referrals, wallet_transactions, notifications, support_threads, support_messages, message_templates, refund_requests, user_roles, manager_permissions, profiles, addresses, sessions, push_subscriptions, store_settings, feature_flags, and audit_logs.

**Edge functions:**

- `get-paystack-key`
- `verify-paystack-payment`
- `process-referral-reward`
- `send-push-notification`
- `send-transactional-email`
- `send-checkout-recovery-reminders`
- `check-birthdays`

---

## Recent Work Completed

- Review flow is wired end-to-end for verified buyers.
- Admin message templates support CRUD and direct insertion inside Admin Orders.
- My Orders card UX has been redesigned.
- Checkout supports wallet redemption, free-shipping override, and fragile packaging flow.
- Profile exposes wallet balance and transaction history.
- Admin Orders mobile interactions support swipe-to-update and haptics.
- OAuth error handling is friendlier for Google sign-in failures.
- Local quality gates now include build, lint, and Vitest coverage entry points.

## Remaining Environment Checks

- Verify Google OAuth settings in Supabase for every deployed app URL. The frontend redirects Google auth back to `${window.location.origin}/auth`.
- Run a real mobile checkout against Paystack from a deployed environment with a seeded cart, a customer account, and valid payment credentials.

These remaining items are deployment validations, not open code tasks inside the repo.
