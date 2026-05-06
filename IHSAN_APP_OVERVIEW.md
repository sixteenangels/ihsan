# Ihsan — Premium E-Commerce Platform

**Tagline:** _Global Shopping Made Simple_
**Stack:** React 18 + Vite + TypeScript + Tailwind • Lovable Cloud (Supabase: Postgres, Auth, Storage, Realtime) • Paystack (GHS) • Framer Motion • PWA
**Currency:** Ghana Cedis (GHS) — strictly enforced everywhere
**Design philosophy:** _"Admin is the system."_ Manual control over shipping, pricing, and order flow — no fantasy automation.

---

## 1. Product Catalog & Discovery

- **Products** with multiple **variants** (color/size as colored pill badges), per-variant price + stock
- **Special categories**: ⚡ Ready Now (in-stock fast ship) and 🎁 Combo bundles
- **Product media**: image gallery with zoom, pan, and drag
- **Discovery tools**: Quick View, Compare (with history), Wishlist, Grid/List toggle
- **Frequently Bought Together**, **Related Products**, **Recently Viewed**
- **Price Drop Alerts**
- **Reviews** — only buyers who actually received the item can post (verified)
- **Product Q&A**

## 2. Cart & Checkout

- Persistent cart (`localStorage`, v2 schema), per-item selection
- **Admin-controlled shipping tiers** — restricted tiers are hidden when a cart item disallows them
- **Wallet redemption** at checkout (GHS credit applied to total)
- **Free-shipping override** (admin/manual)
- **Fragile packaging dialog** for fragile items
- **Paystack** payment in GHS, with verify-payment edge function
- **Customs duty estimator** page

## 3. Orders & Fulfillment

- **Unified order workflow** — 14 distinct manual statuses, admin-driven
- **MyOrders** redesigned card UI: Details / Buy Again / Confirm Delivery
- **Customer self-service**: Confirm Payment, Confirm Delivery
- **Order tracking** with Leaflet/OSM map
- **Realtime + push + in-app notifications** on status changes
- **Admin Receipts**: PDF generation with QR codes and itemized lists
- **Refund workflow** — manual, only for `Delivered` orders

## 4. Admin Console

- **Dashboard** with analytics (Recharts) + CSV export
- **Orders**: bulk status transitions, internal admin notes
  - **Mobile**: swipe-to-update-status (framer-motion drag) with **haptic feedback** (`navigator.vibrate`)
  - **First-time swipe hint overlay** (dismissed permanently via `localStorage`)
- **Message Templates**: reusable status-update notes (ready to wire into the orders status dialog picker)
- **Products / Categories / Bundles / Variants** management (products are **archived, never deleted**)
- **Stock Management** — low-stock alerts + bulk CSV updates
- **Shipping rules** (per-product overrides)
- **Promotions / Group Buys / Loyalty / Referrals**
- **Wallet** — admin credits customers, transactions logged + customer notified
- **Reviews / Q&A / Support / Refunds / Notifications / Users / Settings**
- **Customer leaderboard**

## 5. Group Buy System

- Minimum participants + deadlines + tiered discounts
- Join / Start dialogs, participant list, share sheet

## 6. Customer Account (Profile)

- Profile + addresses
- **Wallet tab** — balance + full transaction history
- Push notification settings
- 2FA (TOTP) setup, manage, verify, backup recovery codes
- Active session management
- Loyalty points + referrals
- Order history

## 7. Authentication & Security

- Email/password + **Google OAuth** (via Lovable Cloud managed OAuth — `@lovable.dev/cloud-auth-js`)
- Email verification required (no auto-confirm)
- Password reset + resend verification
- Remember-me (sessionStorage flag)
- **2FA** with backup codes
- Session management UI
- Roles in dedicated `user_roles` table + `manager_permissions` (no role-on-profile escalation)
- Friendly OAuth error messages (`access_blocked`, `redirect_uri_mismatch`, cancelled, etc.)

## 8. Support & Engagement

- **Help Center** — categorized FAQs + contact form
- **Real-time support chat** widget (Supabase Realtime)
- **Abandoned cart reminder**
- **Welcome modal** for new visitors
- **Cookie consent**
- **Maintenance mode** wrapper

## 9. PWA & Mobile

- Installable PWA, iOS-friendly manifest, service worker for push (`sw-push.js`)
- **Mobile bottom tab bar** with blur, iOS safe-area, haptics
- Apple HIG-aligned visual polish

## 10. Branding & SEO

- Brand: **Ihsan — Premium E-Commerce**, _Global Shopping Made Simple_
- Favicon + OG metadata
- Dark mode toggle (next-themes)
- WhatsApp + social sharing
- Semantic HTML, lazy-loaded routes (React.lazy + Suspense)

---

## Backend (Lovable Cloud)

**Tables (high level):** products, product_variants, categories, bundles, orders, order_items, shipping_options, product_shipping_rules, reviews, qa_questions, group_buys, group_buy_participants, promotions, loyalty_points, referrals, wallet_transactions, notifications, support_threads, support_messages, message_templates, refund_requests, user_roles, manager_permissions, profiles, addresses, sessions, push_subscriptions, store_settings, feature_flags, audit_logs.

**Edge functions:**
- `get-paystack-key` — secure key delivery
- `verify-paystack-payment` — server-side verification
- `process-referral-reward`
- `send-push-notification`
- `check-birthdays`

**RLS:** Permissive policies + `has_role(user_id, role)` SECURITY DEFINER for admin checks.
**Realtime:** enabled for orders, notifications, support messages.

---

## Recent Work Completed

- ✅ Review flow end-to-end (verified-buyer only, instant on product + admin Reviews tab)
- ✅ Admin **Message Templates** page (CRUD)
- ✅ **MyOrders** redesigned cards (Details / Buy Again / Confirm Delivery)
- ✅ **Checkout**: wallet redemption, free-shipping override, fragile packaging dialog
- ✅ **Profile → Wallet** tab (balance + transactions)
- ✅ **AdminOrders mobile**: framer-motion swipe-to-update + haptic feedback
- ✅ **Swipe hint overlay** (one-time, localStorage-dismissed)
- ✅ **Google sign-in** moved to Lovable Cloud managed OAuth
- ✅ Friendly OAuth error states on Auth page

## Known Follow-ups

- Wire the message-templates **picker** into the AdminOrders status-update dialog
- Verify Google OAuth redirect URI in Lovable Cloud → Users → Auth Settings (resolves "Access blocked")
- End-to-end mobile checkout test with a live Paystack test payment
