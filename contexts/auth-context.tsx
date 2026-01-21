import React, { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery, useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuthStore, type User, type TrainerProfile } from '@/stores/auth-store';

type TierType = 'starter' | 'pro' | 'studio';

interface RegisterResult {
  trainerId: string;
  requiresPayment: boolean;
  tier: TierType;
}

interface AuthContextValue {
  user: User | null;
  trainerProfile: TrainerProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isTrainer: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signUpAsTrainer: (email: string, password: string, name: string, businessName?: string, selectedTier?: TierType) => Promise<RegisterResult>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  registerAsTrainer: (businessName?: string, bio?: string, selectedTier?: TierType) => Promise<RegisterResult>;
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

  // Fetch trainer profile if user is a trainer
  const convexTrainerProfile = useQuery(
    api.trainers.currentTrainer,
    isConvexAuthenticated ? undefined : "skip"
  );

  // Mutation to register as trainer
  const registerTrainerMutation = useMutation(api.trainers.register);

  const {
    user,
    trainerProfile,
    isLoading,
    isAuthenticated,
    isTrainer,
    error,
    setUser,
    setTrainerProfile,
    setLoading,
    setError,
    clearError,
    reset
  } = useAuthStore();

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
      setTrainerProfile(null);
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
  }, [isConvexLoading, isConvexAuthenticated, convexUser, setUser, setTrainerProfile, setLoading]);

  // Sync trainer profile when user is a trainer
  useEffect(() => {
    if (convexTrainerProfile !== undefined) {
      setTrainerProfile(convexTrainerProfile);
    }
  }, [convexTrainerProfile, setTrainerProfile]);

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

  // Sign up as a trainer - creates user and registers as trainer
  const signUpAsTrainer = async (email: string, password: string, name: string, businessName?: string, selectedTier?: TierType): Promise<RegisterResult> => {
    try {
      clearError();
      // First, sign up the user
      await convexSignIn("password", { email, password, name, flow: "signUp" });
      // Register as trainer with selected tier
      const result = await registerTrainerMutation({
        businessName: businessName || undefined,
        selectedTier: selectedTier || "starter",
      });
      return result as RegisterResult;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up as trainer');
      throw err;
    }
  };

  // Register an existing authenticated user as a trainer
  const registerAsTrainer = async (businessName?: string, bio?: string, selectedTier?: TierType): Promise<RegisterResult> => {
    try {
      clearError();
      const result = await registerTrainerMutation({
        businessName,
        bio,
        selectedTier: selectedTier || "starter",
      });
      return result as RegisterResult;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register as trainer');
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        trainerProfile,
        isLoading,
        isAuthenticated,
        isTrainer,
        error,
        signIn,
        signUp,
        signUpAsTrainer,
        signInWithGoogle,
        signInWithApple,
        signOut,
        clearError,
        registerAsTrainer,
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
