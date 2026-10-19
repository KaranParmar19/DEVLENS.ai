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
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    const storedUser = localStorage.getItem(STORAGE_KEY_USER);
    if (token && storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed && typeof parsed.username === "string" && parsed.username.trim()) {
          return { token, ...parsed };
        }
      } catch {
        // invalid JSON
      }
    }
    return null;
  });

  // Catch OAuth redirect callback parameters (?token=...&username=...)
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

      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      localStorage.setItem(
        STORAGE_KEY_USER,
        JSON.stringify({ username, avatarUrl: avatar, name })
      );

      setUser(authUser);

      // Clean up URL parameters without triggering a router re-render or reload
      params.delete("token");
      params.delete("username");
      params.delete("avatar");
      params.delete("name");

      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "");
      window.history.replaceState({}, document.title, newUrl);
    }
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
    setUser(null);
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    loginWithGitHub,
    loginWithToken,
    logout,
  };
}

