import React, { createContext, useContext, type ReactNode } from 'react';
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { User } from '@/stores/auth-store';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { signIn: convexSignIn, signOut: convexSignOut } = useAuthActions();
  const user = useQuery(api.users.currentUser);

  const isLoading = user === undefined;
  const isAuthenticated = user !== null && user !== undefined;

  const signIn = async (email: string, password: string) => {
    await convexSignIn("password", { email, password, flow: "signIn" });
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const params: { email: string; password: string; name?: string; flow: "signUp" } = {
      email,
      password,
      flow: "signUp",
    };
    if (name) {
      params.name = name;
    }
    await convexSignIn("password", params);
  };

  const signInWithGoogle = async () => {
    await convexSignIn("google");
  };

  const signOut = async () => {
    await convexSignOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        isAuthenticated,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
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
