import { View, StyleSheet } from "react-native";
import { Text, Button } from "react-native-paper";
import { router } from "expo-router";

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🔍</Text>
      <Text style={styles.title}>Page Not Found</Text>
      <Text style={styles.subtitle}>
        The page you're looking for doesn't exist.
      </Text>
      <Button
        mode="contained"
        onPress={() => router.replace("/")}
        style={styles.button}
      >
        Go Home
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FAFAFA",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#737373",
    textAlign: "center",
    marginBottom: 24,
  },
  button: {
    borderRadius: 12,
  },
});
