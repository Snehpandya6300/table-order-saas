import { useState } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import { Text, Card, Button, TextInput, Switch, IconButton, Divider, FAB, Portal, Dialog, SegmentedButtons } from "react-native-paper";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function MenuScreen() {
  const [activeTab, setActiveTab] = useState<"categories" | "items">("categories");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isVeg, setIsVeg] = useState(false);

  const restaurantId = undefined as any;

  const categories = useQuery(
    api.categories.getByRestaurant,
    restaurantId ? { restaurantId } : "skip",
  );

  const menuItems = useQuery(
    api.menuItems.getByRestaurant,
    restaurantId ? { restaurantId } : "skip",
  );

  const createCategory = useMutation(api.categories.create);
  const updateCategory = useMutation(api.categories.update);
  const createItem = useMutation(api.menuItems.create);
  const updateItem = useMutation(api.menuItems.update);

  const handleAddCategory = async () => {
    if (!newName.trim() || !restaurantId) return;
    try {
      await createCategory({
        restaurantId,
        name: newName.trim(),
        sortOrder: categories?.length ?? 0,
        isVisible: true,
      });
      setNewName("");
      setShowAddDialog(false);
    } catch (err) {
      Alert.alert("Error", "Failed to create category");
    }
  };

  const handleAddItem = async () => {
    if (!newName.trim() || !newPrice || !selectedCategory || !restaurantId) return;
    try {
      await createItem({
        restaurantId,
        categoryId: selectedCategory,
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        price: parseFloat(newPrice),
        isAvailable: true,
        isVeg,
        sortOrder: menuItems?.filter((i) => i.categoryId === selectedCategory).length ?? 0,
      });
      setNewName("");
      setNewPrice("");
      setNewDescription("");
      setIsVeg(false);
      setShowAddDialog(false);
    } catch (err) {
      Alert.alert("Error", "Failed to create menu item");
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
        <Text style={styles.subtitle}>
          {categories?.length ?? 0} categories · {menuItems?.length ?? 0} items
        </Text>
      </View>

      {/* Tab Toggle */}
      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as any)}
          buttons={[
            { value: "categories", label: "Categories" },
            { value: "items", label: "Items" },
          ]}
          style={styles.segmented}
        />
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
      >
        {/* Categories Tab */}
        {activeTab === "categories" && (
          <>
            {categories?.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📁</Text>
                <Text style={styles.emptyText}>No categories yet</Text>
                <Text style={styles.emptySubtext}>
                  Create categories to organize your menu
                </Text>
              </View>
            ) : (
              categories?.map((cat) => (
                <Card key={cat._id} style={styles.card}>
                  <Card.Content style={styles.cardContent}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitle}>{cat.name}</Text>
                      <Text style={styles.cardSubtitle}>
                        {menuItems?.filter((i) => i.categoryId === cat._id).length ?? 0} items
                      </Text>
                    </View>
                    <Switch
                      value={cat.isVisible}
                      onValueChange={() =>
                        updateCategory({ id: cat._id, name: cat.name })
                      }
                      color="#3B82F6"
                    />
                  </Card.Content>
                </Card>
              ))
            )}
          </>
        )}

        {/* Items Tab */}
        {activeTab === "items" && (
          <>
            {menuItems?.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🍽️</Text>
                <Text style={styles.emptyText}>No menu items yet</Text>
                <Text style={styles.emptySubtext}>
                  Add items to your menu
                </Text>
              </View>
            ) : (
              menuItems?.map((item) => {
                const category = categories?.find((c) => c._id === item.categoryId);
                return (
                  <Card key={item._id} style={styles.card}>
                    <Card.Content style={styles.cardContent}>
                      <View style={styles.itemInfo}>
                        <View style={styles.itemHeader}>
                          <Text style={styles.cardTitle}>{item.name}</Text>
                          {item.isVeg && (
                            <Text style={styles.vegBadge}>🟢 Veg</Text>
                          )}
                        </View>
                        <Text style={styles.cardSubtitle}>
                          {category?.name ?? "Unknown"} · ${item.price.toFixed(2)}
                        </Text>
                        {item.description && (
                          <Text style={styles.itemDescription} numberOfLines={2}>
                            {item.description}
                          </Text>
                        )}
                      </View>
                      <Switch
                        value={item.isAvailable}
                        onValueChange={() =>
                          updateItem({
                            id: item._id,
                            name: item.name,
                            price: item.price,
                            isAvailable: !item.isAvailable,
                          })
                        }
                        color="#10B981"
                      />
                    </Card.Content>
                  </Card>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* FAB to Add */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setShowAddDialog(true)}
        color="#FAFAFA"
      />

      {/* Add Dialog */}
      <Portal>
        <Dialog visible={showAddDialog} onDismiss={() => setShowAddDialog(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>
            Add {activeTab === "categories" ? "Category" : "Menu Item"}
          </Dialog.Title>
          <Dialog.Content>
            {activeTab === "items" && categories && categories.length > 0 && (
              <>
                <Text style={styles.inputLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  {categories.map((cat) => (
                    <Button
                      key={cat._id}
                      mode={selectedCategory === cat._id ? "contained" : "outlined"}
                      onPress={() => setSelectedCategory(cat._id)}
                      style={styles.categoryButton}
                      compact
                    >
                      {cat.name}
                    </Button>
                  ))}
                </ScrollView>
              </>
            )}

            <TextInput
              label={activeTab === "categories" ? "Category Name" : "Item Name"}
              value={newName}
              onChangeText={setNewName}
              mode="outlined"
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            {activeTab === "items" && (
              <>
                <TextInput
                  label="Price"
                  value={newPrice}
                  onChangeText={setNewPrice}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  left={<TextInput.Affix text="$" />}
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                />
                <TextInput
                  label="Description (optional)"
                  value={newDescription}
                  onChangeText={setNewDescription}
                  mode="outlined"
                  multiline
                  numberOfLines={2}
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                />
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Vegetarian</Text>
                  <Switch value={isVeg} onValueChange={setIsVeg} color="#10B981" />
                </View>
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowAddDialog(false)} textColor="#A3A3A3">
              Cancel
            </Button>
            <Button
              onPress={activeTab === "categories" ? handleAddCategory : handleAddItem}
              mode="contained"
            >
              Add
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
  tabContainer: {
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
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FAFAFA",
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#737373",
    marginTop: 2,
  },
  itemInfo: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  vegBadge: {
    fontSize: 12,
    color: "#10B981",
  },
  itemDescription: {
    fontSize: 12,
    color: "#737373",
    marginTop: 4,
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
  inputLabel: {
    color: "#A3A3A3",
    fontSize: 13,
    marginTop: 8,
    marginBottom: 4,
  },
  categoryScroll: {
    marginBottom: 4,
  },
  categoryButton: {
    marginRight: 8,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  switchLabel: {
    color: "#FAFAFA",
    fontSize: 14,
  },
});
