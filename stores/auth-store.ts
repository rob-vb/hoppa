import { create } from 'zustand';
import { Id } from '@/convex/_generated/dataModel';

export type UserType = 'client' | 'trainer';

export interface User {
  _id: Id<'users'>;
  email?: string;
  name?: string;
  image?: string;
  userType?: UserType;
}

export interface TrainerProfile {
  _id: Id<'trainers'>;
  userId: Id<'users'>;
  businessName?: string;
  bio?: string;
  qualifications?: string[];
  specialties?: string[];
  stripeOnboarded: boolean;
  subscriptionTier: 'starter' | 'pro' | 'studio';
  subscriptionStatus: 'active' | 'past_due' | 'canceled' | 'trialing';
  maxClients: number;
}

interface AuthState {
  user: User | null;
  trainerProfile: TrainerProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isTrainer: boolean;
  error: string | null;
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setTrainerProfile: (profile: TrainerProfile | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  trainerProfile: null,
  isLoading: true,
  isAuthenticated: false,
  isTrainer: false,
  error: null,
};

export const useAuthStore = create<AuthStore>((set) => ({
  ...initialState,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: user !== null,
      isTrainer: user?.userType === 'trainer',
      isLoading: false,
    }),

  setTrainerProfile: (trainerProfile) =>
    set({
      trainerProfile,
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}));
