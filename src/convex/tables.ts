import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

function generateToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < 8; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export const getByRestaurant = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tables")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
      .collect();
  },
});

export const getByQrToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tables")
      .withIndex("by_qrToken", (q) => q.eq("qrToken", args.token))
      .first();
  },
});

export const create = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tables", {
      ...args,
      qrToken: generateToken(),
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const createMany = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    count: v.number(),
    labelPrefix: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const prefix = args.labelPrefix ?? "Table";
    const ids = [];
    for (let i = 0; i < args.count; i++) {
      const id = await ctx.db.insert("tables", {
        restaurantId: args.restaurantId,
        label: `${prefix} ${i + 1}`,
        qrToken: generateToken(),
        isActive: true,
        createdAt: Date.now(),
      });
      ids.push(id);
    }
    return ids;
  },
});

export const update = mutation({
  args: {
    id: v.id("tables"),
    label: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const regenerateQr = mutation({
  args: { id: v.id("tables") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { qrToken: generateToken() });
  },
});

export const remove = mutation({
  args: { id: v.id("tables") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
