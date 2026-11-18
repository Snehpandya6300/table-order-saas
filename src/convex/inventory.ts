import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { round2 } from "./inventoryOps";

const UNITS = [
  "g",
  "kg",
  "ml",
  "l",
  "pcs",
  "portion",
  "pack",
  "box",
] as const;

export const units = UNITS;

// ── Suppliers ────────────────────────────────────────────────────────────

export const listSuppliers = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("suppliers")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
      .collect();
  },
});

export const createSupplier = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new Error("Supplier name is required");
    return await ctx.db.insert("suppliers", {
      restaurantId: args.restaurantId,
      name,
      phone: args.phone?.trim() || undefined,
      email: args.email?.trim() || undefined,
      address: args.address?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const updateSupplier = mutation({
  args: {
    id: v.id("suppliers"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    await ctx.db.patch(id, rest);
  },
});

export const removeSupplier = mutation({
  args: { id: v.id("suppliers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// ── Ingredients ──────────────────────────────────────────────────────────

export const listIngredients = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("ingredients")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
      .collect();
    return items.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const createIngredient = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    name: v.string(),
    unit: v.string(),
    category: v.optional(v.string()),
    currentStock: v.number(),
    parLevel: v.number(),
    costPerUnit: v.number(),
    supplierId: v.optional(v.id("suppliers")),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new Error("Ingredient name is required");
    if (args.currentStock < 0) throw new Error("Opening stock cannot be negative");
    if (args.costPerUnit < 0) throw new Error("Cost cannot be negative");

    const ingredientId = await ctx.db.insert("ingredients", {
      restaurantId: args.restaurantId,
      name,
      unit: args.unit,
      category: args.category?.trim() || undefined,
      currentStock: args.currentStock,
      parLevel: args.parLevel,
      costPerUnit: args.costPerUnit,
      supplierId: args.supplierId,
      isActive: true,
      createdAt: Date.now(),
    });

    if (args.currentStock > 0) {
      await ctx.db.insert("stockMovements", {
        restaurantId: args.restaurantId,
        ingredientId,
        type: "adjustment",
        quantity: args.currentStock,
        unitCost: args.costPerUnit,
        reason: "Opening stock",
        createdAt: Date.now(),
      });
    }
    return ingredientId;
  },
});

export const updateIngredient = mutation({
  args: {
    id: v.id("ingredients"),
    name: v.optional(v.string()),
    unit: v.optional(v.string()),
    category: v.optional(v.string()),
    parLevel: v.optional(v.number()),
    costPerUnit: v.optional(v.number()),
    supplierId: v.optional(v.id("suppliers")),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    await ctx.db.patch(id, rest);
  },
});

export const adjustStock = mutation({
  args: {
    id: v.id("ingredients"),
    // Positive adds stock, negative removes it.
    quantity: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.quantity === 0) throw new Error("Adjustment quantity cannot be zero");
    const ingredient = await ctx.db.get(args.id);
    if (!ingredient) throw new Error("Ingredient not found");
    const next = ingredient.currentStock + args.quantity;
    if (next < 0) throw new Error("Adjustment would make stock negative");

    await ctx.db.patch(args.id, { currentStock: next });
    await ctx.db.insert("stockMovements", {
      restaurantId: ingredient.restaurantId,
      ingredientId: args.id,
      type: "adjustment",
      quantity: args.quantity,
      unitCost: ingredient.costPerUnit,
      reason: args.reason.trim() || "Manual adjustment",
      createdAt: Date.now(),
    });
  },
});

export const logWaste = mutation({
  args: {
    id: v.id("ingredients"),
    quantity: v.number(),
    reason: v.string(),
    batchCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.quantity <= 0) throw new Error("Waste quantity must be greater than zero");
    const ingredient = await ctx.db.get(args.id);
    if (!ingredient) throw new Error("Ingredient not found");
    if (args.quantity > ingredient.currentStock) {
      throw new Error(
        `Cannot waste ${args.quantity} ${ingredient.unit} — only ${ingredient.currentStock} in stock`,
      );
    }

    await ctx.db.patch(args.id, {
      currentStock: round2(ingredient.currentStock - args.quantity),
    });
    await ctx.db.insert("stockMovements", {
      restaurantId: ingredient.restaurantId,
      ingredientId: args.id,
      type: "waste",
      quantity: -args.quantity,
      unitCost: ingredient.costPerUnit,
      batchCode: args.batchCode?.trim() || undefined,
      reason: args.reason.trim() || "Waste",
      createdAt: Date.now(),
    });
  },
});

export const removeIngredient = mutation({
  args: { id: v.id("ingredients") },
  handler: async (ctx, args) => {
    const usedIn = await ctx.db.query("menuItems").collect();
    const linked = usedIn.some((item) =>
      (item.recipe ?? []).some((line) => line.ingredientId === args.id),
    );
    if (linked) {
      throw new Error(
        "This ingredient is used in a recipe. Remove it from recipes before deleting.",
      );
    }
    await ctx.db.delete(args.id);
  },
});

// ── Recipes & costing ────────────────────────────────────────────────────

export const setRecipe = mutation({
  args: {
    menuItemId: v.id("menuItems"),
    lines: v.array(
      v.object({
        ingredientId: v.id("ingredients"),
        quantity: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.menuItemId);
    if (!item) throw new Error("Menu item not found");

    const deduped = new Map<string, number>();
    for (const line of args.lines) {
      const ingredient = await ctx.db.get(line.ingredientId);
      if (!ingredient || ingredient.restaurantId !== item.restaurantId) {
        throw new Error("Recipe contains an ingredient from another restaurant");
      }
      if (line.quantity <= 0) throw new Error("Recipe quantities must be greater than zero");
      deduped.set(line.ingredientId, (deduped.get(line.ingredientId) ?? 0) + line.quantity);
    }

    await ctx.db.patch(args.menuItemId, {
      recipe: [...deduped].map(([ingredientId, quantity]) => ({
        ingredientId: ingredientId as Id<"ingredients">,
        quantity: round2(quantity),
      })),
    });
  },
});

export const getMenuCosting = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    const [ingredients, items] = await Promise.all([
      ctx.db
        .query("ingredients")
        .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
        .collect(),
      ctx.db
        .query("menuItems")
        .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
        .collect(),
    ]);
    const byId = new Map(ingredients.map((i) => [i._id, i]));

    return items
      .map((item) => {
        const recipe = item.recipe ?? [];
        const cost = round2(
          recipe.reduce(
            (sum, line) => sum + (byId.get(line.ingredientId)?.costPerUnit ?? 0) * line.quantity,
            0,
          ),
        );
        const margin = item.price > 0 ? round2(((item.price - cost) / item.price) * 100) : 0;
        return {
          _id: item._id,
          name: item.name,
          price: item.price,
          cost,
          margin,
          hasRecipe: recipe.length > 0,
          recipe: recipe.map((line) => ({
            ingredientId: line.ingredientId,
            name: byId.get(line.ingredientId)?.name ?? "Unknown ingredient",
            unit: byId.get(line.ingredientId)?.unit ?? "",
            quantity: line.quantity,
            cost: round2(
              (byId.get(line.ingredientId)?.costPerUnit ?? 0) * line.quantity,
            ),
          })),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

// ── Purchase orders & goods receipts ─────────────────────────────────────

export const listPurchaseOrders = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
      .order("desc")
      .collect();
    return orders;
  },
});

export const createPurchaseOrder = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    supplierId: v.optional(v.id("suppliers")),
    supplierName: v.string(),
    items: v.array(
      v.object({
        ingredientId: v.id("ingredients"),
        quantity: v.number(),
        unitCost: v.number(),
      }),
    ),
    notes: v.optional(v.string()),
    expectedAt: v.optional(v.string()),
    send: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.items.length === 0) throw new Error("Add at least one item to the purchase order");

    const lines = [];
    for (const line of args.items) {
      const ingredient = await ctx.db.get(line.ingredientId);
      if (!ingredient || ingredient.restaurantId !== args.restaurantId) {
        throw new Error("Purchase order contains an unknown ingredient");
      }
      if (line.quantity <= 0) throw new Error("Order quantities must be greater than zero");
      if (line.unitCost < 0) throw new Error("Unit cost cannot be negative");
      lines.push({
        ingredientId: line.ingredientId,
        name: ingredient.name,
        quantity: line.quantity,
        unitCost: line.unitCost,
      });
    }

    const existing = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
      .collect();

    const total = round2(
      lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0),
    );

    return await ctx.db.insert("purchaseOrders", {
      restaurantId: args.restaurantId,
      supplierId: args.supplierId,
      supplierName: args.supplierName.trim() || "Unassigned supplier",
      orderNumber: `PO-${String(existing.length + 1).padStart(4, "0")}`,
      status: args.send ? "sent" : "draft",
      items: lines,
      total,
      notes: args.notes?.trim() || undefined,
      expectedAt: args.expectedAt || undefined,
      createdAt: Date.now(),
    });
  },
});

export const setPurchaseOrderStatus = mutation({
  args: {
    id: v.id("purchaseOrders"),
    status: v.union(v.literal("sent"), v.literal("cancelled")),
  },
  handler: async (ctx, args) => {
    const po = await ctx.db.get(args.id);
    if (!po) throw new Error("Purchase order not found");
    if (po.status === "received") {
      throw new Error("A received purchase order cannot be changed");
    }
    await ctx.db.patch(args.id, { status: args.status });
  },
});

/**
 * Goods receipt: books received quantities into stock with batch/expiry per
 * line, updates the moving average unit cost, and closes the purchase order.
 * Partial receipts are supported — unreceived quantities are simply dropped
 * from the PO line, keeping the ledger honest.
 */
export const receivePurchaseOrder = mutation({
  args: {
    id: v.id("purchaseOrders"),
    items: v.array(
      v.object({
        ingredientId: v.id("ingredients"),
        receivedQuantity: v.number(),
        batchCode: v.optional(v.string()),
        expiryDate: v.optional(v.string()),
        unitCost: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const po = await ctx.db.get(args.id);
    if (!po) throw new Error("Purchase order not found");
    if (po.status === "received") throw new Error("This purchase order was already received");

    const now = Date.now();
    const receivedLines: {
      ingredientId: Id<"ingredients">;
      receivedQuantity: number;
      unitCost: number;
      batchCode?: string;
      expiryDate?: string;
    }[] = [];

    for (const receipt of args.items) {
      if (receipt.receivedQuantity < 0) throw new Error("Received quantity cannot be negative");
      const ingredient = await ctx.db.get(receipt.ingredientId);
      if (!ingredient) throw new Error("Ingredient not found");

      if (receipt.receivedQuantity > 0) {
        const newStock = round2(ingredient.currentStock + receipt.receivedQuantity);
        const movingAverage =
          newStock > 0
            ? round2(
                (ingredient.currentStock * ingredient.costPerUnit +
                  receipt.receivedQuantity * receipt.unitCost) /
                  newStock,
              )
            : receipt.unitCost;

        await ctx.db.patch(receipt.ingredientId, {
          currentStock: newStock,
          costPerUnit: movingAverage,
        });
        await ctx.db.insert("stockMovements", {
          restaurantId: po.restaurantId,
          ingredientId: receipt.ingredientId,
          type: "purchase",
          quantity: receipt.receivedQuantity,
          unitCost: receipt.unitCost,
          batchCode: receipt.batchCode?.trim() || undefined,
          expiryDate: receipt.expiryDate || undefined,
          reason: `Goods receipt ${po.orderNumber}`,
          purchaseOrderId: po._id,
          createdAt: now,
        });
      }

      receivedLines.push({
        ingredientId: receipt.ingredientId,
        receivedQuantity: receipt.receivedQuantity,
        unitCost: receipt.unitCost,
        batchCode: receipt.batchCode?.trim() || undefined,
        expiryDate: receipt.expiryDate || undefined,
      });
    }

    await ctx.db.patch(args.id, {
      status: "received",
      receivedAt: now,
      items: po.items.map((line) => {
        const receipt = receivedLines.find((r) => r.ingredientId === line.ingredientId);
        if (!receipt) return line;
        return {
          ...line,
          receivedQuantity: receipt.receivedQuantity,
          unitCost: receipt.unitCost,
          batchCode: receipt.batchCode,
          expiryDate: receipt.expiryDate,
        };
      }),
    });
  },
});

// ── Ledger & dashboard summary ───────────────────────────────────────────

export const listMovements = query({
  args: {
    restaurantId: v.id("restaurants"),
    ingredientId: v.optional(v.id("ingredients")),
    type: v.optional(
      v.union(
        v.literal("purchase"),
        v.literal("deduction"),
        v.literal("waste"),
        v.literal("adjustment"),
        v.literal("return"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 200, 500);
    let rows;
    if (args.ingredientId) {
      rows = await ctx.db
        .query("stockMovements")
        .withIndex("by_ingredient", (q) => q.eq("ingredientId", args.ingredientId!))
        .order("desc")
        .take(limit);
    } else {
      rows = await ctx.db
        .query("stockMovements")
        .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
        .order("desc")
        .take(limit);
    }
    if (args.type) rows = rows.filter((row) => row.type === args.type);

    const ingredientIds = [...new Set(rows.map((row) => row.ingredientId))];
    const ingredients = await Promise.all(ingredientIds.map((id) => ctx.db.get(id)));
    const names = new Map(ingredients.filter(Boolean).map((i) => [i!._id, i!.name]));
    const units = new Map(ingredients.filter(Boolean).map((i) => [i!._id, i!.unit]));

    return rows.map((row) => ({
      ...row,
      ingredientName: names.get(row.ingredientId) ?? "Deleted ingredient",
      unit: units.get(row.ingredientId) ?? "",
    }));
  },
});

export const getSummary = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    const [ingredients, suppliers, purchaseOrders] = await Promise.all([
      ctx.db
        .query("ingredients")
        .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
        .collect(),
      ctx.db
        .query("suppliers")
        .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
        .collect(),
      ctx.db
        .query("purchaseOrders")
        .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
        .collect(),
    ]);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const movements = await ctx.db
      .query("stockMovements")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
      .collect();

    const wasteThisMonth = movements.filter(
      (m) => m.type === "waste" && m.createdAt >= monthStart.getTime(),
    );
    const stockValue = round2(
      ingredients.reduce((sum, i) => sum + i.currentStock * i.costPerUnit, 0),
    );

    return {
      ingredientCount: ingredients.length,
      stockValue,
      lowStock: ingredients
        .filter((i) => i.isActive && i.currentStock <= i.parLevel)
        .sort((a, b) => a.currentStock / (a.parLevel || 1) - b.currentStock / (b.parLevel || 1)),
      outOfStock: ingredients.filter((i) => i.isActive && i.currentStock <= 0).length,
      supplierCount: suppliers.length,
      openPurchaseOrders: purchaseOrders.filter(
        (po) => po.status === "draft" || po.status === "sent",
      ).length,
      wasteThisMonthValue: round2(
        wasteThisMonth.reduce(
          (sum, m) => sum + Math.abs(m.quantity) * (m.unitCost ?? 0),
          0,
        ),
      ),
      wasteThisMonthEntries: wasteThisMonth.length,
    };
  },
});
