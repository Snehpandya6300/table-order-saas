import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByRestaurant = query({
  args: {
    restaurantId: v.id("restaurants"),
    status: v.optional(
      v.union(
        v.literal("received"),
        v.literal("accepted"),
        v.literal("preparing"),
        v.literal("ready"),
        v.literal("served"),
        v.literal("cancelled"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("orders")
      .withIndex("by_restaurant", (qt) =>
        qt.eq("restaurantId", args.restaurantId),
      )
      .order("desc");
    if (args.status) {
      const all = await q.collect();
      return all.filter((o) => o.status === args.status);
    }
    return await q.collect();
  },
});

export const getById = query({
  args: { id: v.id("orders") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByTable = query({
  args: { tableId: v.id("tables") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    tableId: v.id("tables"),
    tableLabel: v.string(),
    customerName: v.optional(v.string()),
    customerPhone: v.string(),
    items: v.array(
      v.object({
        menuItemId: v.id("menuItems"),
        name: v.string(),
        price: v.number(),
        quantity: v.number(),
        note: v.optional(v.string()),
      }),
    ),
    totalAmount: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("orders", {
      ...args,
      status: "received",
      createdAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("orders"),
    status: v.union(
      v.literal("received"),
      v.literal("accepted"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("served"),
      v.literal("cancelled"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const getStats = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
      .collect();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const todayOrders = orders.filter((o) => o.createdAt >= todayStart);
    return {
      totalOrders: orders.length,
      todayOrders: todayOrders.length,
      todayRevenue: todayOrders.reduce((sum, o) => sum + o.totalAmount, 0),
      pendingOrders: orders.filter((o) => o.status === "received").length,
    };
  },
});
