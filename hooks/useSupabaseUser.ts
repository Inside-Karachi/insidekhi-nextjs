"use client";

import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";

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
    return new Error("Unknown Supabase auth error");
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
    const supabase = createClient();

    const resolveSession = async () => {
      try {
        const [
          { data: userData, error: userError },
          { data: sessionData, error: sessionError },
        ] = await Promise.all([
          supabase.auth.getUser(),
          supabase.auth.getSession(),
        ]);

        if (!isMounted) {
          return;
        }

        if (userError) {
          throw userError;
        }

        if (sessionError && !userData.user) {
          throw sessionError;
        }

        setAuthState({
          user: userData.user ?? null,
          session: sessionData.session ?? null,
          userId: userData.user?.id ?? null,
          isLoading: false,
          error: sessionError && userData.user ? buildError(sessionError) : null,
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

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

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMounted) {
          return;
        }

        if (!session) {
          setAuthState({
            user: null,
            session: null,
            userId: null,
            isLoading: false,
            error: null,
          });
          return;
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (!isMounted) {
          return;
        }

        if (userError || !userData.user) {
          setAuthState({
            user: null,
            session: null,
            userId: null,
            isLoading: false,
            error: userError ? buildError(userError) : null,
          });
          return;
        }

        setAuthState({
          user: userData.user,
          session,
          userId: userData.user.id,
          isLoading: false,
          error: null,
        });
      },
    );

    return () => {
      isMounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  return authState;
}
