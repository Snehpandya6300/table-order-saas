import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByRestaurant = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customers")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", args.restaurantId),
      )
      .order("desc")
      .collect();
  },
});

export const getByPhone = query({
  args: {
    restaurantId: v.id("restaurants"),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customers")
      .withIndex("by_phone", (q) =>
        q.eq("restaurantId", args.restaurantId).eq("phone", args.phone),
      )
      .first();
  },
});

export const upsert = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    phone: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    orderAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("customers")
      .withIndex("by_phone", (q) =>
        q.eq("restaurantId", args.restaurantId).eq("phone", args.phone),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name || existing.name,
        email: args.email || existing.email,
        totalOrders: existing.totalOrders + 1,
        totalSpent: existing.totalSpent + args.orderAmount,
        lastOrderAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("customers", {
      restaurantId: args.restaurantId,
      phone: args.phone,
      name: args.name,
      email: args.email,
      totalOrders: 1,
      totalSpent: args.orderAmount,
      lastOrderAt: Date.now(),
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("customers"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const getStats = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    const customers = await ctx.db
      .query("customers")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", args.restaurantId),
      )
      .collect();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const newToday = customers.filter((c) => c.createdAt >= todayStart);
    return {
      totalCustomers: customers.length,
      newToday: newToday.length,
      totalRevenue: customers.reduce((sum, c) => sum + c.totalSpent, 0),
    };
  },
});
