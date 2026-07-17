"use client";

import { useEffect, useState } from "react";

interface User {
  id: string;
  email: string;
  role: string;
  active_role: string;
  full_name?: string | null;
  avatar_url?: string | null;
}

interface Session {
  access_token: string;
}

interface SupabaseAuthState {
  user: User | null;
  session: Session | null;
  userId: string | null;
  isLoading: boolean;
  error: Error | null;
}

const buildError = (error: unknown) => {
  if (error instanceof Error) {
    return error;
  }

  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error("Unknown authentication error");
  }
};

export function useSupabaseUser(): SupabaseAuthState {
  const [authState, setAuthState] = useState<SupabaseAuthState>({
    user: null,
    session: null,
    userId: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const resolveSession = async () => {
      try {
        const response = await fetch("/api/user/me");
        if (!response.ok) {
          throw new Error("Failed to fetch user session");
        }
        const data = await response.json();
        if (!isMounted) return;

        if (data.user) {
          setAuthState({
            user: data.user,
            session: { access_token: "dummy" } as any, // Mock Supabase Session object if needed
            userId: data.user.id,
            isLoading: false,
            error: null,
          });
        } else {
          setAuthState({
            user: null,
            session: null,
            userId: null,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        if (!isMounted) return;
        setAuthState({
          user: null,
          session: null,
          userId: null,
          isLoading: false,
          error: buildError(error),
        });
      }
    };

    void resolveSession();

    return () => {
      isMounted = false;
    };
  }, []);

  return authState;
}
