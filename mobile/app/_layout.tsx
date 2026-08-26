import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PaperProvider, MD3DarkTheme } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { convex } from "../lib/convex";

const theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: "#3B82F6",
    secondary: "#10B981",
    background: "#0A0A0A",
    surface: "#1A1A1A",
    surfaceVariant: "#262626",
    onBackground: "#FAFAFA",
    onSurface: "#FAFAFA",
    onSurfaceVariant: "#A3A3A3",
    outline: "#333333",
    error: "#EF4444",
  },
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#0A0A0A" },
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
        <StatusBar style="light" />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
