import { useState, useRef } from "react";
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
  Upload,
  FileSpreadsheet,
  Camera,
  Check,
  AlertCircle,
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

  // Bulk CSV upload state
  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvError, setCsvError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Photo menu upload state
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [menuPhoto, setMenuPhoto] = useState<File | null>(null);
  const [menuPhotoPreview, setMenuPhotoPreview] = useState<string | null>(null);
  const [photoItems, setPhotoItems] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  if (!categories || !menuItems) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading menu...
      </div>
    );
  }

  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  // ─── Category Handlers ─────────────────────────────────────
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

  // ─── Item Handlers ─────────────────────────────────────────
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

  // ─── CSV Handlers ──────────────────────────────────────────
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setCsvError("");
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter((line) => line.trim());
      if (lines.length < 2) {
        setCsvError("CSV must have a header row and at least one data row.");
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const nameIdx = headers.findIndex((h) => h === "name");
      const priceIdx = headers.findIndex((h) => h === "price");
      const categoryIdx = headers.findIndex((h) => h === "category");
      const descIdx = headers.findIndex((h) => h === "description");
      const vegIdx = headers.findIndex((h) => h === "veg" || h === "isveg");

      if (nameIdx === -1 || priceIdx === -1 || categoryIdx === -1) {
        setCsvError("CSV must have 'name', 'price', and 'category' columns.");
        return;
      }

      const items = lines.slice(1).map((line) => {
        const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        return {
          name: cols[nameIdx] || "",
          price: cols[priceIdx] || "",
          category: cols[categoryIdx] || "",
          description: descIdx !== -1 ? cols[descIdx] || "" : "",
          isVeg: vegIdx !== -1 ? cols[vegIdx]?.toLowerCase() === "true" || cols[vegIdx] === "1" : false,
        };
      }).filter((item) => item.name && item.price);

      setCsvPreview(items);
    };
    reader.readAsText(file);
  };

  const handleImportCsv = async () => {
    if (!csvPreview.length) return;
    setIsImporting(true);
    let success = 0;
    let failed = 0;

    for (const item of csvPreview) {
      try {
        // Find or create category
        let categoryId: Id<"categories">;
        const existing = sortedCategories.find(
          (c) => c.name.toLowerCase() === item.category.toLowerCase()
        );
        if (existing) {
          categoryId = existing._id;
        } else {
          categoryId = await createCategory({
            restaurantId,
            name: item.category,
            sortOrder: categories.length + success,
          });
        }

        const price = parseFloat(item.price);
        if (isNaN(price) || price < 0) {
          failed++;
          continue;
        }

        const catItems = menuItems.filter(
          (i) => i.categoryId === categoryId
        );
        await createItem({
          restaurantId,
          categoryId,
          name: item.name,
          description: item.description || undefined,
          price,
          isVeg: item.isVeg,
          sortOrder: catItems.length + success,
        });
        success++;
      } catch {
        failed++;
      }
    }

    setImportResult({ success, failed });
    setIsImporting(false);
  };

  // ─── Photo Menu Handlers ───────────────────────────────────
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMenuPhoto(file);
    setPhotoError("");
    setPhotoItems([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      setMenuPhotoPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzePhoto = async () => {
    if (!menuPhoto) return;
    setIsAnalyzing(true);
    setPhotoError("");

    try {
      // Simulate AI analysis - in production, you'd call a vision API
      // For now, we'll create a simple form for manual entry based on the photo
      setPhotoError("");
      // Create placeholder items that the user can edit
      setPhotoItems([
        { name: "", price: "", category: "", description: "", isVeg: false },
      ]);
    } catch {
      setPhotoError("Failed to analyze photo. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddPhotoItem = () => {
    setPhotoItems([
      ...photoItems,
      { name: "", price: "", category: "", description: "", isVeg: false },
    ]);
  };

  const handleUpdatePhotoItem = (index: number, field: string, value: any) => {
    const updated = [...photoItems];
    updated[index] = { ...updated[index], [field]: value };
    setPhotoItems(updated);
  };

  const handleRemovePhotoItem = (index: number) => {
    setPhotoItems(photoItems.filter((_, i) => i !== index));
  };

  const handleImportPhotoItems = async () => {
    setIsImporting(true);
    let success = 0;

    for (const item of photoItems) {
      if (!item.name || !item.price || !item.category) continue;
      try {
        let categoryId: Id<"categories">;
        const existing = sortedCategories.find(
          (c) => c.name.toLowerCase() === item.category.toLowerCase()
        );
        if (existing) {
          categoryId = existing._id;
        } else {
          categoryId = await createCategory({
            restaurantId,
            name: item.category,
            sortOrder: categories.length + success,
          });
        }

        const price = parseFloat(item.price);
        if (isNaN(price)) continue;

        const catItems = menuItems.filter(
          (i) => i.categoryId === categoryId
        );
        await createItem({
          restaurantId,
          categoryId,
          name: item.name,
          description: item.description || undefined,
          price,
          isVeg: item.isVeg,
          sortOrder: catItems.length + success,
        });
        success++;
      } catch {
        // Skip failed items
      }
    }

    setImportResult({ success, failed: photoItems.length - success });
    setIsImporting(false);
    setShowPhotoDialog(false);
    setMenuPhoto(null);
    setMenuPhotoPreview(null);
    setPhotoItems([]);
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
        <div className="flex gap-2 flex-wrap justify-end">
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
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => setShowCsvDialog(true)}
          >
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
            CSV Upload
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => setShowPhotoDialog(true)}
          >
            <Camera className="mr-1.5 h-3.5 w-3.5" />
            Photo Menu
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

      {/* Import Result Toast */}
      {importResult && (
        <div className="fixed bottom-4 right-4 z-50 bg-white border rounded-lg shadow-lg p-4 flex items-center gap-3">
          <Check className="h-5 w-5 text-emerald-500" />
          <div>
            <p className="text-sm font-medium">
              Imported {importResult.success} items
              {importResult.failed > 0 && (
                <span className="text-muted-foreground">
                  {" "}({importResult.failed} failed)
                </span>
              )}
            </p>
          </div>
          <button
            className="cursor-pointer text-muted-foreground hover:text-foreground"
            onClick={() => setImportResult(null)}
          >
            <X className="h-4 w-4" />
          </button>
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

      {/* CSV Upload Dialog */}
      <Dialog open={showCsvDialog} onOpenChange={setShowCsvDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Upload via CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-2">
                <strong>CSV Format:</strong> Your CSV must have these columns:
              </p>
              <code className="text-[11px] bg-background px-2 py-1 rounded">
                name, price, category, description, veg
              </code>
              <p className="text-[11px] text-muted-foreground mt-2">
                Example: <code>Margherita Pizza, 12.99, Pizza, Classic cheese pizza, true</code>
              </p>
            </div>

            <div>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                ref={csvInputRef}
                onChange={handleCsvUpload}
              />
              <Button
                variant="outline"
                className="cursor-pointer w-full"
                onClick={() => csvInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {csvFile ? csvFile.name : "Choose CSV File"}
              </Button>
            </div>

            {csvError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {csvError}
              </div>
            )}

            {csvPreview.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Preview ({csvPreview.length} items):
                </p>
                <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                  {csvPreview.slice(0, 10).map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 text-xs">
                      <span className="font-medium flex-1">{item.name}</span>
                      <span className="text-muted-foreground">{item.category}</span>
                      <span className="font-medium">${parseFloat(item.price).toFixed(2)}</span>
                      {item.isVeg && <Leaf className="h-3 w-3 text-emerald-600" />}
                    </div>
                  ))}
                  {csvPreview.length > 10 && (
                    <div className="p-2 text-xs text-muted-foreground text-center">
                      ...and {csvPreview.length - 10} more items
                    </div>
                  )}
                </div>
              </div>
            )}

            {importResult && (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <Check className="h-4 w-4" />
                Imported {importResult.success} items
                {importResult.failed > 0 && ` (${importResult.failed} failed)`}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                setShowCsvDialog(false);
                setCsvFile(null);
                setCsvPreview([]);
                setCsvError("");
                setImportResult(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer"
              onClick={handleImportCsv}
              disabled={isImporting || csvPreview.length === 0}
            >
              {isImporting ? "Importing..." : `Import ${csvPreview.length} Items`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Menu Dialog */}
      <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Photo Menu Upload</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a photo of your printed menu and add items from it.
            </p>

            <div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={photoInputRef}
                onChange={handlePhotoUpload}
              />
              <Button
                variant="outline"
                className="cursor-pointer w-full h-24 border-dashed"
                onClick={() => photoInputRef.current?.click()}
              >
                {menuPhotoPreview ? (
                  <img
                    src={menuPhotoPreview}
                    alt="Menu preview"
                    className="h-full max-h-20 object-contain rounded"
                  />
                ) : (
                  <div className="text-center">
                    <Camera className="mx-auto h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">
                      Click to upload menu photo
                    </span>
                  </div>
                )}
              </Button>
            </div>

            {menuPhoto && photoItems.length === 0 && (
              <Button
                className="cursor-pointer w-full"
                onClick={handleAnalyzePhoto}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? "Analyzing..." : "Start Adding Items"}
              </Button>
            )}

            {photoError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {photoError}
              </div>
            )}

            {photoItems.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  Add items from your menu photo:
                </p>
                <div className="max-h-64 overflow-y-auto space-y-3">
                  {photoItems.map((item, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-2 gap-2 p-2 bg-muted/30 rounded-lg relative"
                    >
                      {photoItems.length > 1 && (
                        <button
                          className="absolute top-1 right-1 cursor-pointer text-destructive hover:text-destructive"
                          onClick={() => handleRemovePhotoItem(index)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                      <Input
                        placeholder="Item name"
                        value={item.name}
                        onChange={(e) =>
                          handleUpdatePhotoItem(index, "name", e.target.value)
                        }
                        className="text-xs"
                      />
                      <Input
                        type="number"
                        placeholder="Price"
                        value={item.price}
                        onChange={(e) =>
                          handleUpdatePhotoItem(index, "price", e.target.value)
                        }
                        className="text-xs"
                      />
                      <Input
                        placeholder="Category"
                        value={item.category}
                        onChange={(e) =>
                          handleUpdatePhotoItem(index, "category", e.target.value)
                        }
                        className="text-xs"
                      />
                      <label className="flex items-center gap-1 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.isVeg}
                          onChange={(e) =>
                            handleUpdatePhotoItem(index, "isVeg", e.target.checked)
                          }
                          className="rounded"
                        />
                        <Leaf className="h-3 w-3 text-emerald-600" />
                        Veg
                      </label>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  onClick={handleAddPhotoItem}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add Another Item
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                setShowPhotoDialog(false);
                setMenuPhoto(null);
                setMenuPhotoPreview(null);
                setPhotoItems([]);
                setPhotoError("");
              }}
            >
              Cancel
            </Button>
            {photoItems.length > 0 && (
              <Button
                className="cursor-pointer"
                onClick={handleImportPhotoItems}
                disabled={isImporting || photoItems.filter((i) => i.name && i.price).length === 0}
              >
                {isImporting
                  ? "Importing..."
                  : `Import ${photoItems.filter((i) => i.name && i.price).length} Items`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
