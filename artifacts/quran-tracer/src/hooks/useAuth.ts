import { useState, useEffect, useCallback } from "react";
import {
  getTokenSet, handleCallback, isLoggedIn,
  startLogin, logout as doLogout, refreshToken,
  TokenSet,
} from "@/services/auth";

export interface AuthState {
  tokenSet:  TokenSet | null;
  loggedIn:  boolean;
  loading:   boolean;
  login:     () => void;
  logout:    () => void;
}

export function useAuth(): AuthState {
  const [tokenSet, setTokenSet] = useState<TokenSet | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function init() {
      // Handle OAuth callback (code + state in URL)
      const params = new URLSearchParams(window.location.search);
      const code   = params.get("code");
      const state  = params.get("state");

      if (code && state) {
        // Clean URL immediately so refresh doesn't re-process
        window.history.replaceState({}, "", window.location.pathname);
        const ts = await handleCallback(code, state);
        setTokenSet(ts);
        setLoading(false);
        return;
      }

      // Check for existing valid session
      if (isLoggedIn()) {
        setTokenSet(getTokenSet());
        setLoading(false);
        return;
      }

      // Attempt silent refresh if we have a token set (even expired)
      const existing = getTokenSet();
      if (existing?.refresh_token) {
        const refreshed = await refreshToken();
        setTokenSet(refreshed);
      }

      setLoading(false);
    }
    init();
  }, []);

  // Auto-refresh 5 min before expiry
  useEffect(() => {
    if (!tokenSet) return;
    const msUntilExpiry = tokenSet.expires_at - Date.now() - 5 * 60 * 1000;
    if (msUntilExpiry <= 0) return;
    const id = setTimeout(async () => {
      const next = await refreshToken();
      setTokenSet(next);
    }, msUntilExpiry);
    return () => clearTimeout(id);
  }, [tokenSet]);

  const login  = useCallback(() => startLogin(), []);
  const logout = useCallback(() => doLogout(), []);

  return {
    tokenSet,
    loggedIn: !!tokenSet && isLoggedIn(),
    loading,
    login,
    logout,
  };
}
