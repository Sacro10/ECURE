# Vibesec

Vibesec is a concept React app for simulated penetration testing of vibe-coded applications.

## Features

- Sign up and log in flow powered by Supabase Auth
- Forgot password flow with email reset link + in-app password update
- Home -> Scanning -> Results view flow
- Cyberpunk dark UI with Tailwind (build-time PostCSS)
- Simulated scanner logs and progress animation
- Security dashboard with severity donut chart (Recharts)
- AI remediation modal powered by Gemini 2.5 Flash via Supabase Edge Function
- Markdown rendering for generated fixes (react-markdown)
- Usage-based billing foundation (subscription quotas + usage events + in-app usage meter)

## Pricing Tiers (Current)

| Plan | Monthly | Included | Overage |
|---|---:|---|---|
| Starter | $0 | 5 scans, 10 AI fixes | None |
| Pro | $29 | 100 scans, 300 AI fixes | $0.03 per AI fix |
| Team | $99 | 500 scans, 2,000 AI fixes, 5 seats | $0.02 per AI fix |

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Configure app environment:

```bash
cp .env.example .env
```

Set these values in `.env`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Do not put server secrets in `.env` (for example `GEMINI_API_KEY`, `STRIPE_*`, or `IONOS_*`).

## Where each key goes

- Local `.env` (client-only, this repo root): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Supabase Edge Function secrets: `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_TEAM`, `STRIPE_WEBHOOK_SECRET`, `ALLOWED_ORIGINS`, `CHECKOUT_REDIRECT_ORIGINS`
- GitHub Actions secrets (IONOS deploy): `IONOS_API_KEY`, `IONOS_SSH_KEY`, and each deployment SSH username secret

3. Configure Supabase Auth URL settings:

- Open [Auth URL Configuration](https://supabase.com/dashboard/project/axehwgipxwqpilwlbtha/auth/url-configuration)
- Set `Site URL` to `http://localhost:5173`
- Add these `Additional Redirect URLs`:
  - `http://localhost:5173/**`
  - `http://127.0.0.1:5173/**`

4. Apply Supabase billing migration:

```bash
supabase db push
```

5. Set Gemini key as a Supabase secret (server-side only):

```bash
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here
```

6. Set Stripe secrets for checkout:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_or_test_key
supabase secrets set STRIPE_PRICE_ID_PRO=price_xxx
supabase secrets set STRIPE_PRICE_ID_TEAM=price_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase secrets set ALLOWED_ORIGINS=https://your-app.example.com,http://localhost:5173,http://127.0.0.1:5173
supabase secrets set CHECKOUT_REDIRECT_ORIGINS=https://your-app.example.com,http://localhost:5173,http://127.0.0.1:5173
```

7. Deploy edge functions:

```bash
supabase functions deploy ai-fix
supabase functions deploy create-checkout-session
supabase functions deploy confirm-checkout-session
supabase functions deploy stripe-webhook --no-verify-jwt
```

8. Configure Stripe webhook endpoint in Stripe Dashboard:

- Endpoint URL:
  - `https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook`
- Events to send:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

9. Start development server:

```bash
npm run dev
```

## Programmatic SEO pages

Generate keyword landing pages and refresh `public/sitemap.xml`:

```bash
npm run seo:generate
```

Generated pages are written to `public/seo/*.html`.
By default URLs use `https://vibesec.info`. Override with:

```bash
SEO_SITE_URL=https://your-domain.com npm run seo:generate
```

## Notes

- Auth sessions are managed by Supabase Auth in the browser client.
- Password reset uses Supabase redirect URLs above and returns users to this app for in-app password update.
- The scan itself is simulated in-browser using mock data.
- Gemini is used only when clicking `Fix with AI` on a finding, and calls happen server-side in the `ai-fix` function.
- Paid plan buttons in Settings redirect to Stripe Checkout via the `create-checkout-session` function.
- After checkout return, `confirm-checkout-session` verifies the Stripe session and updates plan entitlements.
- Stripe webhooks also sync subscription state server-to-server, so billing stays correct even if the browser callback is interrupted.
- Billing units recorded in database:
  - `scan_run`
  - `ai_fix`
