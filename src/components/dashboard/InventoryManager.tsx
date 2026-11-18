import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Boxes,
  ClipboardList,
  Factory,
  PackageCheck,
  Plus,
  Scale,
  ShoppingCart,
  Trash2,
  TrendingDown,
  Truck,
  UtensilsCrossed,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";

const UNITS = ["g", "kg", "ml", "l", "pcs", "portion", "pack", "box"];

type Section = "overview" | "ingredients" | "recipes" | "purchasing" | "waste";

const SECTIONS: { id: Section; label: string; icon: typeof Boxes }[] = [
  { id: "overview", label: "Overview", icon: Boxes },
  { id: "ingredients", label: "Ingredients", icon: Warehouse },
  { id: "recipes", label: "Recipes & costing", icon: UtensilsCrossed },
  { id: "purchasing", label: "Purchasing", icon: ShoppingCart },
  { id: "waste", label: "Waste & ledger", icon: Scale },
];

const money = (value: number) => value.toFixed(2);

type IngredientDraft = {
  name: string;
  unit: string;
  category: string;
  currentStock: string;
  parLevel: string;
  costPerUnit: string;
  supplierId: string;
};

const emptyIngredient: IngredientDraft = {
  name: "",
  unit: "kg",
  category: "",
  currentStock: "0",
  parLevel: "0",
  costPerUnit: "0",
  supplierId: "",
};

export function InventoryManager({ restaurantId }: { restaurantId: Id<"restaurants"> }) {
  const [section, setSection] = useState<Section>("overview");
  const [busy, setBusy] = useState<string | null>(null);

  const ingredients = useQuery(api.inventory.listIngredients, { restaurantId }) ?? [];
  const suppliers = useQuery(api.inventory.listSuppliers, { restaurantId }) ?? [];
  const summary = useQuery(api.inventory.getSummary, { restaurantId });
  const costing = useQuery(api.inventory.getMenuCosting, { restaurantId }) ?? [];
  const purchaseOrders = useQuery(api.inventory.listPurchaseOrders, { restaurantId }) ?? [];
  const movements = useQuery(api.inventory.listMovements, { restaurantId, limit: 200 }) ?? [];

  const createIngredient = useMutation(api.inventory.createIngredient);
  const updateIngredient = useMutation(api.inventory.updateIngredient);
  const adjustStock = useMutation(api.inventory.adjustStock);
  const logWaste = useMutation(api.inventory.logWaste);
  const removeIngredient = useMutation(api.inventory.removeIngredient);
  const createSupplier = useMutation(api.inventory.createSupplier);
  const setRecipe = useMutation(api.inventory.setRecipe);
  const createPurchaseOrder = useMutation(api.inventory.createPurchaseOrder);
  const setPurchaseOrderStatus = useMutation(api.inventory.setPurchaseOrderStatus);
  const receivePurchaseOrder = useMutation(api.inventory.receivePurchaseOrder);

  // Ingredient dialog
  const [ingredientDialog, setIngredientDialog] = useState<"new" | Id<"ingredients"> | null>(null);
  const [draft, setDraft] = useState<IngredientDraft>(emptyIngredient);
  const [adjusting, setAdjusting] = useState<Doc<"ingredients"> | null>(null);
  const [adjustForm, setAdjustForm] = useState({ quantity: "", reason: "" });
  const [wasting, setWasting] = useState<Doc<"ingredients"> | null>(null);
  const [wasteForm, setWasteForm] = useState({ quantity: "", reason: "", batchCode: "" });

  // Supplier dialog
  const [supplierDialog, setSupplierDialog] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", email: "" });

  // Recipe dialog
  const [recipeItem, setRecipeItem] = useState<Id<"menuItems"> | null>(null);
  const [recipeLines, setRecipeLines] = useState<{ ingredientId: string; quantity: string }[]>([]);

  // Purchase order dialogs
  const [poDialog, setPoDialog] = useState(false);
  const [poForm, setPoForm] = useState({
    supplierId: "",
    supplierName: "",
    expectedAt: "",
    notes: "",
    lines: [{ ingredientId: "", quantity: "", unitCost: "" }],
  });
  const [receiving, setReceiving] = useState<Doc<"purchaseOrders"> | null>(null);
  const [receiptLines, setReceiptLines] = useState<
    { ingredientId: string; receivedQuantity: string; unitCost: string; batchCode: string; expiryDate: string }[]
  >([]);

  const lowStock = summary?.lowStock ?? [];
  const ingredientById = useMemo(
    () => new Map(ingredients.map((item) => [item._id, item])),
    [ingredients],
  );

  const openIngredient = (ingredient?: Doc<"ingredients">) => {
    if (ingredient) {
      setIngredientDialog(ingredient._id);
      setDraft({
        name: ingredient.name,
        unit: ingredient.unit,
        category: ingredient.category ?? "",
        currentStock: String(ingredient.currentStock),
        parLevel: String(ingredient.parLevel),
        costPerUnit: String(ingredient.costPerUnit),
        supplierId: ingredient.supplierId ?? "",
      });
    } else {
      setIngredientDialog("new");
      setDraft(emptyIngredient);
    }
  };

  const saveIngredient = async () => {
    if (!draft.name.trim()) {
      toast.error("Ingredient name is required");
      return;
    }
    setBusy("ingredient");
    try {
      if (ingredientDialog === "new") {
        await createIngredient({
          restaurantId,
          name: draft.name,
          unit: draft.unit,
          category: draft.category || undefined,
          currentStock: Number(draft.currentStock) || 0,
          parLevel: Number(draft.parLevel) || 0,
          costPerUnit: Number(draft.costPerUnit) || 0,
          supplierId: (draft.supplierId || undefined) as Id<"suppliers"> | undefined,
        });
        toast.success("Ingredient added");
      } else if (ingredientDialog) {
        await updateIngredient({
          id: ingredientDialog,
          name: draft.name,
          unit: draft.unit,
          category: draft.category || undefined,
          parLevel: Number(draft.parLevel) || 0,
          costPerUnit: Number(draft.costPerUnit) || 0,
          supplierId: (draft.supplierId || undefined) as Id<"suppliers"> | undefined,
        });
        toast.success("Ingredient updated");
      }
      setIngredientDialog(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the ingredient");
    } finally {
      setBusy(null);
    }
  };

  const submitAdjustment = async () => {
    if (!adjusting) return;
    const quantity = Number(adjustForm.quantity);
    if (!quantity) {
      toast.error("Enter a non-zero quantity");
      return;
    }
    setBusy("adjust");
    try {
      await adjustStock({ id: adjusting._id, quantity, reason: adjustForm.reason || "Manual adjustment" });
      toast.success("Stock adjusted");
      setAdjusting(null);
      setAdjustForm({ quantity: "", reason: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not adjust stock");
    } finally {
      setBusy(null);
    }
  };

  const submitWaste = async () => {
    if (!wasting) return;
    const quantity = Number(wasteForm.quantity);
    if (!quantity || quantity <= 0) {
      toast.error("Enter the wasted quantity");
      return;
    }
    setBusy("waste");
    try {
      await logWaste({
        id: wasting._id,
        quantity,
        reason: wasteForm.reason || "Waste",
        batchCode: wasteForm.batchCode || undefined,
      });
      toast.success("Waste logged");
      setWasting(null);
      setWasteForm({ quantity: "", reason: "", batchCode: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not log waste");
    } finally {
      setBusy(null);
    }
  };

  const openRecipe = (menuItemId: Id<"menuItems">) => {
    const item = costing.find((row) => row._id === menuItemId);
    setRecipeItem(menuItemId);
    setRecipeLines(
      item?.recipe.map((line) => ({
        ingredientId: line.ingredientId,
        quantity: String(line.quantity),
      })) ?? [{ ingredientId: "", quantity: "" }],
    );
  };

  const saveRecipe = async () => {
    if (!recipeItem) return;
    const lines = recipeLines
      .filter((line) => line.ingredientId && Number(line.quantity) > 0)
      .map((line) => ({
        ingredientId: line.ingredientId as Id<"ingredients">,
        quantity: Number(line.quantity),
      }));
    setBusy("recipe");
    try {
      await setRecipe({ menuItemId: recipeItem, lines });
      toast.success("Recipe saved — stock now deducts on every order");
      setRecipeItem(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the recipe");
    } finally {
      setBusy(null);
    }
  };

  const submitSupplier = async () => {
    if (!supplierForm.name.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    setBusy("supplier");
    try {
      await createSupplier({
        restaurantId,
        name: supplierForm.name,
        phone: supplierForm.phone || undefined,
        email: supplierForm.email || undefined,
      });
      toast.success("Supplier saved");
      setSupplierDialog(false);
      setSupplierForm({ name: "", phone: "", email: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the supplier");
    } finally {
      setBusy(null);
    }
  };

  const submitPurchaseOrder = async () => {
    const lines = poForm.lines
      .filter((line) => line.ingredientId && Number(line.quantity) > 0)
      .map((line) => ({
        ingredientId: line.ingredientId as Id<"ingredients">,
        quantity: Number(line.quantity),
        unitCost: Number(line.unitCost) || 0,
      }));
    if (lines.length === 0) {
      toast.error("Add at least one ingredient");
      return;
    }
    setBusy("po");
    try {
      await createPurchaseOrder({
        restaurantId,
        supplierId: (poForm.supplierId || undefined) as Id<"suppliers"> | undefined,
        supplierName:
          suppliers.find((supplier) => supplier._id === poForm.supplierId)?.name ||
          poForm.supplierName ||
          "Unassigned supplier",
        items: lines,
        expectedAt: poForm.expectedAt || undefined,
        notes: poForm.notes || undefined,
        send: true,
      });
      toast.success("Purchase order created");
      setPoDialog(false);
      setPoForm({
        supplierId: "",
        supplierName: "",
        expectedAt: "",
        notes: "",
        lines: [{ ingredientId: "", quantity: "", unitCost: "" }],
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the purchase order");
    } finally {
      setBusy(null);
    }
  };

  const openReceipt = (po: Doc<"purchaseOrders">) => {
    setReceiving(po);
    setReceiptLines(
      po.items.map((line) => ({
        ingredientId: line.ingredientId,
        receivedQuantity: String(line.quantity),
        unitCost: String(line.unitCost),
        batchCode: "",
        expiryDate: "",
      })),
    );
  };

  const submitReceipt = async () => {
    if (!receiving) return;
    setBusy("receive");
    try {
      await receivePurchaseOrder({
        id: receiving._id,
        items: receiptLines.map((line) => ({
          ingredientId: line.ingredientId as Id<"ingredients">,
          receivedQuantity: Number(line.receivedQuantity) || 0,
          unitCost: Number(line.unitCost) || 0,
          batchCode: line.batchCode || undefined,
          expiryDate: line.expiryDate || undefined,
        })),
      });
      toast.success("Goods received — stock updated with batch details");
      setReceiving(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not receive the order");
    } finally {
      setBusy(null);
    }
  };

  const removeItem = async (id: Id<"ingredients">) => {
    try {
      await removeIngredient({ id });
      toast.success("Ingredient deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the ingredient");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1 rounded-lg border border-green-100 bg-white p-1">
        {SECTIONS.map((entry) => (
          <button
            key={entry.id}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              section === entry.id
                ? "bg-[#4A8C6F] text-white"
                : "text-gray-500 hover:text-[#4A8C6F]"
            }`}
            onClick={() => setSection(entry.id)}
          >
            <entry.icon className="h-3.5 w-3.5" />
            {entry.label}
          </button>
        ))}
      </div>

      {section === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Stock value", value: money(summary?.stockValue ?? 0), icon: Warehouse, tone: "text-[#4A8C6F]" },
              { label: "Below par", value: String(summary?.lowStock.length ?? 0), icon: TrendingDown, tone: "text-amber-600" },
              { label: "Waste this month", value: money(summary?.wasteThisMonthValue ?? 0), icon: Scale, tone: "text-red-500" },
              { label: "Open purchase orders", value: String(summary?.openPurchaseOrders ?? 0), icon: ClipboardList, tone: "text-[#5B9A7C]" },
            ].map((stat) => (
              <Card key={stat.label} className="border-green-100 bg-white">
                <CardContent className="p-4">
                  <div className={`mb-1 flex items-center gap-1.5 ${stat.tone}`}>
                    <stat.icon className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{stat.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-green-100 bg-white">
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b border-green-100 px-5 py-3">
                  <h3 className="text-sm font-semibold text-gray-900">Needs restocking</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 cursor-pointer border-green-200 text-[11px] text-[#4A8C6F]"
                    onClick={() => setPoDialog(true)}
                  >
                    <Plus className="mr-1 h-3 w-3" /> Purchase order
                  </Button>
                </div>
                {lowStock.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-gray-500">
                    Everything is above its par level.
                  </p>
                ) : (
                  <div className="divide-y divide-green-50">
                    {lowStock.slice(0, 8).map((item) => (
                      <div key={item._id} className="flex items-center justify-between px-5 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{item.name}</p>
                          <p className="text-[11px] text-gray-400">
                            {item.currentStock} {item.unit} left · par {item.parLevel}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 cursor-pointer text-[11px] text-[#4A8C6F] hover:bg-green-50"
                          onClick={() => {
                            setAdjusting(item);
                            setAdjustForm({ quantity: "", reason: "Restock" });
                          }}
                        >
                          Add stock
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-green-100 bg-white">
              <CardContent className="p-0">
                <div className="border-b border-green-100 px-5 py-3">
                  <h3 className="text-sm font-semibold text-gray-900">Latest stock movements</h3>
                </div>
                {movements.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-gray-500">
                    Movements appear here as orders are billed and goods are received.
                  </p>
                ) : (
                  <div className="max-h-80 divide-y divide-green-50 overflow-y-auto">
                    {movements.slice(0, 20).map((movement) => (
                      <div key={movement._id} className="flex items-center justify-between px-5 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-gray-800">
                            {movement.ingredientName}
                          </p>
                          <p className="truncate text-[11px] text-gray-400">
                            {movement.reason ?? movement.type}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-xs font-semibold ${
                            movement.quantity >= 0 ? "text-[#4A8C6F]" : "text-red-500"
                          }`}
                        >
                          {movement.quantity > 0 ? "+" : ""}
                          {movement.quantity} {movement.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {section === "ingredients" && (
        <Card className="border-green-100 bg-white">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-green-100 px-5 py-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Ingredients ({ingredients.length})
              </h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer border-green-200 text-[#4A8C6F]"
                  onClick={() => setSupplierDialog(true)}
                >
                  <Truck className="mr-1 h-3.5 w-3.5" /> Supplier
                </Button>
                <Button
                  size="sm"
                  className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
                  onClick={() => openIngredient()}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Ingredient
                </Button>
              </div>
            </div>
            {ingredients.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Boxes className="mx-auto mb-2 h-7 w-7 text-green-300" />
                <p className="text-sm text-gray-500">
                  Add the ingredients you buy — flour, paneer, oil — then attach them to dishes.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-green-100 text-left text-[11px] uppercase tracking-wide text-gray-400">
                      <th className="px-5 py-2 font-medium">Ingredient</th>
                      <th className="px-3 py-2 font-medium">On hand</th>
                      <th className="px-3 py-2 font-medium">Par</th>
                      <th className="px-3 py-2 font-medium">Unit cost</th>
                      <th className="px-3 py-2 font-medium">Value</th>
                      <th className="px-3 py-2 font-medium">Supplier</th>
                      <th className="px-5 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-green-50">
                    {ingredients.map((item) => {
                      const supplier = suppliers.find((s) => s._id === item.supplierId);
                      const low = item.currentStock <= item.parLevel;
                      return (
                        <tr key={item._id} className="hover:bg-green-50/40">
                          <td className="px-5 py-2.5">
                            <p className="font-medium text-gray-800">{item.name}</p>
                            <p className="text-[11px] text-gray-400">{item.category ?? item.unit}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`font-semibold ${low ? "text-amber-600" : "text-gray-800"}`}
                            >
                              {item.currentStock} {item.unit}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-500">{item.parLevel}</td>
                          <td className="px-3 py-2.5 text-gray-500">{money(item.costPerUnit)}</td>
                          <td className="px-3 py-2.5 font-medium text-gray-800">
                            {money(item.currentStock * item.costPerUnit)}
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-gray-500">
                            {supplier?.name ?? "—"}
                          </td>
                          <td className="px-5 py-2.5">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 cursor-pointer px-2 text-[11px] text-[#4A8C6F] hover:bg-green-50"
                                onClick={() => {
                                  setAdjusting(item);
                                  setAdjustForm({ quantity: "", reason: "" });
                                }}
                              >
                                Adjust
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 cursor-pointer px-2 text-[11px] text-red-500 hover:bg-red-50"
                                onClick={() => {
                                  setWasting(item);
                                  setWasteForm({ quantity: "", reason: "", batchCode: "" });
                                }}
                              >
                                Waste
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 cursor-pointer px-2 text-[11px] text-gray-500 hover:bg-gray-100"
                                onClick={() => openIngredient(item)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 cursor-pointer text-gray-400 hover:bg-red-50 hover:text-red-500"
                                onClick={() => removeItem(item._id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {section === "recipes" && (
        <Card className="border-green-100 bg-white">
          <CardContent className="p-0">
            <div className="border-b border-green-100 px-5 py-3">
              <h3 className="text-sm font-semibold text-gray-900">Recipe costing</h3>
              <p className="text-[11px] text-gray-400">
                Attach ingredients to a dish once — every order of that dish now draws stock down
                automatically.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-green-100 text-left text-[11px] uppercase tracking-wide text-gray-400">
                    <th className="px-5 py-2 font-medium">Dish</th>
                    <th className="px-3 py-2 font-medium">Price</th>
                    <th className="px-3 py-2 font-medium">Recipe cost</th>
                    <th className="px-3 py-2 font-medium">Gross margin</th>
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-green-50">
                  {costing.map((row) => (
                    <tr key={row._id} className="hover:bg-green-50/40">
                      <td className="px-5 py-2.5">
                        <p className="font-medium text-gray-800">{row.name}</p>
                        <p className="text-[11px] text-gray-400">
                          {row.hasRecipe ? `${row.recipe.length} ingredient(s)` : "No recipe yet"}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">{money(row.price)}</td>
                      <td className="px-3 py-2.5 text-gray-600">
                        {row.hasRecipe ? money(row.cost) : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.hasRecipe ? (
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              row.margin >= 60
                                ? "border-green-200 bg-green-50 text-[#3D7A5F]"
                                : row.margin >= 35
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-red-200 bg-red-50 text-red-600"
                            }`}
                          >
                            {row.margin}%
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 cursor-pointer border-green-200 text-[11px] text-[#4A8C6F] hover:bg-green-50"
                          onClick={() => openRecipe(row._id)}
                        >
                          {row.hasRecipe ? "Edit recipe" : "Add recipe"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {section === "purchasing" && (
        <div className="space-y-4">
          <Card className="border-green-100 bg-white">
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b border-green-100 px-5 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Purchase orders</h3>
                  <p className="text-[11px] text-gray-400">
                    Receive goods with batch and expiry so you can trace waste later.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer border-green-200 text-[#4A8C6F]"
                    onClick={() => setSupplierDialog(true)}
                  >
                    <Truck className="mr-1 h-3.5 w-3.5" /> Supplier
                  </Button>
                  <Button
                    size="sm"
                    className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
                    onClick={() => setPoDialog(true)}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> New PO
                  </Button>
                </div>
              </div>
              {purchaseOrders.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <ShoppingCart className="mx-auto mb-2 h-7 w-7 text-green-300" />
                  <p className="text-sm text-gray-500">
                    No purchase orders yet. Raise one when you run low.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-green-50">
                  {purchaseOrders.map((po) => (
                    <div key={po._id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <div className="w-24">
                        <p className="text-sm font-semibold text-gray-900">{po.orderNumber}</p>
                        <p className="text-[10px] text-gray-400">
                          {new Date(po.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800">{po.supplierName}</p>
                        <p className="text-[11px] text-gray-400">
                          {po.items.length} line(s) ·{" "}
                          {po.items
                            .map((line) => `${line.quantity} ${ingredientById.get(line.ingredientId)?.unit ?? ""}`)
                            .join(", ")}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {money(po.total)}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] capitalize ${
                          po.status === "received"
                            ? "border-green-200 bg-green-50 text-[#3D7A5F]"
                            : po.status === "cancelled"
                              ? "border-red-200 bg-red-50 text-red-600"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {po.status}
                      </Badge>
                      <div className="flex gap-1">
                        {po.status !== "received" && po.status !== "cancelled" && (
                          <>
                            <Button
                              size="sm"
                              className="h-7 cursor-pointer bg-[#4A8C6F] px-2 text-[11px] text-white hover:bg-[#3D7A5F]"
                              onClick={() => openReceipt(po)}
                            >
                              <PackageCheck className="mr-1 h-3 w-3" /> Receive
                            </Button>
                            {po.status === "draft" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 cursor-pointer px-2 text-[11px] text-gray-500"
                                onClick={() => setPurchaseOrderStatus({ id: po._id, status: "sent" })}
                              >
                                Mark sent
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 cursor-pointer px-2 text-[11px] text-red-500 hover:bg-red-50"
                              onClick={() => setPurchaseOrderStatus({ id: po._id, status: "cancelled" })}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-green-100 bg-white">
            <CardContent className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Suppliers</h3>
              {suppliers.length === 0 ? (
                <p className="text-sm text-gray-500">No suppliers yet.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {suppliers.map((supplier) => (
                    <div key={supplier._id} className="rounded-lg border border-green-100 p-3">
                      <p className="text-sm font-medium text-gray-800">{supplier.name}</p>
                      <p className="text-[11px] text-gray-500">
                        {supplier.phone ?? "No phone"} · {supplier.email ?? "No email"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {section === "waste" && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card className="border-green-100 bg-white">
            <CardContent className="p-5">
              <h3 className="mb-1 text-sm font-semibold text-gray-900">Log waste</h3>
              <p className="mb-3 text-[11px] text-gray-400">
                Spoilage, trim loss, staff meals — anything that leaves stock outside a sale.
              </p>
              <div className="space-y-3">
                <div>
                  <Label className="mb-1.5 block text-xs">Ingredient</Label>
                  <Select
                    value={wasting?._id ?? ""}
                    onValueChange={(value) =>
                      setWasting(ingredients.find((item) => item._id === value) ?? null)
                    }
                  >
                    <SelectTrigger className="cursor-pointer text-sm">
                      <SelectValue placeholder="Choose ingredient" />
                    </SelectTrigger>
                    <SelectContent>
                      {ingredients.map((item) => (
                        <SelectItem key={item._id} value={item._id} className="cursor-pointer text-sm">
                          {item.name} ({item.currentStock} {item.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">Quantity</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={wasteForm.quantity}
                    onChange={(e) => setWasteForm({ ...wasteForm, quantity: e.target.value })}
                    placeholder={wasting ? `in ${wasting.unit}` : "Choose an ingredient first"}
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">Reason</Label>
                  <Input
                    value={wasteForm.reason}
                    onChange={(e) => setWasteForm({ ...wasteForm, reason: e.target.value })}
                    placeholder="Expired, dropped, trim…"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">Batch (optional)</Label>
                  <Input
                    value={wasteForm.batchCode}
                    onChange={(e) => setWasteForm({ ...wasteForm, batchCode: e.target.value })}
                  />
                </div>
                <Button
                  className="w-full cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
                  disabled={!wasting || busy === "waste"}
                  onClick={submitWaste}
                >
                  <Scale className="mr-1.5 h-4 w-4" /> Log waste
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-100 bg-white">
            <CardContent className="p-0">
              <div className="border-b border-green-100 px-5 py-3">
                <h3 className="text-sm font-semibold text-gray-900">Stock ledger</h3>
                <p className="text-[11px] text-gray-400">
                  Every purchase, sale deduction, waste entry and adjustment, newest first.
                </p>
              </div>
              <div className="max-h-[520px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-green-100 text-left text-[11px] uppercase tracking-wide text-gray-400">
                      <th className="px-5 py-2 font-medium">When</th>
                      <th className="px-3 py-2 font-medium">Ingredient</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Qty</th>
                      <th className="px-3 py-2 font-medium">Batch / reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-green-50">
                    {movements.map((movement) => (
                      <tr key={movement._id}>
                        <td className="px-5 py-2 text-[11px] text-gray-500">
                          {new Date(movement.createdAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-gray-800">{movement.ingredientName}</td>
                        <td className="px-3 py-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize ${
                              movement.type === "waste"
                                ? "border-red-200 bg-red-50 text-red-600"
                                : movement.type === "purchase"
                                  ? "border-green-200 bg-green-50 text-[#3D7A5F]"
                                  : "border-gray-200 bg-gray-50 text-gray-600"
                            }`}
                          >
                            {movement.type}
                          </Badge>
                        </td>
                        <td
                          className={`px-3 py-2 font-medium ${
                            movement.quantity >= 0 ? "text-[#4A8C6F]" : "text-red-500"
                          }`}
                        >
                          {movement.quantity > 0 ? "+" : ""}
                          {movement.quantity} {movement.unit}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-gray-500">
                          {[movement.batchCode, movement.reason].filter(Boolean).join(" · ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ingredient dialog */}
      <Dialog open={ingredientDialog !== null} onOpenChange={(open) => !open && setIngredientDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {ingredientDialog === "new" ? "New ingredient" : "Edit ingredient"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="mb-1.5 block text-xs">Name *</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Paneer"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-xs">Unit</Label>
                <Select value={draft.unit} onValueChange={(value) => setDraft({ ...draft, unit: value })}>
                  <SelectTrigger className="cursor-pointer text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit} className="cursor-pointer text-sm">
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Category</Label>
                <Input
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  placeholder="Dairy"
                />
              </div>
            </div>
            {ingredientDialog === "new" && (
              <div>
                <Label className="mb-1.5 block text-xs">Opening stock</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.currentStock}
                  onChange={(e) => setDraft({ ...draft, currentStock: e.target.value })}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-xs">Par level</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.parLevel}
                  onChange={(e) => setDraft({ ...draft, parLevel: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Cost per unit</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.costPerUnit}
                  onChange={(e) => setDraft({ ...draft, costPerUnit: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Supplier</Label>
              <Select
                value={draft.supplierId || "none"}
                onValueChange={(value) =>
                  setDraft({ ...draft, supplierId: value === "none" ? "" : value })
                }
              >
                <SelectTrigger className="cursor-pointer text-sm">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="cursor-pointer text-sm">
                    None
                  </SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier._id} value={supplier._id} className="cursor-pointer text-sm">
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setIngredientDialog(null)}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
              disabled={busy === "ingredient"}
              onClick={saveIngredient}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust dialog */}
      <Dialog open={Boolean(adjusting)} onOpenChange={(open) => !open && setAdjusting(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Adjust {adjusting?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-500">
            On hand: {adjusting?.currentStock} {adjusting?.unit}. Use a negative number to remove
            stock, positive to add.
          </p>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 block text-xs">Quantity ({adjusting?.unit})</Label>
              <Input
                type="number"
                step="0.01"
                value={adjustForm.quantity}
                onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                placeholder="10 or -2.5"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Reason</Label>
              <Input
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                placeholder="Delivery received, count correction…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setAdjusting(null)}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
              disabled={busy === "adjust"}
              onClick={submitAdjustment}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Waste dialog (per-row shortcut) */}
      <Dialog open={Boolean(wasting)} onOpenChange={(open) => !open && setWasting(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Waste {wasting?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 block text-xs">
                Quantity ({wasting?.unit}) — {wasting?.currentStock} on hand
              </Label>
              <Input
                type="number"
                step="0.01"
                value={wasteForm.quantity}
                onChange={(e) => setWasteForm({ ...wasteForm, quantity: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Reason</Label>
              <Input
                value={wasteForm.reason}
                onChange={(e) => setWasteForm({ ...wasteForm, reason: e.target.value })}
                placeholder="Expired batch"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Batch code</Label>
              <Input
                value={wasteForm.batchCode}
                onChange={(e) => setWasteForm({ ...wasteForm, batchCode: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setWasting(null)}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-red-500 text-white hover:bg-red-600"
              disabled={busy === "waste"}
              onClick={submitWaste}
            >
              Log waste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplier dialog */}
      <Dialog open={supplierDialog} onOpenChange={setSupplierDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 block text-xs">Name *</Label>
              <Input
                value={supplierForm.name}
                onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                placeholder="Fresh Farm Produce"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Phone</Label>
              <Input
                value={supplierForm.phone}
                onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Email</Label>
              <Input
                value={supplierForm.email}
                onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setSupplierDialog(false)}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
              disabled={busy === "supplier"}
              onClick={submitSupplier}
            >
              Save supplier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recipe dialog */}
      <Dialog open={Boolean(recipeItem)} onOpenChange={(open) => !open && setRecipeItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Recipe — {costing.find((row) => row._id === recipeItem)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {recipeLines.map((line, index) => (
              <div key={index} className="flex gap-2">
                <Select
                  value={line.ingredientId}
                  onValueChange={(value) =>
                    setRecipeLines((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, ingredientId: value } : row)),
                    )
                  }
                >
                  <SelectTrigger className="flex-1 cursor-pointer text-sm">
                    <SelectValue placeholder="Ingredient" />
                  </SelectTrigger>
                  <SelectContent>
                    {ingredients.map((item) => (
                      <SelectItem key={item._id} value={item._id} className="cursor-pointer text-sm">
                        {item.name} ({item.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  className="w-28"
                  value={line.quantity}
                  onChange={(e) =>
                    setRecipeLines((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, quantity: e.target.value } : row)),
                    )
                  }
                  placeholder="Qty"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="cursor-pointer text-gray-400 hover:text-red-500"
                  onClick={() => setRecipeLines((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer border-green-200 text-[#4A8C6F] hover:bg-green-50"
              onClick={() =>
                setRecipeLines((prev) => [...prev, { ingredientId: "", quantity: "" }])
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add ingredient
            </Button>
            <p className="rounded-lg bg-green-50 px-3 py-2 text-[11px] text-[#3D7A5F]">
              Quantities are per single serving, in the ingredient's stock unit. Clearing every line
              removes the recipe.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setRecipeItem(null)}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
              disabled={busy === "recipe"}
              onClick={saveRecipe}
            >
              Save recipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase order dialog */}
      <Dialog open={poDialog} onOpenChange={setPoDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New purchase order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-xs">Supplier</Label>
                <Select
                  value={poForm.supplierId || "none"}
                  onValueChange={(value) =>
                    setPoForm({ ...poForm, supplierId: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger className="cursor-pointer text-sm">
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="cursor-pointer text-sm">
                      Unassigned
                    </SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier._id} value={supplier._id} className="cursor-pointer text-sm">
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Expected</Label>
                <Input
                  type="date"
                  value={poForm.expectedAt}
                  onChange={(e) => setPoForm({ ...poForm, expectedAt: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="block text-xs">Lines</Label>
              {poForm.lines.map((line, index) => (
                <div key={index} className="flex gap-2">
                  <Select
                    value={line.ingredientId}
                    onValueChange={(value) => {
                      const ingredient = ingredients.find((item) => item._id === value);
                      setPoForm((prev) => ({
                        ...prev,
                        lines: prev.lines.map((row, i) =>
                          i === index
                            ? {
                                ...row,
                                ingredientId: value,
                                unitCost: ingredient ? String(ingredient.costPerUnit) : row.unitCost,
                              }
                            : row,
                        ),
                      }));
                    }}
                  >
                    <SelectTrigger className="flex-1 cursor-pointer text-sm">
                      <SelectValue placeholder="Ingredient" />
                    </SelectTrigger>
                    <SelectContent>
                      {ingredients.map((item) => (
                        <SelectItem key={item._id} value={item._id} className="cursor-pointer text-sm">
                          {item.name} ({item.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    className="w-24"
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={(e) =>
                      setPoForm((prev) => ({
                        ...prev,
                        lines: prev.lines.map((row, i) =>
                          i === index ? { ...row, quantity: e.target.value } : row,
                        ),
                      }))
                    }
                  />
                  <Input
                    type="number"
                    step="0.01"
                    className="w-24"
                    placeholder="Cost"
                    value={line.unitCost}
                    onChange={(e) =>
                      setPoForm((prev) => ({
                        ...prev,
                        lines: prev.lines.map((row, i) =>
                          i === index ? { ...row, unitCost: e.target.value } : row,
                        ),
                      }))
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="cursor-pointer text-gray-400 hover:text-red-500"
                    onClick={() =>
                      setPoForm((prev) => ({
                        ...prev,
                        lines: prev.lines.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer border-green-200 text-[#4A8C6F] hover:bg-green-50"
                onClick={() =>
                  setPoForm((prev) => ({
                    ...prev,
                    lines: [...prev.lines, { ingredientId: "", quantity: "", unitCost: "" }],
                  }))
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add line
              </Button>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Notes</Label>
              <Textarea
                rows={2}
                value={poForm.notes}
                onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
                placeholder="Delivery instructions, payment terms…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setPoDialog(false)}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
              disabled={busy === "po"}
              onClick={submitPurchaseOrder}
            >
              <Factory className="mr-1.5 h-4 w-4" /> Create & send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Goods receipt dialog */}
      <Dialog open={Boolean(receiving)} onOpenChange={(open) => !open && setReceiving(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Receive {receiving?.orderNumber}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-500">
            Enter what actually arrived. Batch code and expiry are stored against the stock movement
            so you can trace spoilage.
          </p>
          <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {receiving?.items.map((line, index) => (
              <div key={`${line.ingredientId}-${index}`} className="rounded-lg border border-green-100 p-3">
                <p className="mb-2 text-xs font-medium text-gray-800">{line.name}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="mb-1 block text-[10px] text-gray-400">Received</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={receiptLines[index]?.receivedQuantity ?? ""}
                      onChange={(e) =>
                        setReceiptLines((prev) =>
                          prev.map((row, i) =>
                            i === index ? { ...row, receivedQuantity: e.target.value } : row,
                          ),
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-[10px] text-gray-400">Unit cost</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={receiptLines[index]?.unitCost ?? ""}
                      onChange={(e) =>
                        setReceiptLines((prev) =>
                          prev.map((row, i) =>
                            i === index ? { ...row, unitCost: e.target.value } : row,
                          ),
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-[10px] text-gray-400">Batch code</Label>
                    <Input
                      value={receiptLines[index]?.batchCode ?? ""}
                      onChange={(e) =>
                        setReceiptLines((prev) =>
                          prev.map((row, i) =>
                            i === index ? { ...row, batchCode: e.target.value } : row,
                          ),
                        )
                      }
                      placeholder="LOT-2409"
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-[10px] text-gray-400">Expiry</Label>
                    <Input
                      type="date"
                      value={receiptLines[index]?.expiryDate ?? ""}
                      onChange={(e) =>
                        setReceiptLines((prev) =>
                          prev.map((row, i) =>
                            i === index ? { ...row, expiryDate: e.target.value } : row,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setReceiving(null)}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
              disabled={busy === "receive"}
              onClick={submitReceipt}
            >
              <PackageCheck className="mr-1.5 h-4 w-4" /> Book into stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
