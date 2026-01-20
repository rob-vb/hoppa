import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface User {
  id: string;
  email: string;
  name?: string;
  isPremium: boolean;
  createdAt: number;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  loadSession: () => Promise<void>;
}

type AuthStore = AuthState & AuthActions;

const AUTH_TOKEN_KEY = 'auth_token';
const USER_DATA_KEY = 'user_data';

async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  signIn: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      // TODO: Replace with actual API call to Convex Auth
      // For now, simulate a successful sign-in for development
      const user: User = {
        id: `user_${Date.now()}`,
        email,
        name: email.split('@')[0],
        isPremium: false,
        createdAt: Date.now(),
      };

      const token = `token_${Date.now()}`;
      await setSecureItem(AUTH_TOKEN_KEY, token);
      await setSecureItem(USER_DATA_KEY, JSON.stringify(user));

      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signUp: async (email: string, password: string, name?: string) => {
    set({ isLoading: true });
    try {
      // TODO: Replace with actual API call to Convex Auth
      // For now, simulate a successful sign-up for development
      const user: User = {
        id: `user_${Date.now()}`,
        email,
        name: name ?? email.split('@')[0],
        isPremium: false,
        createdAt: Date.now(),
      };

      const token = `token_${Date.now()}`;
      await setSecureItem(AUTH_TOKEN_KEY, token);
      await setSecureItem(USER_DATA_KEY, JSON.stringify(user));

      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      await deleteSecureItem(AUTH_TOKEN_KEY);
      await deleteSecureItem(USER_DATA_KEY);
      set({ user: null, isAuthenticated: false, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  loadSession: async () => {
    set({ isLoading: true });
    try {
      const token = await getSecureItem(AUTH_TOKEN_KEY);
      const userData = await getSecureItem(USER_DATA_KEY);

      if (token && userData) {
        const user = JSON.parse(userData) as User;
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
