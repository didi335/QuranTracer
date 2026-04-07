/* ─────────────────────────────────────────────────────────────
   OAuth2 PKCE helpers for Quran Foundation
   ───────────────────────────────────────────────────────────── */

const CLIENT_ID    = import.meta.env.VITE_QURAN_OAUTH_CLIENT_ID as string;
const OAUTH_BASE   = import.meta.env.VITE_QURAN_OAUTH_ENDPOINT  as string;
const SCOPES       = "openid offline";

export interface AuthUser {
  sub:   string;
  email?: string;
  name?:  string;
}

export interface TokenSet {
  access_token:  string;
  refresh_token: string;
  expires_at:    number; // epoch ms
  user:          AuthUser;
}

const TOKEN_KEY    = "qf_token_set";
const VERIFIER_KEY = "qf_pkce_verifier";
const STATE_KEY    = "qf_pkce_state";

/* ── PKCE helpers ──────────────────────────────────────────── */
function random(len = 48): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function sha256b64(str: string): Promise<string> {
  const buf  = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/* ── Token storage ─────────────────────────────────────────── */
export function getTokenSet(): TokenSet | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveTokenSet(ts: TokenSet) {
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(ts));
}

export function clearTokenSet() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
}

export function isLoggedIn(): boolean {
  const ts = getTokenSet();
  return !!ts && ts.expires_at > Date.now() + 30_000;
}

/* ── Initiate login ────────────────────────────────────────── */
export async function startLogin(): Promise<void> {
  const verifier   = random(48);
  const challenge  = await sha256b64(verifier);
  const state      = random(16);
  const redirectUri = getRedirectUri();

  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY,    state);

  const params = new URLSearchParams({
    response_type:         "code",
    client_id:             CLIENT_ID,
    redirect_uri:          redirectUri,
    scope:                 SCOPES,
    state,
    code_challenge:        challenge,
    code_challenge_method: "S256",
  });

  window.location.href = `${OAUTH_BASE}/oauth2/auth?${params}`;
}

/* ── Handle callback ───────────────────────────────────────── */
export async function handleCallback(code: string, state: string): Promise<TokenSet | null> {
  const savedState    = sessionStorage.getItem(STATE_KEY);
  const codeVerifier  = sessionStorage.getItem(VERIFIER_KEY);
  const redirectUri   = getRedirectUri();

  if (!codeVerifier || state !== savedState) return null;

  const body = new URLSearchParams({
    grant_type:    "authorization_code",
    client_id:     CLIENT_ID,
    code,
    redirect_uri:  redirectUri,
    code_verifier: codeVerifier,
  });

  const res = await fetch(`${OAUTH_BASE}/oauth2/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) return null;
  const data = await res.json();

  // Decode user info from id_token or fetch from userinfo
  let user: AuthUser = { sub: "unknown" };
  try {
    if (data.access_token) {
      const uRes = await fetch(`${OAUTH_BASE}/userinfo`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (uRes.ok) user = await uRes.json();
    }
  } catch { /* ok */ }

  const ts: TokenSet = {
    access_token:  data.access_token,
    refresh_token: data.refresh_token ?? "",
    expires_at:    Date.now() + data.expires_in * 1000,
    user,
  };
  saveTokenSet(ts);
  return ts;
}

/* ── Refresh ───────────────────────────────────────────────── */
export async function refreshToken(): Promise<TokenSet | null> {
  const ts = getTokenSet();
  if (!ts?.refresh_token) return null;

  const body = new URLSearchParams({
    grant_type:    "refresh_token",
    client_id:     CLIENT_ID,
    refresh_token: ts.refresh_token,
  });

  const res = await fetch(`${OAUTH_BASE}/oauth2/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) { clearTokenSet(); return null; }
  const data = await res.json();

  const next: TokenSet = {
    ...ts,
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? ts.refresh_token,
    expires_at:    Date.now() + data.expires_in * 1000,
  };
  saveTokenSet(next);
  return next;
}

export function logout() {
  const ts = getTokenSet();
  clearTokenSet();
  if (ts?.access_token) {
    const params = new URLSearchParams({
      client_id:              CLIENT_ID,
      post_logout_redirect_uri: getRedirectUri(),
    });
    window.location.href = `${OAUTH_BASE}/oauth2/sessions/logout?${params}`;
  } else {
    window.location.reload();
  }
}

function getRedirectUri(): string {
  return `${window.location.origin}${window.location.pathname.replace(/\/$/, "")}/`;
}
