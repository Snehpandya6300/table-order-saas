import { useState } from "react";
import { View, ScrollView, StyleSheet, Alert, Share } from "react-native";
import { Text, Card, Button, TextInput, Switch, IconButton, FAB, Portal, Dialog, Surface } from "react-native-paper";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function TablesScreen() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const restaurantId = undefined as any;

  const tables = useQuery(
    api.tables.getByRestaurant,
    restaurantId ? { restaurantId } : "skip",
  );

  const createTable = useMutation(api.tables.create);
  const toggleActive = useMutation(api.tables.toggleActive);
  const removeTable = useMutation(api.tables.remove);
  const regenerateQr = useMutation(api.tables.regenerateQr);

  const getQrUrl = (qrToken: string) =>
    `https://yourapp.com/q/${qrToken}`;

  const handleAddTable = async () => {
    if (!newLabel.trim() || !restaurantId) return;
    try {
      await createTable({
        restaurantId,
        label: newLabel.trim(),
      });
      setNewLabel("");
      setShowAddDialog(false);
    } catch (err) {
      Alert.alert("Error", "Failed to create table");
    }
  };

  const handleShareQr = async (qrToken: string, label: string) => {
    try {
      await Share.share({
        message: `Scan this QR code to order at ${label}: ${getQrUrl(qrToken)}`,
        title: `QR Code - ${label}`,
      });
    } catch (err) {
      // User cancelled
    }
  };

  const handleDelete = (tableId: string, label: string) => {
    Alert.alert(
      "Delete Table",
      `Are you sure you want to delete "${label}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => removeTable({ id: tableId as any }),
        },
      ],
    );
  };

  const sortedTables = tables
    ? [...tables].sort((a, b) => a.label.localeCompare(b.label))
    : [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Tables</Text>
        <Text style={styles.subtitle}>
          {tables?.length ?? 0} tables ·{" "}
          {tables?.filter((t) => t.isActive).length ?? 0} active
        </Text>
      </View>

      {/* Tables List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
      >
        {sortedTables.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🪑</Text>
            <Text style={styles.emptyText}>No tables yet</Text>
            <Text style={styles.emptySubtext}>
              Create tables and generate QR codes for ordering
            </Text>
          </View>
        ) : (
          sortedTables.map((table) => (
            <Card
              key={table._id}
              style={[
                styles.tableCard,
                !table.isActive && styles.tableCardDisabled,
              ]}
            >
              <Card.Content>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  <View style={styles.tableInfo}>
                    <Text style={styles.tableLabel}>{table.label}</Text>
                    <Text style={styles.tableStatus}>
                      {table.isActive ? "🟢 Active" : "🔴 Disabled"}
                    </Text>
                  </View>
                  <Switch
                    value={table.isActive}
                    onValueChange={() => toggleActive({ id: table._id })}
                    color="#10B981"
                  />
                </View>

                {/* QR Token */}
                <Surface style={styles.qrToken}>
                  <Text style={styles.qrTokenLabel}>QR Token:</Text>
                  <Text style={styles.qrTokenValue}>{table.qrToken}</Text>
                </Surface>

                {/* Actions */}
                <View style={styles.actions}>
                  <Button
                    mode="outlined"
                    onPress={() => handleShareQr(table.qrToken, table.label)}
                    style={styles.actionButton}
                    textColor="#3B82F6"
                    icon="share-variant"
                  >
                    Share
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() =>
                      regenerateQr({ id: table._id })
                    }
                    style={styles.actionButton}
                    textColor="#F59E0B"
                    icon="refresh"
                  >
                    Regenerate
                  </Button>
                  <IconButton
                    icon="delete-outline"
                    iconColor="#EF4444"
                    onPress={() => handleDelete(table._id, table.label)}
                  />
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setShowAddDialog(true)}
        color="#FAFAFA"
      />

      {/* Add Dialog */}
      <Portal>
        <Dialog
          visible={showAddDialog}
          onDismiss={() => setShowAddDialog(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>New Table</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Table Label"
              value={newLabel}
              onChangeText={setNewLabel}
              mode="outlined"
              placeholder="e.g. Table 1, Counter A, Patio 3"
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />
            <Text style={styles.inputHelp}>
              A unique QR code will be generated for this table.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setShowAddDialog(false)}
              textColor="#A3A3A3"
            >
              Cancel
            </Button>
            <Button
              onPress={handleAddTable}
              mode="contained"
              disabled={!newLabel.trim()}
            >
              Create
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  tableCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
  },
  tableCardDisabled: {
    opacity: 0.6,
  },
  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  tableInfo: {
    flex: 1,
  },
  tableLabel: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FAFAFA",
  },
  tableStatus: {
    fontSize: 13,
    color: "#737373",
    marginTop: 2,
  },
  qrToken: {
    backgroundColor: "#262626",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  qrTokenLabel: {
    fontSize: 13,
    color: "#A3A3A3",
  },
  qrTokenValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
    fontFamily: "monospace",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    borderColor: "#333333",
    flex: 1,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    backgroundColor: "#3B82F6",
    borderRadius: 16,
  },
  dialog: {
    backgroundColor: "#1A1A1A",
  },
  dialogTitle: {
    color: "#FAFAFA",
  },
  input: {
    marginTop: 12,
    backgroundColor: "#262626",
  },
  inputOutline: {
    borderColor: "#333333",
  },
  inputHelp: {
    fontSize: 12,
    color: "#737373",
    marginTop: 8,
  },
});
