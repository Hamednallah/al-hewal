# Go-Live Guide — When You Buy the Domain

> **When to use this file:** the moment a real domain (e.g.
> `al-hewal.com`) is purchased and ready to point at Vercel. The
> site is currently live on `al-hewal.vercel.app` for development,
> but most of the items below cannot be set up against a `vercel.app`
> subdomain (Google Search Console, Google Business Profile, custom
> email, etc.). This guide walks through every step click-by-click,
> in the right order.
>
> If something here is broken, the owner will notice within a week.
> Don't skip items because they "feel optional".

---

## 0 — What's already done (so you don't redo it)

Before working through the rest of this file, know that the build
side is done. **The development checklist is closed:**

- ✅ Public website (home, catalog, property detail, about, contact, 404, 500)
- ✅ Admin Command Center (login, listings, image upload, leads journal, analytics, profile, admin management, amenities editor)
- ✅ Bilingual AR/EN routing with RTL CSS + IBM Plex Sans Arabic
- ✅ WhatsApp lead capture (302 redirect + audit log + rate limit)
- ✅ Vercel Blob image pipeline (sharp resize, AVIF/WebP, EXIF strip)
- ✅ JSON-LD `RealEstateListing` schema on every property
- ✅ Bilingual CSV export of leads (Excel-on-Windows reads Arabic correctly)
- ✅ axe-core accessibility gates on every public + admin route
- ✅ KSA PDPL consent banner
- ✅ Bilingual 404 + 500 error pages
- ✅ Content-Security-Policy header (report-only)
- ✅ Property-detail map (Carto Basemaps tile source)
- ✅ Sitemap, robots.txt, OG images, favicon, web manifest

**Deferred items (NOT blockers for go-live):**

- Sentry error reporting — re-evaluate when traffic justifies it
- TOTP enrolment — re-evaluate when admin team grows
- Bilingual PDF lead export — CSV satisfies the need today
- `pg_dump` weekly backup — Supabase's daily snapshots cover it
- k6 load test — re-evaluate when there's real traffic

These come back into scope if production usage changes the picture.
Until then, ignore them.

---

## 1 — Domain + DNS + Vercel

### 1.1 Buy the domain (5 min)

Recommended registrars in KSA:

| Registrar                              | Pros                                                                     | Cons                               |
| -------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------- |
| **Cloudflare Registrar** (recommended) | At-cost pricing (~$10/yr `.com`), free WHOIS privacy, free DNS, free SSL | Requires Cloudflare account        |
| **Namecheap**                          | Cheap, well-known, easy UI                                               | WHOIS privacy free first year only |
| **GoDaddy**                            | Familiar, has Arabic support                                             | Most expensive, aggressive upsells |

Purchase `al-hewal.com` (or whichever TLD the owner has in mind —
`.com.sa` is the KSA ccTLD but requires a Saudi commercial
registration document).

### 1.2 Attach the domain to Vercel (10 min)

1. Vercel dashboard → **al-hewal** project → **Settings** → **Domains**.
2. Click **Add** → type `al-hewal.com` → **Add**.
3. Vercel shows two records to add at the registrar:
   - An **A record** at `@` pointing to `76.76.21.21`
   - A **CNAME record** at `www` pointing to `cname.vercel-dns.com`
4. Open the registrar's DNS panel and add both records. If using
   Cloudflare DNS, also do this:
   - Set both records to **DNS only** (grey cloud), **not proxied**
     (orange cloud). Vercel handles SSL itself; double-proxying
     causes redirect loops.
5. Back in Vercel, click **Refresh** next to the domain. Within a
   few minutes (sometimes up to an hour for global DNS propagation)
   the domain shows as **Valid Configuration** with a green check.
6. Click **Set as Production Domain** — `al-hewal.com` becomes the
   primary URL. `al-hewal.vercel.app` keeps working as a fallback.

**Done when:** `https://al-hewal.com` loads the site with a valid
SSL cert (padlock icon in the browser).

### 1.3 Force WWW or non-WWW (2 min)

Vercel auto-redirects `www.al-hewal.com` → `al-hewal.com` (or the
other way). Confirm which one the owner prefers:

- **Non-www** (`al-hewal.com`) is shorter and modern — recommended.
- **www** (`www.al-hewal.com`) is more traditional.

In Vercel → **Settings** → **Domains** → click the domain → set
**Primary** to whichever the owner picks. The other automatically
redirects.

---

## 2 — Environment variables for the new domain

The platform has several places that hard-reference the URL. All
need updating in one redeploy so the site doesn't show
`vercel.app` URLs in canonicals, sitemap, OG cards, etc.

### 2.1 `NEXT_PUBLIC_SITE_URL` (3 min)

1. Vercel → project → **Settings** → **Environment Variables**.
2. Find `NEXT_PUBLIC_SITE_URL` in the **Production** scope.
3. Edit → change value to `https://al-hewal.com` (no trailing
   slash). Keep Preview + Development at `http://localhost:3000`.
4. Save. **Trigger a redeploy** from the Deployments tab so the
   value gets baked into the build (NEXT*PUBLIC*\* vars are inlined
   at build time).

This URL drives:

- Canonical `<link rel="canonical">` on every page
- `hreflang` alternates
- OG image absolute URLs
- Sitemap absolute URLs
- `robots.txt`'s sitemap reference
- WhatsApp deep-link's `{url}` placeholder

### 2.2 Supabase Auth redirect URLs (5 min)

The admin login flow + invite + password-recovery emails all bounce
through Supabase's URL allowlist. Adding the new domain prevents
"redirect_to URL not in allowlist" errors.

1. Supabase dashboard → **Authentication** → **URL Configuration**.
2. **Site URL** → change to `https://al-hewal.com`.
3. **Redirect URLs** allowlist — add:
   - `https://al-hewal.com/**`
   - `https://al-hewal.com/auth/recovery`
   - `https://al-hewal.com/ar/admin/**`
   - `https://al-hewal.com/en/admin/**`
4. Keep the old `https://al-hewal.vercel.app/*` entries for now
   (existing invite links the owner sent before the domain switch
   still work). Remove them after a month.
5. Click **Save**.

### 2.3 OG image regeneration (2 min)

The OG images at `/<locale>/opengraph-image.tsx` use
`NEXT_PUBLIC_SITE_URL` for absolute paths. The redeploy from
step 2.1 already regenerates them. Verify in step 7.1 below.

---

## 3 — Move SMTP off your personal Gmail

You're currently sending admin invite emails + password-reset
emails through your personal Gmail App Password (PHASE_3_RUNBOOK
§8 Path A). That works but two problems:

- The "From" address is your personal email, not `noreply@al-hewal.com`
- Gmail's daily sending limit is 500 — enough for now, won't scale
- If you ever lose access to your Gmail, invites stop working

After the domain is bought, switch to **Resend with verified
domain** (PHASE_3_RUNBOOK §8 Path B).

### 3.1 Verify the domain with Resend (15 min)

1. Sign up at https://resend.com (free tier: 100 emails/day, 3,000
   emails/month — plenty for Al Hewal).
2. **Domains** → **Add Domain** → `al-hewal.com`.
3. Resend gives you 4 DNS records: 1 SPF (TXT), 2 DKIM (CNAME), 1
   DMARC (TXT). Add all 4 at the registrar's DNS panel.
4. Wait 5-15 minutes, then click **Verify Domain**. Resend confirms
   each record.
5. **API Keys** → **Create API Key** → name `al-hewal-supabase`,
   permission **Sending access** to `al-hewal.com`. Copy the
   `re_...` key.

### 3.2 Point Supabase Auth at Resend (5 min)

1. Supabase → **Authentication** → **Emails** → **SMTP Settings**.
2. Toggle **Enable Custom SMTP**.
3. Fill in:
   - **Sender email:** `invites@al-hewal.com` (or `noreply@al-hewal.com`)
   - **Sender name:** `الحوال للتطوير العقاري`
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** the `re_...` API key from step 3.1
   - **Min interval:** `1 second`
4. Click **Save**.
5. Test: from `/admin/admins/new`, invite a throwaway address you
   control (e.g. `you+test@gmail.com`). The invite email should
   arrive within seconds, From `invites@al-hewal.com`.

### 3.3 Decommission the Gmail path (1 min)

Once Resend works for two invites in a row:

1. Supabase → Authentication → Emails → SMTP Settings.
2. Remove the Gmail entry from the **Username / Password** section
   (Resend now occupies those fields).
3. Optional: revoke the Gmail App Password at
   https://myaccount.google.com/apppasswords so it can't be used
   anywhere else.

---

## 4 — Search engine indexing

### 4.1 Google Search Console (15 min)

1. https://search.google.com/search-console
2. Sign in with the **Google account that owns the al-hewal.com
   domain**. (If the registrar is the registrant and the registrant
   email is a Workspace mailbox, that's the account.)
3. **Add property** → **URL prefix** → enter
   `https://al-hewal.com` (the production domain, not the
   `.vercel.app` URL).
4. Verify ownership using one of:
   - **HTML tag** (easiest): copy the
     `<meta name="google-site-verification" ...>` value, send it
     to me. I'll add it to `src/app/[locale]/layout.tsx`'s
     `metadata.verification.google` field and redeploy. Then
     click **Verify**.
   - **DNS TXT record** (no redeploy needed): add the TXT record
     Google gives you at the registrar. Verify after 5-15 minutes.
5. Once verified → **Sitemaps** → enter
   `https://al-hewal.com/sitemap.xml` → **Submit**.
6. **URL Inspection** → paste a property URL → **Request
   indexing** to nudge Google for the first few properties.

**Done when:** the sitemap shows "Success" in Search Console and
at least one property URL shows "URL is on Google" after 24-48
hours.

### 4.2 Bing Webmaster Tools (10 min)

Captures Microsoft Edge users (~7% of KSA traffic).

1. https://www.bing.com/webmasters → sign in with a Microsoft
   account.
2. **Import from Google Search Console** — Bing reads verified
   GSC properties directly. One click.
3. If that fails: add the site manually (`https://al-hewal.com`)
   and verify via the meta-tag method (same pattern as GSC).
4. Submit the sitemap (`/sitemap.xml`).

**Done when:** Bing Webmaster Tools shows the site as verified and
the sitemap as accepted.

### 4.3 robots.txt sanity check (2 min)

1. Visit `https://al-hewal.com/robots.txt` in any browser.
2. Verify it allows public pages and blocks `/admin/*`,
   `/auth/*`, `/api/*`.
3. The file is generated from `src/app/robots.ts` — if anything
   looks wrong, tell me what changed and I'll patch it.

---

## 5 — Local SEO (KSA)

### 5.1 Google Business Profile (20 min)

Goal: appear in Google Maps when someone searches "شركة عقارية في
الدانة".

1. https://business.google.com/create
2. Sign in with the same Google account as Search Console.
3. **Business name:** `الحوال للتطوير والاستثمار العقاري` (or
   `Al Hewal Real Estate Development & Investment` — Google
   supports bilingual). Use the exact legal name from `alhewal.txt`.
4. **Business category:** Real Estate Developer.
5. **Location:** enter the physical Riyadh address from the
   company documents.
6. **Service area:** add Riyadh, Al Dana district, and any other
   cities where Al Hewal operates.
7. **Phone + website:** the WhatsApp number and
   `https://al-hewal.com`.
8. **Hours:** office hours, Arabic week (Sun-Thu).
9. **Verify:** choose postcard (3-5 days) OR phone call (instant
   if eligible).
10. After verification, **upload 5+ photos** of completed
    projects, the office, and the team. Profiles with photos get
    42% more directions requests.

**Done when:** searching "Al Hewal" or "الحوال" in Google Maps
on a fresh browser shows the verified listing with photos.

### 5.2 Structured data audit (5 min)

The platform already emits JSON-LD `RealEstateListing` schema on
every property page.

1. https://search.google.com/test/rich-results
2. Paste a production property URL
   (e.g. `https://al-hewal.com/ar/properties/al-dana-21-duplex`).
3. Expect: green check + "Real Estate Listing" detected.
4. Repeat for `/en/properties/al-dana-21-duplex` to confirm both
   locales.
5. If anything is yellow/red, tell me what the report says and
   I'll fix the JSON-LD generator.

### 5.3 Local keyword presence (editorial, 5 min)

This is the only item that needs editorial work, not code. Confirm
the following appear in the message catalogs
(`src/i18n/messages/ar.json`):

- "تطوير عقاري" (Real Estate Development) — page titles, hero text
- "استثمار عقاري" (Real Estate Investment) — about, footer
- "حي الدانة" (Al Dana District) — featured project page
- "الكود السعودي" (Saudi Building Code) — value proposition

If anything is missing, tell me and I'll add it as a
translation-only commit.

---

## 6 — Performance & quality audits

### 6.1 Lighthouse audit (10 min)

Goal: Performance ≥ 90, Accessibility ≥ 95, SEO = 100 on mobile.

1. Open the production site in Chrome **Incognito** (no extensions).
2. **F12** → **Lighthouse** tab.
3. Device: **Mobile**. Categories: all checked. Mode: **Navigation**.
4. **Analyze page load** on:
   - `/ar` (home)
   - `/ar/properties` (catalog)
   - `/ar/properties/al-dana-21-duplex` (detail)
   - Same three on `/en/...`
5. Screenshot each report and share with me. Target rows:
   - Performance: ≥ 90 (mobile). If lower, send the report —
     likely a hero image needs `priority` removed or sized
     differently.
   - Accessibility: ≥ 95. Anything lower is a bug; I fix it.
   - SEO: 100.
   - Best Practices: ≥ 95.

### 6.2 Image optimisation spot-check (5 min)

1. Open Chrome DevTools → **Network** → filter **Img**.
2. Reload a property detail page.
3. Look at the **Type** column — every image should be `avif` or
   `webp`, never `jpeg` or `png`.
4. Sort by **Size** — no single image larger than 200 KB.
5. If you see violations, share the URL — likely the upload
   pipeline needs the sharp `quality` parameter tuned.

### 6.3 Broken-link crawl (5 min)

1. Install **Screaming Frog** (free for up to 500 URLs):
   https://www.screamingfrog.co.uk/seo-spider/
2. Open it, enter `https://al-hewal.com` → **Start**.
3. Wait for it to finish (a few minutes).
4. Click **Response Codes** tab → filter for **Client Error 4xx**
   and **Server Error 5xx**.
5. Any results = a broken link. Send me the list.

---

## 7 — Conversion & analytics

### 7.1 Open Graph + WhatsApp preview check (5 min)

Sharing a link on WhatsApp / Twitter / LinkedIn should show a
beautiful preview card with the new domain.

1. Open https://www.opengraph.xyz (or paste the URL into a
   WhatsApp conversation with yourself and wait for the preview).
2. Paste `https://al-hewal.com/ar/properties/al-dana-21-duplex`.
3. Expect: property title, price, hero image, and `الحوال`
   branding visible. The URL shown should be `al-hewal.com`, not
   `al-hewal.vercel.app`.
4. Repeat for `/en/properties/al-dana-21-duplex`.
5. If the preview is wrong (still shows the old domain), the OG
   image cache hasn't refreshed — send me a screenshot and I'll
   force-revalidate.

### 7.2 Vercel Analytics (2 min)

1. Vercel dashboard → **al-hewal** project → **Analytics** tab.
2. Click **Enable Web Analytics** (free tier: 2.5k events/month —
   plenty).
3. Verify the snippet shows "Receiving events" within an hour of
   browsing the site.

### 7.3 WhatsApp click verification (5 min)

Goal: confirm every WhatsApp button click writes a row to the
`leads` table.

1. In Supabase dashboard → **Table Editor** → `leads` table.
2. Note the current row count.
3. On the live site, browse to a property and click the WhatsApp
   button.
4. Refresh the `leads` table — there should be exactly one new
   row with:
   - `source = 'whatsapp'`
   - `property_id` matching the property you clicked from
   - `locale` matching the URL prefix
   - `created_at` within the last minute
   - `ip_hash` populated (not the raw IP — should be a hex
     string)
5. Repeat the test from `/en/...` and from a phone to verify the
   mobile sticky bar works.
6. Open the WhatsApp app on the phone — the prefilled message
   should contain the property title in the right language and
   the property URL **using the new domain**.

### 7.4 Content-Security-Policy verification (2 min)

The CSP header is currently in report-only mode (Phase 5-B
deliverable). After a week or two of running cleanly, we promote
to enforce.

1. Open https://al-hewal.com in Chrome.
2. **F12** → **Network** tab → reload → click the document
   request.
3. **Response Headers** should include
   `Content-Security-Policy-Report-Only: default-src 'self'; ...`.
4. **Console** tab — if you see any "Refused to load" messages,
   note the URL and send me the list. Those are the violations
   we'd need to allowlist before promoting to enforce.

---

## 8 — Handover & security

### 8.1 Environment variables sanity check (5 min)

For each of these, log into Vercel → project → **Settings** →
**Environment Variables**, filter by name, confirm a value exists
in the **Production** scope:

| Variable                                              | Where to get it                                       |
| ----------------------------------------------------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                | `https://al-hewal.com`, no trailing slash (step 2.1)  |
| `NEXT_PUBLIC_SUPABASE_URL`                            | Supabase → Settings → API → Project URL               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                       | Supabase → Settings → API → `anon` `public`           |
| `SUPABASE_SERVICE_ROLE_KEY`                           | Supabase → Settings → API → `service_role` `secret`   |
| `BLOB_READ_WRITE_TOKEN`                               | Vercel → Storage → Blob → `.env.local` tab            |
| `NEXT_PUBLIC_WHATSAPP_PHONE`                          | The real WhatsApp business number, E.164 digits, no + |
| `AUTH_COOKIE_SECRET`                                  | 64-char hex; `openssl rand -hex 32` to generate       |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | https://console.upstash.com → your DB → Details       |

**Never** put the service-role key in **Preview** or
**Development** — production only.

### 8.2 Owner training video (30 min)

Record a Loom (https://loom.com — free) covering:

1. Opening the admin panel at `https://al-hewal.com/ar/admin` and
   signing in via email + password (the new domain-email login).
2. Adding a new property:
   - Click **Add New Property**
   - Fill the form: bilingual title, type, price, status, area,
     bedrooms, bathrooms, city, district, **facade** (dropdown),
     plot number, etc.
   - Click **Save**, the form redirects to the edit page
   - In the **Images** section, drag-drop property photos. First
     photo is the hero by default; reorder by drag and re-pick
     hero with the "Set as hero" button.
   - In the **Amenities** section below, tick the relevant
     amenities (changes auto-save).
   - If status was set to `draft`, click **Publish now** in the
     orange banner at the top.
   - Open the public site, verify the property appears with the
     correct title, photos, amenities, and map pin.
3. Reading the analytics:
   - Strategic Analytics tab → KPI cards (last 30 days) + line
     chart (leads/day) + source-mix bar + top-cities bar.
   - The dashboard root also shows quick KPIs + tile shortcuts.
4. Reading the leads:
   - Leads Journal → filter bar (project, source, inquiry type,
     status) + per-row actions (copy phone, open WhatsApp, mark
     contacted, edit notes).
   - **Export CSV** button at the top right downloads all
     matching leads.
5. Inviting a teammate:
   - Admin Management tab → **Invite Admin**.
   - Email + Full name + Tier (Standard or Super).
   - Supabase emails an invite link from
     `invites@al-hewal.com` (step 3.2 above).
   - The invitee clicks the link, sets a password, lands in
     `/admin`.

Share the Loom URL with the owner.

### 8.3 Invite the owner to their own account (5 min)

Until you do this, you're the only super-admin and the owner
cannot sign in.

1. Sign into the admin panel with your super-admin account.
2. **Admin Management** → **Invite Admin**.
3. Name: the owner's full name. Email: the owner's domain email
   (e.g. `owner@al-hewal.com` once a Workspace mailbox exists, or
   their personal address for now). Tier: **Super Admin**.
4. Click **Invite**. The system sends them the invite email.
5. Walk them through accepting it (set a strong password).

### 8.4 Self-demote (optional, 1 min)

Once the owner has a super-admin account and has signed in at
least once, you can self-demote so the owner has sole control
over admin invitations:

- Admin Management → find your row → click **Tier** → change to
  **Standard Admin**.

The trigger from migration 0003 (with the 0006 bypass) makes this
require super-admin privileges — log in as the owner to do it, or
have the owner do it themselves.

---

## Final sign-off

When every box below is ticked, send the Loom + Lighthouse
screenshots + this checklist (with checkboxes filled) to the
owner. That's hand-over.

- [ ] Domain bought + DNS configured + Vercel attached (§1)
- [ ] `NEXT_PUBLIC_SITE_URL` + Supabase redirect URLs updated (§2)
- [ ] Resend SMTP set up; Gmail decommissioned (§3)
- [ ] Search Console verified + sitemap submitted (§4.1)
- [ ] Bing Webmaster verified (§4.2)
- [ ] Google Business Profile claimed + photos uploaded (§5.1)
- [ ] Rich Results test green on AR + EN property pages (§5.2)
- [ ] Lighthouse mobile ≥ 90 on home + catalog + detail, both locales (§6.1)
- [ ] All hero images < 200 KB AVIF/WebP (§6.2)
- [ ] No 4xx/5xx broken links (§6.3)
- [ ] OG preview shows new domain (§7.1)
- [ ] Vercel Analytics receiving events (§7.2)
- [ ] WhatsApp click writes a `leads` row end-to-end on new domain (§7.3)
- [ ] CSP header present in Response Headers; zero console violations (§7.4)
- [ ] All production env vars present (§8.1)
- [ ] Loom training video sent to the owner (§8.2)
- [ ] Owner has their own super-admin account (§8.3)

---

## After hand-over: are we done?

**Yes.** The master-plan build is complete after this checklist
is signed off. The deferred items in §0 are deliberate scope-cuts
that come back into play only when production reality demands
them:

- If you start seeing JS errors you can't reproduce locally →
  re-evaluate Sentry.
- If the admin team grows beyond the owner → re-evaluate TOTP.
- If a stakeholder asks for a printable lead report → re-evaluate
  PDF export.
- If you ever lose a row to a Supabase bug → re-evaluate
  `pg_dump` backup.

Otherwise, day-to-day operation is just: add properties via the
admin, watch the analytics, follow up on leads in the journal.
The site runs itself.
