import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByRestaurant = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("staff")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", args.restaurantId),
      )
      .collect();
  },
});

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("staff")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const add = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    userId: v.optional(v.id("users")),
    role: v.union(
      v.literal("owner"),
      v.literal("manager"),
      v.literal("staff"),
    ),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if already added by email in this restaurant
    const existing = await ctx.db
      .query("staff")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", args.restaurantId),
      )
      .collect();
    const duplicate = existing.find(
      (s) => s.email.toLowerCase() === args.email.toLowerCase(),
    );
    if (duplicate) throw new Error("A staff member with this email already exists");

    return await ctx.db.insert("staff", {
      restaurantId: args.restaurantId,
      userId: args.userId,
      name: args.name,
      email: args.email,
      phone: args.phone,
      role: args.role,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const addByRestaurant = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    role: v.union(
      v.literal("owner"),
      v.literal("manager"),
      v.literal("staff"),
    ),
  },
  handler: async (ctx, args) => {
    // Check if already added by email in this restaurant
    const existing = await ctx.db
      .query("staff")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", args.restaurantId),
      )
      .collect();
    const duplicate = existing.find(
      (s) => s.email.toLowerCase() === args.email.toLowerCase(),
    );
    if (duplicate) throw new Error("A staff member with this email already exists");

    return await ctx.db.insert("staff", {
      restaurantId: args.restaurantId,
      name: args.name,
      email: args.email,
      phone: args.phone,
      role: args.role,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const updateRole = mutation({
  args: {
    id: v.id("staff"),
    role: v.union(
      v.literal("owner"),
      v.literal("manager"),
      v.literal("staff"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { role: args.role });
  },
});

export const deactivate = mutation({
  args: { id: v.id("staff") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: false });
  },
});

export const activate = mutation({
  args: { id: v.id("staff") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: true });
  },
});

export const remove = mutation({
  args: { id: v.id("staff") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
