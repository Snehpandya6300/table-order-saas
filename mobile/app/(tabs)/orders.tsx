import { useState } from "react";
import { View, ScrollView, StyleSheet, RefreshControl, Alert } from "react-native";
import { Text, Card, Button, Chip, Surface, IconButton, Divider, SegmentedButtons } from "react-native-paper";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

const STATUS_CONFIG = {
  received: { label: "Received", color: "#3B82F6", icon: "bell-outline" },
  accepted: { label: "Accepted", color: "#6366F1", icon: "check-circle-outline" },
  preparing: { label: "Preparing", color: "#F59E0B", icon: "chef-hat" },
  ready: { label: "Ready", color: "#10B981", icon: "check-all" },
  served: { label: "Served", color: "#6B7280", icon: "check" },
  cancelled: { label: "Cancelled", color: "#EF4444", icon: "close-circle" },
} as const;

const STATUS_FLOW = ["received", "accepted", "preparing", "ready", "served"] as const;

export default function OrdersScreen() {
  const [filter, setFilter] = useState<"active" | "all" | "completed">("active");
  const [refreshing, setRefreshing] = useState(false);

  const restaurantId = undefined as any;

  const orders = useQuery(
    api.orders.getByRestaurant,
    restaurantId ? { restaurantId } : "skip",
  );

  const updateStatus = useMutation(api.orders.updateStatus);
  const updatePayment = useMutation(api.orders.updatePayment);

  const filteredOrders = orders?.filter((order) => {
    if (filter === "active") {
      return ["received", "accepted", "preparing", "ready"].includes(order.status);
    }
    if (filter === "completed") {
      return order.status === "served" || order.status === "cancelled";
    }
    return true;
  });

  const handleNextStatus = async (orderId: string, currentStatus: string) => {
    const currentIndex = STATUS_FLOW.indexOf(currentStatus as any);
    if (currentIndex < 0 || currentIndex >= STATUS_FLOW.length - 1) return;

    const nextStatus = STATUS_FLOW[currentIndex + 1];
    try {
      await updateStatus({ id: orderId as any, status: nextStatus });
    } catch (err) {
      Alert.alert("Error", "Failed to update order status");
    }
  };

  const handleMarkPaid = async (orderId: string, method: "cash" | "upi" | "card") => {
    try {
      await updatePayment({
        id: orderId as any,
        paymentStatus: "paid",
        paymentMethod: method,
      });
    } catch (err) {
      Alert.alert("Error", "Failed to update payment");
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.subtitle}>
          {filteredOrders?.length ?? 0} orders
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={filter}
          onValueChange={(value) => setFilter(value as any)}
          buttons={[
            { value: "active", label: "Active" },
            { value: "all", label: "All" },
            { value: "completed", label: "Completed" },
          ]}
          style={styles.segmented}
        />
      </View>

      {/* Orders List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredOrders?.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No orders yet</Text>
            <Text style={styles.emptySubtext}>
              Orders will appear here in real-time
            </Text>
          </View>
        ) : (
          filteredOrders?.map((order) => {
            const statusConfig = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG];
            const currentStatusIndex = STATUS_FLOW.indexOf(order.status as any);
            const nextStatus = currentStatusIndex >= 0 && currentStatusIndex < STATUS_FLOW.length - 1
              ? STATUS_FLOW[currentStatusIndex + 1]
              : null;

            return (
              <Card key={order._id} style={styles.orderCard}>
                <Card.Content>
                  {/* Order Header */}
                  <View style={styles.orderHeader}>
                    <View style={styles.orderInfo}>
                      <Text style={styles.orderTable}>
                        {order.tableLabel ?? `Order #${order._id.slice(-6)}`}
                      </Text>
                      <Text style={styles.orderTime}>
                        {new Date(order.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                    <Chip
                      style={[styles.statusChip, { backgroundColor: statusConfig?.color + "20" }]}
                      textStyle={{ color: statusConfig?.color, fontSize: 11 }}
                    >
                      {statusConfig?.label}
                    </Chip>
                  </View>

                  {/* Order Items */}
                  <View style={styles.itemsList}>
                    {order.items.map((item, idx) => (
                      <View key={idx} style={styles.itemRow}>
                        <Text style={styles.itemQty}>{item.quantity}×</Text>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemPrice}>
                          ${(item.price * item.quantity).toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Customer Note */}
                  {order.customerName && (
                    <Text style={styles.customerNote}>
                      👤 {order.customerName}
                    </Text>
                  )}

                  <Divider style={styles.divider} />

                  {/* Total */}
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>
                      ${order.totalAmount.toFixed(2)}
                    </Text>
                  </View>

                  {/* Payment Status */}
                  <View style={styles.paymentRow}>
                    <Chip
                      style={[
                        styles.paymentChip,
                        {
                          backgroundColor:
                            order.paymentStatus === "paid"
                              ? "#10B98120"
                              : order.paymentStatus === "refunded"
                                ? "#F59E0B20"
                                : "#EF444420",
                        },
                      ]}
                      textStyle={{
                        color:
                          order.paymentStatus === "paid"
                            ? "#10B981"
                            : order.paymentStatus === "refunded"
                              ? "#F59E0B"
                              : "#EF4444",
                        fontSize: 11,
                      }}
                    >
                      {order.paymentStatus === "paid"
                        ? `Paid (${order.paymentMethod ?? ""})`
                        : order.paymentStatus === "refunded"
                          ? "Refunded"
                          : "Unpaid"}
                    </Chip>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actions}>
                    {nextStatus && (
                      <Button
                        mode="contained"
                        onPress={() => handleNextStatus(order._id, order.status)}
                        style={[styles.actionButton, { backgroundColor: STATUS_CONFIG[nextStatus]?.color }]}
                        contentStyle={styles.buttonContent}
                      >
                        Mark {STATUS_CONFIG[nextStatus]?.label}
                      </Button>
                    )}

                    {order.paymentStatus === "unpaid" && (
                      <View style={styles.paymentButtons}>
                        <Button
                          mode="outlined"
                          onPress={() => handleMarkPaid(order._id, "cash")}
                          style={styles.payButton}
                          textColor="#10B981"
                        >
                          💵 Cash
                        </Button>
                        <Button
                          mode="outlined"
                          onPress={() => handleMarkPaid(order._id, "upi")}
                          style={styles.payButton}
                          textColor="#3B82F6"
                        >
                          📱 UPI
                        </Button>
                        <Button
                          mode="outlined"
                          onPress={() => handleMarkPaid(order._id, "card")}
                          style={styles.payButton}
                          textColor="#8B5CF6"
                        >
                          💳 Card
                        </Button>
                      </View>
                    )}
                  </View>
                </Card.Content>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FAFAFA",
  },
  subtitle: {
    fontSize: 14,
    color: "#A3A3A3",
    marginTop: 4,
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  segmented: {
    backgroundColor: "#1A1A1A",
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    gap: 12,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FAFAFA",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#737373",
    marginTop: 4,
  },
  orderCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderTable: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FAFAFA",
  },
  orderTime: {
    fontSize: 12,
    color: "#737373",
    marginTop: 2,
  },
  statusChip: {
    height: 28,
  },
  itemsList: {
    gap: 6,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemQty: {
    fontSize: 14,
    color: "#A3A3A3",
    width: 30,
  },
  itemName: {
    fontSize: 14,
    color: "#FAFAFA",
    flex: 1,
  },
  itemPrice: {
    fontSize: 14,
    color: "#A3A3A3",
    fontWeight: "500",
  },
  customerNote: {
    fontSize: 13,
    color: "#737373",
    marginBottom: 8,
  },
  divider: {
    backgroundColor: "#333333",
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FAFAFA",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FAFAFA",
  },
  paymentRow: {
    marginBottom: 12,
  },
  paymentChip: {
    height: 28,
    alignSelf: "flex-start",
  },
  actions: {
    gap: 8,
  },
  actionButton: {
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 4,
  },
  paymentButtons: {
    flexDirection: "row",
    gap: 8,
  },
  payButton: {
    flex: 1,
    borderColor: "#333333",
  },
});
