import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  apiRequest,
  setAuthToken,
  setUnauthorizedHandler,
} from "@/api/client";
import type { PublicUser } from "@/api/types";
import { deleteToken, getToken, saveToken } from "@/lib/tokenStorage";

const TOKEN_KEY = "session_token";

interface AuthResponse {
  user: PublicUser;
  token: string;
}

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean; // true while restoring the session on startup
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore a saved token on startup and verify it with the backend.
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken(TOKEN_KEY);
        if (token) {
          setAuthToken(token);
          const { user: me } = await apiRequest<{ user: PublicUser | null }>(
            "/api/auth/me",
          );
          if (me) {
            setUser(me);
          } else {
            // Token invalid/expired — clear it.
            setAuthToken(null);
            await deleteToken(TOKEN_KEY);
          }
        }
      } catch {
        // Offline or bad token — start logged out.
        setAuthToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // If a request reports the session is no longer valid, clear it locally.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuthToken(null);
      void deleteToken(TOKEN_KEY);
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const persist = useCallback(async (res: AuthResponse) => {
    setAuthToken(res.token);
    await saveToken(TOKEN_KEY, res.token);
    setUser(res.user);
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await apiRequest<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: { username, password },
      });
      await persist(res);
    },
    [persist],
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors on logout — clear locally regardless.
    }
    setAuthToken(null);
    await deleteToken(TOKEN_KEY);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
