import { type NextRequest, NextResponse } from 'next/server';

import { type Locale, routing } from '@/i18n/routing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /auth/recovery?locale=<ar|en>&type=<invite|reset>
 *
 * Landing target for the Supabase invite + password-recovery email
 * links. This is a Route Handler that streams HTML + a tiny inline
 * script — NOT a React page — to sidestep two problems with the
 * earlier designs:
 *
 *   1. The original server-only Route Handler (PR #34) read `?code=`
 *      from the query and called `exchangeCodeForSession`. That works
 *      for projects on the PKCE flow but FAILS for this project's
 *      Supabase Auth implicit flow — Supabase delivers the session in
 *      the URL **fragment** (`#access_token=...&refresh_token=...`),
 *      which browsers don't send to the server. The handler saw no
 *      code and bounced the user to /auth/forgot even though the
 *      verify had just succeeded. The user re-clicked the email, and
 *      THE SECOND CLICK really did fail because the token is single-
 *      use. Supabase Auth Logs confirmed this — the FIRST verify
 *      returned 303 success + `user_signedup` event, the second
 *      returned 403 "One-time token not found".
 *
 *   2. A React page version (page.tsx + Client Component) needs a root
 *      layout, and the only existing layouts in this repo live under
 *      `[locale]/`. Adding a sibling layout collides; moving the
 *      route under `[locale]/auth/recovery` breaks the Supabase
 *      Redirect-URLs allowlist entries that already point at
 *      wildcard-rooted /auth/recovery (owner action to re-do per environment).
 *
 * This route handler dodges both by returning HTML directly with an
 * inline script that:
 *   - Reads `window.location.hash` (implicit-flow tokens land here),
 *     falling back to `?code=` for PKCE.
 *   - POSTs the tokens (or code) to `/api/auth/finalize-session`,
 *     which calls `setSession` / `exchangeCodeForSession` on a Route-
 *     Handler-scoped Supabase client (Route Handlers CAN write cookies
 *     in Next 15; Server Components cannot — see PR #34's docblock).
 *   - Hard-navigates (`window.location.replace`) to the success or
 *     expired path. Hard navigation drops the fragment so tokens
 *     don't linger in browser history.
 *   - Invite expired → `/<locale>/auth/login?error=inviteExpired`
 *     (invitee has no password to recover; recovery flow is the wrong
 *     screen).
 *   - Reset expired → `/<locale>/auth/forgot?error=expired`.
 *
 * The inline JS uses only ES5 + standard browser APIs — no bundling,
 * no React. The locale + paths are baked into the HTML server-side
 * (`JSON.stringify` for the script literals; HTML-escaped for the
 * visible text) so the JS doesn't need to re-parse the query string.
 */
function isLocale(value: string | null): value is Locale {
  return (routing.locales as readonly string[]).includes(value ?? '');
}

function resolveLocale(value: string | null): Locale {
  return isLocale(value) ? value : routing.defaultLocale;
}

function resolveType(value: string | null): 'invite' | 'reset' {
  return value === 'invite' ? 'invite' : 'reset';
}

const VERIFYING_LABEL: Record<Locale, string> = {
  en: 'Verifying your link…',
  ar: 'جارٍ التحقق من الرابط…',
};

/**
 * HTML-escape a single attribute / text value. Defence-in-depth — the
 * only externally-controlled values that reach the page (`locale`,
 * `type`) are constrained to a literal allowlist via `resolveLocale`
 * / `resolveType`, and the paths are passed to the inline script
 * through `JSON.stringify`. We escape the visible label anyway so a
 * future contributor extending the route can't accidentally inject.
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildHtml(locale: Locale, successPath: string, expiredPath: string): string {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const verifying = escapeHtml(VERIFYING_LABEL[locale]);
  const success = JSON.stringify(successPath);
  const expired = JSON.stringify(expiredPath);

  // Build the document piece-by-piece. Template literals confused the TS
  // parser when the literal contained both interpolations AND bare
  // braces from the inline JS — the parser cut the string short and
  // started treating the trailing HTML as code. Plain concatenation is
  // unambiguous and a touch easier to grep for the inline JS body when
  // triaging this file later.
  const head =
    '<!DOCTYPE html>\n' +
    '<html lang="' +
    locale +
    '" dir="' +
    dir +
    '">\n' +
    '<head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta name="robots" content="noindex,nofollow">\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<title>' +
    verifying +
    '</title>\n' +
    '<style>\n' +
    'html,body{margin:0;padding:0;height:100%}\n' +
    'body{background:#002B2B;color:#F9F9F9;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}\n' +
    '.stack{display:flex;flex-direction:column;gap:1rem;align-items:center;text-align:center}\n' +
    '.spinner{width:24px;height:24px;border:2px solid rgba(249,249,249,0.3);border-top-color:#F9F9F9;border-radius:50%;animation:spin 0.8s linear infinite}\n' +
    'p{font-size:0.875rem;color:rgba(249,249,249,0.8);margin:0}\n' +
    '@keyframes spin{to{transform:rotate(360deg)}}\n' +
    '</style>\n' +
    '</head>\n' +
    '<body>\n' +
    '<main class="stack" role="status" aria-live="polite">\n' +
    '<span class="spinner" aria-hidden="true"></span>\n' +
    '<p>' +
    verifying +
    '</p>\n' +
    '</main>\n';

  const script =
    '<script>\n' +
    '(function(){\n' +
    '  var rawHash = window.location.hash;\n' +
    '  var hashRaw = rawHash.charAt(0) === "#" ? rawHash.slice(1) : rawHash;\n' +
    '  var fragment = new URLSearchParams(hashRaw);\n' +
    '  var query = new URLSearchParams(window.location.search);\n' +
    '  var fragmentError = fragment.get("error");\n' +
    '  var accessToken = fragment.get("access_token");\n' +
    '  var refreshToken = fragment.get("refresh_token");\n' +
    '  var code = query.get("code");\n' +
    '  function go(target){ window.location.replace(target); }\n' +
    '  if (fragmentError) { go(' +
    expired +
    '); return; }\n' +
    '  var body = null;\n' +
    '  if (accessToken && refreshToken) {\n' +
    '    body = { access_token: accessToken, refresh_token: refreshToken };\n' +
    '  } else if (code) {\n' +
    '    body = { code: code };\n' +
    '  }\n' +
    '  if (!body) { go(' +
    expired +
    '); return; }\n' +
    '  fetch("/api/auth/finalize-session", {\n' +
    '    method: "POST",\n' +
    '    headers: { "Content-Type": "application/json" },\n' +
    '    body: JSON.stringify(body),\n' +
    '    cache: "no-store"\n' +
    '  }).then(function(res){\n' +
    '    if (!res.ok) { go(' +
    expired +
    '); return; }\n' +
    '    go(' +
    success +
    ');\n' +
    '  }).catch(function(){ go(' +
    expired +
    '); });\n' +
    '})();\n' +
    '</script>\n';

  const tail = '</body>\n</html>\n';

  return head + script + tail;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const locale = resolveLocale(url.searchParams.get('locale'));
  const type = resolveType(url.searchParams.get('type'));

  const successPath =
    type === 'invite' ? '/' + locale + '/auth/set-password' : '/' + locale + '/auth/reset-password';
  const expiredPath =
    type === 'invite'
      ? '/' + locale + '/auth/login?error=inviteExpired'
      : '/' + locale + '/auth/forgot?error=expired';

  const html = buildHtml(locale, successPath, expiredPath);

  return new NextResponse(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // No caching — every visit carries unique URL-fragment tokens
      // that should never be cached by the browser, CDN, or any
      // intermediate proxy.
      'cache-control': 'no-store, no-cache, must-revalidate',
    },
  });
}
