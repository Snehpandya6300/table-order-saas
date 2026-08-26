import { ConvexReactClient } from "convex/react";
import Constants from "expo-constants";

const convexUrl = Constants.expoConfig?.extra?.convexUrl as string;

if (!convexUrl) {
  throw new Error(
    "Missing EXPO_PUBLIC_CONVEX_URL. Set it in your .env or app.json extra.",
  );
}

export const convex = new ConvexReactClient(convexUrl);
