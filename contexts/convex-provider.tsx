import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ReactNode, createContext, useContext } from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  console.warn(
    "EXPO_PUBLIC_CONVEX_URL is not set. Add it to your .env file to enable Convex."
  );
}

const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

// Export the client for sync engine use
export function getConvexClient(): ConvexReactClient | null {
  return convex;
}

// Context for accessing the Convex client in components
const ConvexClientContext = createContext<ConvexReactClient | null>(null);

export function useConvexClient(): ConvexReactClient | null {
  return useContext(ConvexClientContext);
}

// Cross-platform secure storage for auth tokens
const secureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

interface ConvexClientProviderProps {
  children: ReactNode;
}

export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  if (!convex) {
    // Return children without Convex if URL is not configured
    return <>{children}</>;
  }

  return (
    <ConvexAuthProvider client={convex} storage={secureStorage}>
      <ConvexClientContext.Provider value={convex}>
        {children}
      </ConvexClientContext.Provider>
    </ConvexAuthProvider>
  );
}
