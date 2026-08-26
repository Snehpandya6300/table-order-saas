import { useState } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import { Text, Card, Button, TextInput, Avatar, Divider, Surface, IconButton } from "react-native-paper";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function SettingsScreen() {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const restaurantId = undefined as any;

  const restaurants = useQuery(
    api.restaurants.list,
  );

  const restaurant = restaurants?.[0];

  const updateRestaurant = useMutation(api.restaurants.update);

  const handleSave = async () => {
    if (!restaurant) return;
    try {
      await updateRestaurant({
        id: restaurant._id,
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });
      setEditing(false);
    } catch (err) {
      Alert.alert("Error", "Failed to update restaurant");
    }
  };

  const startEditing = () => {
    setName(restaurant?.name ?? "");
    setDescription(restaurant?.description ?? "");
    setPhone(restaurant?.phone ?? "");
    setAddress(restaurant?.address ?? "");
    setEditing(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Restaurant Profile */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.profileHeader}>
            <Avatar.Text
              size={64}
              label={restaurant?.name?.charAt(0) ?? "R"}
              style={styles.avatar}
              labelStyle={styles.avatarLabel}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {restaurant?.name ?? "Restaurant"}
              </Text>
              <Text style={styles.profileSlug}>
                {restaurant?.slug ?? "slug"}
              </Text>
            </View>
          </View>

          <Divider style={styles.divider} />

          {editing ? (
            <>
              <TextInput
                label="Name"
                value={name}
                onChangeText={setName}
                mode="outlined"
                style={styles.input}
                outlineStyle={styles.inputOutline}
              />
              <TextInput
                label="Description"
                value={description}
                onChangeText={setDescription}
                mode="outlined"
                multiline
                numberOfLines={3}
                style={styles.input}
                outlineStyle={styles.inputOutline}
              />
              <TextInput
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                mode="outlined"
                keyboardType="phone-pad"
                style={styles.input}
                outlineStyle={styles.inputOutline}
              />
              <TextInput
                label="Address"
                value={address}
                onChangeText={setAddress}
                mode="outlined"
                multiline
                numberOfLines={2}
                style={styles.input}
                outlineStyle={styles.inputOutline}
              />
              <View style={styles.editActions}>
                <Button
                  mode="outlined"
                  onPress={() => setEditing(false)}
                  style={styles.editButton}
                  textColor="#A3A3A3"
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSave}
                  style={styles.editButton}
                >
                  Save
                </Button>
              </View>
            </>
          ) : (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Description</Text>
                <Text style={styles.infoValue}>
                  {restaurant?.description || "—"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>
                  {restaurant?.phone || "—"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>
                  {restaurant?.address || "—"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status</Text>
                <Surface
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        restaurant?.isOpen ? "#10B98120" : "#EF444420",
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: restaurant?.isOpen ? "#10B981" : "#EF4444",
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    {restaurant?.isOpen ? "Open" : "Closed"}
                  </Text>
                </Surface>
              </View>
              <Button
                mode="outlined"
                onPress={startEditing}
                style={styles.editButton}
                icon="pencil"
              >
                Edit Details
              </Button>
            </>
          )}
        </Card.Content>
      </Card>

      {/* Staff Section */}
      <Text style={styles.sectionTitle}>Staff</Text>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.emptyText}>
            Staff management coming soon
          </Text>
          <Text style={styles.emptySubtext}>
            Add team members and assign roles
          </Text>
        </Card.Content>
      </Card>

      {/* Subscription */}
      <Text style={styles.sectionTitle}>Subscription</Text>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Plan</Text>
            <Surface style={[styles.statusBadge, { backgroundColor: "#3B82F620" }]}>
              <Text style={{ color: "#3B82F6", fontSize: 12, fontWeight: "600" }}>
                {restaurant?.subscriptionStatus ?? "Trial"}
              </Text>
            </Surface>
          </View>
        </Card.Content>
      </Card>

      {/* Sign Out */}
      <Button
        mode="outlined"
        onPress={() => Alert.alert("Sign Out", "Are you sure?")}
        style={styles.signOutButton}
        textColor="#EF4444"
        icon="logout"
      >
        Sign Out
      </Button>

      <Text style={styles.footer}>
        QR Table Order v1.0.0
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FAFAFA",
  },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    marginBottom: 20,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  avatar: {
    backgroundColor: "#3B82F6",
  },
  avatarLabel: {
    fontSize: 24,
    fontWeight: "bold",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FAFAFA",
  },
  profileSlug: {
    fontSize: 14,
    color: "#737373",
    marginTop: 2,
  },
  divider: {
    backgroundColor: "#333333",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
  },
  infoLabel: {
    fontSize: 14,
    color: "#A3A3A3",
  },
  infoValue: {
    fontSize: 14,
    color: "#FAFAFA",
    flex: 1,
    textAlign: "right",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  input: {
    marginBottom: 12,
    backgroundColor: "#262626",
  },
  inputOutline: {
    borderColor: "#333333",
  },
  editActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  editButton: {
    flex: 1,
    marginTop: 12,
    borderColor: "#333333",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FAFAFA",
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: "#A3A3A3",
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 13,
    color: "#525252",
    textAlign: "center",
    marginTop: 4,
  },
  signOutButton: {
    marginTop: 20,
    borderColor: "#EF4444",
  },
  footer: {
    textAlign: "center",
    color: "#525252",
    fontSize: 12,
    marginTop: 24,
  },
});
