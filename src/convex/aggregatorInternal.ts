import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * Internal helpers used by the public actions in `aggregators.ts`.
 *
 * They live in their own module so the public API can reference them through
 * `internal.*` without creating a circular type dependency on itself.
 */

export const assertOwner = internalQuery({
  args: { restaurantId: v.id("restaurants"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const restaurant = await ctx.db.get(args.restaurantId);
    if (!restaurant) throw new Error("Restaurant not found");
    if (restaurant.ownerId !== args.userId) {
      throw new Error("Only the restaurant owner can manage online ordering");
    }
    return restaurant._id;
  },
});

export const findByRestaurantPlatform = internalQuery({
  args: {
    restaurantId: v.id("restaurants"),
    platform: v.union(
      v.literal("zomato"),
      v.literal("swiggy"),
      v.literal("urbanpiper"),
      v.literal("petpooja"),
      v.literal("custom"),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("integrations")
      .withIndex("by_restaurant_platform", (q) =>
        q.eq("restaurantId", args.restaurantId).eq("platform", args.platform),
      )
      .first();
  },
});

export const insertIntegration = internalMutation({
  args: {
    restaurantId: v.id("restaurants"),
    platform: v.union(
      v.literal("zomato"),
      v.literal("swiggy"),
      v.literal("urbanpiper"),
      v.literal("petpooja"),
      v.literal("custom"),
    ),
    displayName: v.string(),
    outletId: v.optional(v.string()),
    apiKey: v.optional(v.string()),
    apiBaseUrl: v.optional(v.string()),
    webhookKey: v.string(),
    webhookSecret: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("integrations", {
      restaurantId: args.restaurantId,
      platform: args.platform,
      displayName: args.displayName,
      outletId: args.outletId,
      apiKey: args.apiKey,
      apiBaseUrl: args.apiBaseUrl,
      webhookKey: args.webhookKey,
      webhookSecret: args.webhookSecret,
      isEnabled: true,
      failureCount: 0,
      createdAt: Date.now(),
    });
  },
});

export const getIntegrationForOwner = internalQuery({
  args: {
    integrationId: v.id("integrations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration) throw new Error("Integration not found");
    const restaurant = await ctx.db.get(integration.restaurantId);
    if (!restaurant || restaurant.ownerId !== args.userId) {
      throw new Error("Only the restaurant owner can view these credentials");
    }
    return integration;
  },
});

export const setWebhookSecret = internalMutation({
  args: { integrationId: v.id("integrations"), webhookSecret: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.integrationId, {
      webhookSecret: args.webhookSecret,
      lastError: undefined,
      failureCount: 0,
    });
  },
});

export const sampleMenuItems = internalQuery({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", args.restaurantId),
      )
      .collect();
    return items.slice(0, 2);
  },
});

export const getOrderForSync = internalQuery({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) return null;
    const restaurant = await ctx.db.get(order.restaurantId);
    const integration = order.integrationId
      ? await ctx.db.get(order.integrationId)
      : null;
    return {
      order,
      integration,
      ownerId: restaurant?.ownerId,
    };
  },
});

export const markSyncSuccess = internalMutation({
  args: { integrationId: v.id("integrations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.integrationId, {
      lastSyncAt: Date.now(),
      lastError: undefined,
      failureCount: 0,
    });
  },
});

export const markSyncFailure = internalMutation({
  args: { integrationId: v.id("integrations"), reason: v.string() },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration) return;
    await ctx.db.patch(args.integrationId, {
      lastError: args.reason,
      failureCount: integration.failureCount + 1,
      lastSyncAt: Date.now(),
    });
  },
});
