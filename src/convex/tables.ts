import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const PLAN_MAX_TABLES: Record<string, number> = {
  free: 5,
  pro: 10,
  enterprise: 999,
};

export const getByRestaurant = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tables")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", args.restaurantId),
      )
      .order("asc")
      .collect();
  },
});

export const getByQrToken = query({
  args: { qrToken: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tables")
      .withIndex("by_qrToken", (q) => q.eq("qrToken", args.qrToken))
      .first();
  },
});

export const create = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    // Enforce table limits based on subscription plan
    const restaurant = await ctx.db.get(args.restaurantId);
    if (!restaurant) throw new Error("Restaurant not found");

    const plan = restaurant.subscriptionPlan ?? "free";
    const maxTables = restaurant.maxTables ?? PLAN_MAX_TABLES[plan] ?? 5;

    const existingTables = await ctx.db
      .query("tables")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
      .collect();

    if (existingTables.length >= maxTables) {
      const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
      throw new Error(
        `Table limit reached (${maxTables}). Upgrade to ${plan === "free" ? "Pro" : "Enterprise"} plan to add more tables.`,
      );
    }

    const qrToken = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    return await ctx.db.insert("tables", {
      restaurantId: args.restaurantId,
      label: args.label,
      qrToken,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("tables"),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { label: args.label });
  },
});

export const toggleActive = mutation({
  args: { id: v.id("tables") },
  handler: async (ctx, args) => {
    const table = await ctx.db.get(args.id);
    if (!table) throw new Error("Table not found");
    await ctx.db.patch(args.id, { isActive: !table.isActive });
  },
});

export const remove = mutation({
  args: { id: v.id("tables") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const regenerateQr = mutation({
  args: { id: v.id("tables") },
  handler: async (ctx, args) => {
    const qrToken = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    await ctx.db.patch(args.id, { qrToken });
  },
});

export const getStats = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    const tables = await ctx.db
      .query("tables")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", args.restaurantId),
      )
      .collect();

    const restaurant = await ctx.db.get(args.restaurantId);
    const plan = restaurant?.subscriptionPlan ?? "free";
    const maxTables = restaurant?.maxTables ?? PLAN_MAX_TABLES[plan] ?? 5;

    return {
      totalTables: tables.length,
      activeTables: tables.filter((t) => t.isActive).length,
      maxTables,
      plan,
      canAddTable: tables.length < maxTables,
    };
  },
});
