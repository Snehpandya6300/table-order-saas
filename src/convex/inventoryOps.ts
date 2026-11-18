import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Deducts recipe ingredients from stock for every billed order line and writes
 * an immutable ledger entry per ingredient. Stock is clamped at zero: an
 * over-sell is visible as a low-stock/zero-stock signal rather than a hard
 * failure that would block a paying customer's order.
 */
export async function deductOrderIngredients(
  ctx: MutationCtx,
  restaurantId: Id<"restaurants">,
  lines: { menuItemId: Id<"menuItems">; quantity: number }[],
  orderId: Id<"orders">,
): Promise<void> {
  if (lines.length === 0) return;

  // Aggregate requirements so a multi-line order writes one movement per
  // ingredient instead of one per dish.
  const required = new Map<Id<"ingredients">, number>();
  for (const line of lines) {
    const item = await ctx.db.get(line.menuItemId);
    if (!item?.recipe || item.recipe.length === 0) continue;
    for (const part of item.recipe) {
      const qty = part.quantity * line.quantity;
      required.set(part.ingredientId, (required.get(part.ingredientId) ?? 0) + qty);
    }
  }

  const now = Date.now();
  for (const [ingredientId, quantity] of required) {
    const ingredient = await ctx.db.get(ingredientId);
    if (!ingredient || ingredient.restaurantId !== restaurantId) continue;
    if (quantity <= 0) continue;

    const consumed = Math.min(quantity, ingredient.currentStock);
    await ctx.db.patch(ingredientId, {
      currentStock: Math.max(0, ingredient.currentStock - quantity),
    });

    await ctx.db.insert("stockMovements", {
      restaurantId,
      ingredientId,
      type: "deduction",
      quantity: -quantity,
      unitCost: ingredient.costPerUnit,
      orderId,
      reason: consumed < quantity ? "Order billed (stock had a shortfall)" : "Order billed",
      createdAt: now,
    });
  }
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Recipe cost for a single dish, using current ingredient unit costs. */
export function recipeCost(
  recipe: { ingredientId: Id<"ingredients">; quantity: number }[] | undefined,
  costs: Map<Id<"ingredients">, number>,
): number {
  if (!recipe) return 0;
  return round2(
    recipe.reduce(
      (sum, line) => sum + (costs.get(line.ingredientId) ?? 0) * line.quantity,
      0,
    ),
  );
}
