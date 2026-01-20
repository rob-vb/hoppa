import React, { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuthStore, type User } from '@/stores/auth-store';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { signIn: convexSignIn, signOut: convexSignOut } = useAuthActions();
  const { isAuthenticated: isConvexAuthenticated, isLoading: isConvexLoading } = useConvexAuth();

  // Only fetch user data when authenticated (skip query when not authenticated)
  const convexUser = useQuery(
    api.users.currentUser,
    isConvexAuthenticated ? undefined : "skip"
  );

  const { user, isLoading, isAuthenticated, error, setUser, setLoading, setError, clearError, reset } =
    useAuthStore();

  // Sync Convex auth state with Zustand store
  useEffect(() => {
    // If Convex is still checking stored credentials, stay in loading state
    if (isConvexLoading) {
      setLoading(true);
      return;
    }

    // If not authenticated, clear user and exit loading
    if (!isConvexAuthenticated) {
      setUser(null);
      return;
    }

    // Authenticated - wait for user data to load
    if (convexUser === undefined) {
      // User query still loading, but we're authenticated
      setLoading(true);
      return;
    }

    // User data loaded
    setUser(convexUser);
  }, [isConvexLoading, isConvexAuthenticated, convexUser, setUser, setLoading]);

  const signIn = async (email: string, password: string) => {
    try {
      clearError();
      await convexSignIn("password", { email, password, flow: "signIn" });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      throw err;
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      clearError();
      const params: { email: string; password: string; name?: string; flow: "signUp" } = {
        email,
        password,
        flow: "signUp",
      };
      if (name) {
        params.name = name;
      }
      await convexSignIn("password", params);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
      throw err;
    }
  };

  const signInWithGoogle = async () => {
    try {
      clearError();
      await convexSignIn("google");
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google');
      throw err;
    }
  };

  const signInWithApple = async () => {
    try {
      clearError();
      await convexSignIn("apple");
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Apple');
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await convexSignOut();
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign out');
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        error,
        signIn,
        signUp,
        signInWithGoogle,
        signInWithApple,
        signOut,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
