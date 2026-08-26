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

export const getByIds = query({
  args: { ids: v.array(v.id("orders")) },
  handler: async (ctx, args) => {
    const orders = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
    return orders
      .filter((o) => o !== null)
      .sort((a, b) => b!.createdAt - a!.createdAt);
  },
});

export const getByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_phone", (q) => q.eq("customerPhone", args.phone))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    tableId: v.optional(v.id("tables")),
    tableLabel: v.optional(v.string()),
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
      restaurantId: args.restaurantId,
      tableId: args.tableId,
      tableLabel: args.tableLabel,
      customerName: args.customerName,
      customerPhone: args.customerPhone,
      items: args.items,
      totalAmount: args.totalAmount,
      status: "received",
      paymentStatus: "unpaid",
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

export const updatePayment = mutation({
  args: {
    id: v.id("orders"),
    paymentStatus: v.union(
      v.literal("unpaid"),
      v.literal("paid"),
      v.literal("refunded"),
    ),
    paymentMethod: v.optional(
      v.union(
        v.literal("cash"),
        v.literal("upi"),
        v.literal("card"),
        v.literal("online"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      paymentStatus: args.paymentStatus,
    };
    if (args.paymentMethod) updates.paymentMethod = args.paymentMethod;
    if (args.paymentStatus === "paid") updates.paidAt = Date.now();
    await ctx.db.patch(args.id, updates);
  },
});

export const getStats = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", args.restaurantId),
      )
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
      unpaidOrders: orders.filter((o) => o.paymentStatus === "unpaid").length,
      totalRevenue: orders.reduce((sum, o) => sum + o.totalAmount, 0),
    };
  },
});

export const getKotOrders = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", args.restaurantId),
      )
      .order("desc")
      .collect();
    return orders.filter(
      (o) =>
        o.status === "received" ||
        o.status === "accepted" ||
        o.status === "preparing",
    );
  },
});
