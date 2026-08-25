import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Tag,
  Leaf,
  ToggleLeft,
  ToggleRight,
  X,
  Image,
} from "lucide-react";

export function MenuManager({
  restaurantId,
}: {
  restaurantId: Id<"restaurants">;
}) {
  const categories = useQuery(api.categories.getByRestaurant, {
    restaurantId,
  });
  const menuItems = useQuery(api.menuItems.getByRestaurant, { restaurantId });
  const createCategory = useMutation(api.categories.create);
  const updateCategory = useMutation(api.categories.update);
  const deleteCategory = useMutation(api.categories.remove);
  const createItem = useMutation(api.menuItems.create);
  const updateItem = useMutation(api.menuItems.update);
  const deleteItem = useMutation(api.menuItems.remove);

  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Id<"categories"> | null>(null);
  const [categoryName, setCategoryName] = useState("");

  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<Id<"menuItems"> | null>(null);
  const [itemForm, setItemForm] = useState({
    name: "",
    description: "",
    price: "",
    categoryId: "" as string,
    imageUrl: "",
    isVeg: false,
  });

  if (!categories || !menuItems) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading menu...
      </div>
    );
  }

  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  const openAddCategory = () => {
    setEditingCategory(null);
    setCategoryName("");
    setShowCategoryDialog(true);
  };

  const openEditCategory = (cat: (typeof categories)[0]) => {
    setEditingCategory(cat._id);
    setCategoryName(cat.name);
    setShowCategoryDialog(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) return;
    if (editingCategory) {
      await updateCategory({ id: editingCategory, name: categoryName.trim() });
    } else {
      await createCategory({
        restaurantId,
        name: categoryName.trim(),
        sortOrder: categories.length,
      });
    }
    setShowCategoryDialog(false);
  };

  const openAddItem = (categoryId?: string) => {
    setEditingItem(null);
    setItemForm({
      name: "",
      description: "",
      price: "",
      categoryId: categoryId ?? (sortedCategories[0]?._id ?? ""),
      imageUrl: "",
      isVeg: false,
    });
    setShowItemDialog(true);
  };

  const openEditItem = (item: (typeof menuItems)[0]) => {
    setEditingItem(item._id);
    setItemForm({
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      categoryId: item.categoryId,
      imageUrl: item.imageUrl ?? "",
      isVeg: item.isVeg,
    });
    setShowItemDialog(true);
  };

  const handleSaveItem = async () => {
    if (!itemForm.name.trim() || !itemForm.price || !itemForm.categoryId) return;
    const price = parseFloat(itemForm.price);
    if (isNaN(price) || price < 0) return;

    if (editingItem) {
      await updateItem({
        id: editingItem,
        name: itemForm.name.trim(),
        description: itemForm.description.trim() || undefined,
        price,
        categoryId: itemForm.categoryId as Id<"categories">,
        imageUrl: itemForm.imageUrl.trim() || undefined,
        isVeg: itemForm.isVeg,
      });
    } else {
      const catItems = menuItems.filter(
        (i) => i.categoryId === itemForm.categoryId,
      );
      await createItem({
        restaurantId,
        categoryId: itemForm.categoryId as Id<"categories">,
        name: itemForm.name.trim(),
        description: itemForm.description.trim() || undefined,
        price,
        imageUrl: itemForm.imageUrl.trim() || undefined,
        isVeg: itemForm.isVeg,
        sortOrder: catItems.length,
      });
    }
    setShowItemDialog(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Menu</h2>
          <p className="text-sm text-muted-foreground">
            Manage your categories and menu items.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={openAddCategory}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Category
          </Button>
          <Button
            size="sm"
            className="cursor-pointer"
            onClick={() => openAddItem()}
            disabled={categories.length === 0}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Item
          </Button>
        </div>
      </div>

      {sortedCategories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Tag className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No categories yet. Add a category to start building your menu.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedCategories.map((cat) => {
            const catItems = menuItems
              .filter((i) => i.categoryId === cat._id)
              .sort((a, b) => a.sortOrder - b.sortOrder);

            return (
              <Card key={cat._id} className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 px-4">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-semibold">
                      {cat.name}
                    </CardTitle>
                    {!cat.isVisible && (
                      <Badge variant="secondary" className="text-[10px]">
                        Hidden
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {catItems.length} item{catItems.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer h-7 w-7 p-0"
                      onClick={() =>
                        updateCategory({
                          id: cat._id,
                          isVisible: !cat.isVisible,
                        })
                      }
                      title={cat.isVisible ? "Hide category" : "Show category"}
                    >
                      {cat.isVisible ? (
                        <ToggleRight className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer h-7 w-7 p-0"
                      onClick={() => openEditCategory(cat)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => deleteCategory({ id: cat._id })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {catItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-3 text-center border border-dashed rounded-lg">
                      No items in this category yet.
                    </p>
                  ) : (
                    <div className="divide-y rounded-lg border">
                      {catItems.map((item) => (
                        <div
                          key={item._id}
                          className="flex items-center gap-3 p-3"
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-12 w-12 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                              <Image className="h-5 w-5 text-muted-foreground/50" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium truncate">
                                {item.name}
                              </span>
                              {item.isVeg && (
                                <Leaf className="h-3 w-3 text-emerald-600 shrink-0" />
                              )}
                              {!item.isAvailable && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Unavailable
                                </Badge>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <span className="text-sm font-semibold tabular-nums">
                            ${item.price.toFixed(2)}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="cursor-pointer h-7 w-7 p-0"
                              onClick={() =>
                                updateItem({
                                  id: item._id,
                                  isAvailable: !item.isAvailable,
                                })
                              }
                            >
                              {item.isAvailable ? (
                                <ToggleRight className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="cursor-pointer h-7 w-7 p-0"
                              onClick={() => openEditItem(item)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="cursor-pointer h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => deleteItem({ id: item._id })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Category Dialog */}
      <Dialog
        open={showCategoryDialog}
        onOpenChange={setShowCategoryDialog}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Category" : "New Category"}
            </DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Category name"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveCategory()}
          />
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setShowCategoryDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer"
              onClick={handleSaveCategory}
              disabled={!categoryName.trim()}
            >
              {editingCategory ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Menu Item" : "New Menu Item"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Name</label>
              <Input
                placeholder="e.g. Margherita Pizza"
                value={itemForm.name}
                onChange={(e) =>
                  setItemForm({ ...itemForm, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Description
              </label>
              <Textarea
                placeholder="Brief description of the item"
                value={itemForm.description}
                onChange={(e) =>
                  setItemForm({ ...itemForm, description: e.target.value })
                }
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Price ($)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={itemForm.price}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, price: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Category
                </label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                  value={itemForm.categoryId}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, categoryId: e.target.value })
                  }
                >
                  {sortedCategories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Image URL <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                placeholder="https://example.com/image.jpg"
                value={itemForm.imageUrl}
                onChange={(e) =>
                  setItemForm({ ...itemForm, imageUrl: e.target.value })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={itemForm.isVeg}
                onChange={(e) =>
                  setItemForm({ ...itemForm, isVeg: e.target.checked })
                }
                className="rounded border-input"
              />
              <Leaf className="h-3.5 w-3.5 text-emerald-600" />
              Vegetarian
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setShowItemDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer"
              onClick={handleSaveItem}
              disabled={
                !itemForm.name.trim() ||
                !itemForm.price ||
                !itemForm.categoryId
              }
            >
              {editingItem ? "Save" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
