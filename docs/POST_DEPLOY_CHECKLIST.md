# Go-Live Checklist (Phase 6) — Al Hewal

> **When to use this file:** after the Phase 5 deploy goes to production
> (custom domain attached, SSL active, real Supabase project, real
> Vercel Blob bucket). Work through every item in order. Each step
> includes the click-by-click route, the URL, and what "done" looks like.

If something on this list is broken, the owner will notice within a
week. Don't skip items because they "feel optional".

---

## 1 — Search engine indexing

### 1.1 Google Search Console (15 min)

**Goal:** Google starts indexing every property page so users searching
"فلل الدانة" find Al Hewal.

1. Go to https://search.google.com/search-console
2. Sign in with the **Google account that owns the al-hewal.com domain**.
3. Click **Add property** → **URL prefix** → enter
   `https://al-hewal.com` (the production domain).
4. Verify ownership using one of:
   - **HTML tag** (easiest): copy the `<meta name="google-site-verification" ...>`
     value, send it to me. I'll add it to `src/app/[locale]/layout.tsx`'s
     `metadata.verification.google` field and redeploy. Then click
     **Verify**.
   - **DNS TXT record**: if the domain is on Vercel DNS, go to
     Vercel → **Domains** → click the domain → **DNS Records** →
     **Add Record** → Type `TXT`, Name `@`, Value the
     `google-site-verification=...` string Google gave you.
5. Once verified, **Sitemaps** → enter
   `https://al-hewal.com/sitemap.xml` → **Submit**.
6. **URL Inspection** → paste a property URL → **Request indexing**
   to nudge Google for the first few properties.

**Done when:** the sitemap shows "Success" in Search Console and at
least one property URL shows "URL is on Google" after 24-48 hours.

### 1.2 Bing Webmaster Tools (10 min)

**Goal:** capture Microsoft Edge users (about 7% of KSA traffic).

1. Go to https://www.bing.com/webmasters and sign in with a Microsoft
   account.
2. **Import from Google Search Console** — Bing reads your verified
   GSC properties directly. One click and you're done.
3. If that fails: add the site manually
   (`https://al-hewal.com`) and verify via the meta-tag method (same
   pattern as GSC).
4. Submit the sitemap (`/sitemap.xml`).

**Done when:** Bing Webmaster Tools shows the site as verified and the
sitemap as accepted.

### 1.3 Robots.txt sanity check (2 min)

1. Visit `https://al-hewal.com/robots.txt` in any browser.
2. Verify it allows public pages and blocks `/admin/*`, `/auth/*`,
   `/api/*`.
3. If wrong, the file is generated from `src/app/robots.ts` —
   tell me what changed and I'll patch it.

---

## 2 — Local SEO (KSA)

### 2.1 Google Business Profile (20 min)

**Goal:** appear in Google Maps when someone searches "شركة عقارية في
الدانة".

1. Go to https://business.google.com/create
2. Sign in with the same Google account as Search Console.
3. **Business name:** `الحوال للتطوير والاستثمار العقاري` (or
   `Al Hewal Real Estate Development & Investment` — Google supports
   bilingual). Use the exact legal name from `alhewal.txt`.
4. **Business category:** Real Estate Developer.
5. **Location:** enter the physical Riyadh address from the company
   documents.
6. **Service area:** add Riyadh, Al Dana district, and any other cities
   where Al Hewal operates.
7. **Phone + website:** the WhatsApp number and `https://al-hewal.com`.
8. **Hours:** office hours, Arabic week (Sun-Thu).
9. **Verify**: choose postcard (3-5 days) OR phone call (instant if
   eligible).
10. After verification, **upload 5+ photos** of completed projects, the
    office, and the team. Profiles with photos get 42% more directions
    requests.

**Done when:** searching "Al Hewal" or "الحوال" in Google Maps on a
fresh browser shows the verified listing with photos.

### 2.2 Structured data audit (5 min)

The platform already emits JSON-LD `RealEstateListing` schema on every
property page (Phase 2 deliverable).

1. Visit https://search.google.com/test/rich-results
2. Paste a production property URL (e.g. `https://al-hewal.com/ar/properties/al-dana-21`)
3. Expect: green check + "Real Estate Listing" detected.
4. Repeat for `/en/properties/al-dana-21` to confirm both locales.
5. If anything is yellow/red, tell me what the report says and I'll fix
   the JSON-LD generator.

### 2.3 Local keyword presence

This is the only item that needs editorial work, not code. Confirm the
following appear in the message catalogs (`src/i18n/messages/ar.json`):

- "تطوير عقاري" (Real Estate Development) — page titles, hero text
- "استثمار عقاري" (Real Estate Investment) — about, footer
- "حي الدانة" (Al Dana District) — featured project page
- "الكود السعودي" (Saudi Building Code) — value proposition

If anything is missing, I'll add it as a translation-only commit.

---

## 3 — Performance & quality audits

### 3.1 Lighthouse audit (10 min)

**Goal:** Performance ≥ 90, Accessibility ≥ 95, SEO = 100 on mobile.

1. Open the production site in Chrome **Incognito** (no extensions).
2. **F12** → **Lighthouse** tab.
3. Device: **Mobile**. Categories: all checked. Mode: **Navigation**.
4. **Analyze page load** on:
   - `/ar` (home)
   - `/ar/properties` (catalog)
   - `/ar/properties/al-dana-21` (detail)
   - Same three on `/en/...`
5. Screenshot each report and share with me. Target rows:
   - Performance: ≥ 90 (mobile). If lower, send the report — likely a
     hero image needs `priority` removed or sized differently.
   - Accessibility: ≥ 95. Anything lower is a bug; I fix it.
   - SEO: 100.
   - Best Practices: ≥ 95.

### 3.2 Image optimisation spot-check (5 min)

1. Open Chrome DevTools → **Network** → filter **Img**.
2. Reload a property detail page.
3. Look at the **Type** column — every image should be `avif` or
   `webp`, never `jpeg` or `png`.
4. Sort by **Size** — no single image larger than 200 KB.
5. If you see violations, share the URL — likely the upload pipeline
   needs the sharp `quality` parameter tuned.

### 3.3 Broken-link crawl (5 min)

1. Install **Screaming Frog** (free for up to 500 URLs):
   https://www.screamingfrog.co.uk/seo-spider/
2. Open it, enter `https://al-hewal.com` → **Start**.
3. Wait for it to finish (a few minutes).
4. Click **Response Codes** tab → filter for **Client Error 4xx** and
   **Server Error 5xx**.
5. Any results = a broken link. Send me the list.

---

## 4 — Conversion & analytics

### 4.1 Vercel Analytics (2 min)

1. Vercel dashboard → your **al-hewal** project → **Analytics** tab.
2. Click **Enable Web Analytics** (free tier: 2.5k events/month — plenty).
3. Verify the snippet shows "Receiving events" within an hour of
   browsing the site.

### 4.2 WhatsApp click verification (5 min)

**Goal:** make sure every WhatsApp button click writes a row to the
`leads` table.

1. In Supabase dashboard → **Table Editor** → `leads` table.
2. Note the current row count.
3. On the live site, browse to a property and click the WhatsApp button.
4. Refresh the `leads` table — there should be exactly one new row with:
   - `source = 'whatsapp'`
   - `property_id` matching the property you clicked from
   - `locale` matching the URL prefix
   - `created_at` within the last minute
   - `ip_hash` populated (not the raw IP — should be a hex string)
5. Repeat the test from `/en/...` and from a phone to verify mobile
   sticky bar works.
6. Open the WhatsApp app on the phone — the prefilled message should
   contain the property title in the right language and the property URL.

### 4.3 Sentry error tracking (10 min)

1. Go to https://sentry.io and sign in (free tier: 5k errors/month).
2. **Create Project** → Platform: **Next.js** → name `al-hewal`.
3. Copy the **DSN** (looks like `https://<key>@<org>.ingest.sentry.io/<project>`).
4. Vercel dashboard → project → **Settings** → **Environment Variables**:
   - Add `SENTRY_DSN` = the DSN value, scope: Production + Preview
   - Add `SENTRY_AUTH_TOKEN` = generate at https://sentry.io/settings/account/api/auth-tokens/
     (scopes: `project:read`, `project:releases`)
5. Redeploy. After deploy, the first uncaught error in production
   appears in Sentry within seconds.
6. Test it: visit `https://al-hewal.com/api/_test/throw` (we'll add a
   guarded test route in Phase 5). The error should appear in Sentry
   with the deploy version and stack trace.

---

## 5 — Handover & security

### 5.1 Environment variables sanity check (5 min)

For each of these, log into Vercel → project → **Settings** → **Environment
Variables**, filter by name, confirm a value exists in the **Production**
scope:

| Variable                                              | Where to get it                                       |
| ----------------------------------------------------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                | the production URL, no trailing slash                 |
| `NEXT_PUBLIC_SUPABASE_URL`                            | Supabase → Settings → API → Project URL               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                       | Supabase → Settings → API → `anon` `public`           |
| `SUPABASE_SERVICE_ROLE_KEY`                           | Supabase → Settings → API → `service_role` `secret`   |
| `BLOB_READ_WRITE_TOKEN`                               | Vercel → Storage → Blob → `.env.local` tab            |
| `NEXT_PUBLIC_WHATSAPP_PHONE`                          | the real WhatsApp business number, E.164 digits, no + |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | https://console.upstash.com → your DB → Details       |
| `SENTRY_DSN` + `SENTRY_AUTH_TOKEN`                    | step 4.3 above                                        |
| `RESEND_API_KEY`                                      | optional fallback (https://resend.com → API Keys)     |

**Never** put the service-role key in **Preview** or **Development** —
production only.

### 5.2 Owner training video (30 min)

Record a Loom (https://loom.com — free) covering:

1. Opening the admin panel at `https://al-hewal.com/ar/admin` and
   signing in via magic link (paste the link from the invite email).
2. Adding a new property:
   - Click **Add New Property**
   - Fill Step 1 (bilingual title, type, price, status)
   - Step 2 (drag images in, write Arabic + English alt text)
   - Step 3 (location, amenities)
   - Click **Publish Listing**
   - Open the public site, verify the property appears.
3. Reading the WhatsApp conversion stats:
   - Strategic Analytics tab → Lead Velocity chart
   - Leads Journal → today's WhatsApp clicks
4. Inviting a teammate:
   - Admin Management tab → **Add New Administrator**
   - Pick **Standard** or **Super** tier
   - Click **Generate Invitation Link** — the system emails it; you
     copy it from the email and forward to the invitee.

Share the Loom URL with the owner.

### 5.3 Invite the owner to their own account (5 min)

Until you do this, you're the only super-admin and the owner cannot
sign in.

1. Sign into the admin panel with your super-admin account.
2. **Admin Management** → **Add New Administrator**.
3. Name: the owner's full name. Email: the owner's real email. Tier:
   **Super Admin**.
4. Click **Generate Invitation Link**. Forward the email to the owner.
5. Walk them through accepting it (set a strong password, enrol TOTP).

### 5.4 Demote your own account to Standard Admin (optional, 1 min)

Once the owner has a super-admin account, you can self-demote so the
owner has sole control over admin invitations:

- Admin Management → find your row → click **Tier** → **Standard Admin**.

The trigger from migration 0003 makes this require super-admin
privileges — log in as the owner to do it, or have the owner do it
themselves.

---

## 6 — Social proof

### 6.1 Open Graph preview check (5 min)

Sharing a link to WhatsApp / Twitter / LinkedIn should show a beautiful
preview card.

1. Open https://www.opengraph.xyz (or paste the URL into a WhatsApp
   conversation with yourself and wait for the preview).
2. Paste `https://al-hewal.com/ar/properties/al-dana-21`.
3. Expect: property title, price, hero image, and `الحوال` branding
   visible.
4. Repeat for `/en/properties/al-dana-21`.
5. If the preview is wrong, the issue is in `opengraph-image.tsx` —
   send me a screenshot and I'll fix it.

### 6.2 WhatsApp pre-fill message check (3 min)

1. From your phone, open `https://al-hewal.com/ar/properties/al-dana-21`.
2. Tap the WhatsApp button.
3. WhatsApp should open with a pre-filled message like:
   _"السلام عليكم، أرغب في الاستفسار عن مشروع الدانة 21 المعروض بسعر
   950,000 ريال — https://al-hewal.com/ar/properties/al-dana-21"_
4. Same test in `/en` should pre-fill the English equivalent.

---

## Final sign-off

When every box above is ticked:

- [ ] Search Console verified + sitemap submitted
- [ ] Bing Webmaster verified
- [ ] Google Business Profile claimed
- [ ] Rich Results test green on AR + EN property pages
- [ ] Lighthouse mobile ≥ 90 on home + catalog + detail (both locales)
- [ ] All hero images < 200 KB AVIF/WebP
- [ ] No 4xx/5xx broken links
- [ ] Vercel Analytics receiving events
- [ ] WhatsApp click writes a `leads` row end-to-end
- [ ] Sentry receiving errors
- [ ] All production env vars present
- [ ] Loom training video sent to the owner
- [ ] Owner has their own super-admin account
- [ ] OG preview renders correctly
- [ ] WhatsApp pre-fill message reads correctly

Send the Loom + a screenshot of the Lighthouse + a copy of this
checklist to the owner. That's hand-over.
