import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
    return {
      totalTables: tables.length,
      activeTables: tables.filter((t) => t.isActive).length,
    };
  },
});
