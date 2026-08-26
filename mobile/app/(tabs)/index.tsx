import { View, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { Text, Card, Surface, Icon } from "react-native-paper";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function DashboardScreen() {
  // In a real app, get restaurantId from auth context
  const restaurantId = undefined as any;

  const stats = useQuery(
    api.orders.getStats,
    restaurantId ? { restaurantId } : "skip",
  );

  const onRefresh = () => {
    // Trigger re-fetch by invalidating queries
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Good morning 👋</Text>
        <Text style={styles.restaurantName}>Your Restaurant</Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <Surface style={[styles.statCard, { borderLeftColor: "#3B82F6" }]}>
          <Icon source="receipt" size={24} color="#3B82F6" />
          <Text style={styles.statValue}>{stats?.todayOrders ?? 0}</Text>
          <Text style={styles.statLabel}>Today's Orders</Text>
        </Surface>

        <Surface style={[styles.statCard, { borderLeftColor: "#10B981" }]}>
          <Icon source="cash" size={24} color="#10B981" />
          <Text style={styles.statValue}>
            ${stats?.todayRevenue?.toFixed(2) ?? "0.00"}
          </Text>
          <Text style={styles.statLabel}>Today's Revenue</Text>
        </Surface>

        <Surface style={[styles.statCard, { borderLeftColor: "#F59E0B" }]}>
          <Icon source="clock-outline" size={24} color="#F59E0B" />
          <Text style={styles.statValue}>{stats?.pendingOrders ?? 0}</Text>
          <Text style={styles.statLabel}>Pending Orders</Text>
        </Surface>

        <Surface style={[styles.statCard, { borderLeftColor: "#8B5CF6" }]}>
          <Icon source="chart-line" size={24} color="#8B5CF6" />
          <Text style={styles.statValue}>{stats?.totalOrders ?? 0}</Text>
          <Text style={styles.statLabel}>Total Orders</Text>
        </Surface>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        <Surface style={styles.actionCard}>
          <Icon source="receipt" size={32} color="#3B82F6" />
          <Text style={styles.actionLabel}>View Orders</Text>
        </Surface>
        <Surface style={styles.actionCard}>
          <Icon source="plus-circle" size={32} color="#10B981" />
          <Text style={styles.actionLabel}>Add Menu Item</Text>
        </Surface>
        <Surface style={styles.actionCard}>
          <Icon source="qrcode" size={32} color="#F59E0B" />
          <Text style={styles.actionLabel}>Generate QR</Text>
        </Surface>
        <Surface style={styles.actionCard}>
          <Icon source="account-group" size={32} color="#8B5CF6" />
          <Text style={styles.actionLabel}>Manage Staff</Text>
        </Surface>
      </View>

      {/* Recent Activity */}
      <Text style={styles.sectionTitle}>Recent Activity</Text>
      <Card style={styles.activityCard}>
        <Card.Content>
          <Text style={styles.emptyText}>No recent activity</Text>
          <Text style={styles.emptySubtext}>
            Orders will appear here as they come in
          </Text>
        </Card.Content>
      </Card>
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
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: "#A3A3A3",
  },
  restaurantName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FAFAFA",
    marginTop: 4,
  },
  statsGrid: {
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FAFAFA",
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: "#A3A3A3",
    position: "absolute",
    right: 16,
    top: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FAFAFA",
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 20,
    width: "47%",
    alignItems: "center",
    gap: 8,
  },
  actionLabel: {
    fontSize: 13,
    color: "#FAFAFA",
    fontWeight: "500",
  },
  activityCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
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
});
