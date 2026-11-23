import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export interface AuthUser {
  token: string;
  username: string;
  avatarUrl?: string;
  name?: string;
}

const STORAGE_KEY_TOKEN = "devlens_session_token";
const STORAGE_KEY_USER = "devlens_user";

export function useAuth() {
  // Always initialize to null for SSR/client hydration parity (prevents React error #418)
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authHydrated, setAuthHydrated] = useState(false);

  // Hydrate auth from OAuth callback query params or localStorage after mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const username = params.get("username");
    const avatar = params.get("avatar");
    const name = params.get("name");

    if (token && username) {
      const authUser: AuthUser = {
        token,
        username,
        avatarUrl: avatar || undefined,
        name: name || undefined,
      };

      try {
        localStorage.setItem(STORAGE_KEY_TOKEN, token);
        localStorage.setItem(
          STORAGE_KEY_USER,
          JSON.stringify({ username, avatarUrl: avatar, name })
        );
      } catch {
        // storage unavailable
      }

      setUser(authUser);

      // Clean up URL parameters without triggering a router re-render or reload
      params.delete("token");
      params.delete("username");
      params.delete("avatar");
      params.delete("name");

      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "");
      window.history.replaceState({}, document.title, newUrl);
      setAuthHydrated(true);
      return;
    }

    try {
      const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
      const storedUser = localStorage.getItem(STORAGE_KEY_USER);
      if (storedToken && storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed && typeof parsed.username === "string" && parsed.username.trim()) {
          setUser({ token: storedToken, ...parsed });
        }
      }
    } catch {
      // invalid JSON or restricted storage
    }

    setAuthHydrated(true);
  }, []);

  const loginWithGitHub = useCallback(() => {
    window.location.href = api.getGitHubLoginUrl();
  }, []);

  const loginWithToken = useCallback(async (token: string) => {
    const res = await api.loginWithToken(token);
    const authUser: AuthUser = {
      token: res.api_key,
      username: res.github_username,
      avatarUrl: res.github_avatar_url || undefined,
      name: res.github_name || undefined,
    };
    localStorage.setItem(STORAGE_KEY_TOKEN, authUser.token);
    localStorage.setItem(
      STORAGE_KEY_USER,
      JSON.stringify({
        username: authUser.username,
        avatarUrl: authUser.avatarUrl,
        name: authUser.name,
      })
    );
    setUser(authUser);
    return authUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem("devlens_repo_history");
    localStorage.removeItem("devlens_dismissed_repos");
    setUser(null);
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    authHydrated,
    loginWithGitHub,
    loginWithToken,
    logout,
  };
}

