import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getById = query({
  args: { id: v.id("tokens") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByRestaurant = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tokens")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", args.restaurantId),
      )
      .order("desc")
      .collect();
  },
});

export const getActiveTokens = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    const tokens = await ctx.db
      .query("tokens")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", args.restaurantId),
      )
      .order("desc")
      .collect();
    return tokens.filter((t) => t.status === "active");
  },
});

export const create = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    customerPhone: v.optional(v.string()),
    customerName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get current token number and increment
    const restaurant = await ctx.db.get(args.restaurantId);
    if (!restaurant) throw new Error("Restaurant not found");

    const tokenNumber = restaurant.nextTokenNumber ?? 1;

    // Increment restaurant token counter
    await ctx.db.patch(args.restaurantId, {
      nextTokenNumber: tokenNumber + 1,
    });

    // Create token
    const tokenId = await ctx.db.insert("tokens", {
      restaurantId: args.restaurantId,
      tokenNumber,
      status: "active" as const,
      customerPhone: args.customerPhone,
      customerName: args.customerName,
      orderCount: 0,
      createdAt: Date.now(),
    });

    return { tokenId, tokenNumber };
  },
});

export const complete = mutation({
  args: { id: v.id("tokens") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "completed" });
  },
});

export const cancel = mutation({
  args: { id: v.id("tokens") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "cancelled" });
  },
});

export const incrementOrderCount = mutation({
  args: { id: v.id("tokens") },
  handler: async (ctx, args) => {
    const token = await ctx.db.get(args.id);
    if (!token) throw new Error("Token not found");
    await ctx.db.patch(args.id, { orderCount: token.orderCount + 1 });
  },
});

export const getStats = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    const tokens = await ctx.db
      .query("tokens")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", args.restaurantId),
      )
      .collect();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const todayTokens = tokens.filter((t) => t.createdAt >= todayStart);
    return {
      totalTokens: tokens.length,
      todayTokens: todayTokens.length,
      activeTokens: tokens.filter((t) => t.status === "active").length,
    };
  },
});
