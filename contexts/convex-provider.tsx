import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  console.warn(
    "EXPO_PUBLIC_CONVEX_URL is not set. Add it to your .env file to enable Convex."
  );
}

const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

interface ConvexClientProviderProps {
  children: ReactNode;
}

export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  if (!convex) {
    // Return children without Convex if URL is not configured
    return <>{children}</>;
  }

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
