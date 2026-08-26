import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Text, TextInput, Button, Card, SegmentedButtons } from "react-native-paper";
import { router } from "expo-router";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function LoginScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAuth = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // In a real app, you'd use Convex Auth here
      // For now, we'll simulate auth and navigate to tabs
      if (mode === "signup" && !restaurantName) {
        setError("Please enter your restaurant name");
        setLoading(false);
        return;
      }

      // Navigate to main app
      router.replace("/(tabs)");
    } catch (err) {
      setError("Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.logo}>📱</Text>
          <Text style={styles.title}>QR Table Order</Text>
          <Text style={styles.subtitle}>Staff Dashboard</Text>
        </View>

        <Card style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <SegmentedButtons
              value={mode}
              onValueChange={(value) => setMode(value as "login" | "signup")}
              buttons={[
                { value: "login", label: "Sign In" },
                { value: "signup", label: "Sign Up" },
              ]}
              style={styles.segmented}
            />

            {mode === "signup" && (
              <>
                <TextInput
                  label="Your Name"
                  value={name}
                  onChangeText={setName}
                  mode="outlined"
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                />
                <TextInput
                  label="Restaurant Name"
                  value={restaurantName}
                  onChangeText={setRestaurantName}
                  mode="outlined"
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                />
              </>
            )}

            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            {error ? (
              <Text style={styles.error}>{error}</Text>
            ) : null}

            <Button
              mode="contained"
              onPress={handleAuth}
              loading={loading}
              disabled={loading}
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              {mode === "login" ? "Sign In" : "Create Account"}
            </Button>
          </Card.Content>
        </Card>

        <Text style={styles.footer}>
          QR Table Order — Restaurant Staff App
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logo: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FAFAFA",
  },
  subtitle: {
    fontSize: 16,
    color: "#A3A3A3",
    marginTop: 4,
  },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
  },
  cardContent: {
    padding: 24,
    gap: 16,
  },
  segmented: {
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#262626",
  },
  inputOutline: {
    borderColor: "#333333",
  },
  error: {
    color: "#EF4444",
    fontSize: 14,
    textAlign: "center",
  },
  button: {
    marginTop: 8,
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  footer: {
    textAlign: "center",
    color: "#525252",
    fontSize: 12,
    marginTop: 24,
  },
});
