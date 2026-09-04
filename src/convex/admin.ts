import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Plan limits configuration
export const PLAN_LIMITS = {
  free: { maxTables: 5, label: "Free", price: 0 },
  pro: { maxTables: 10, label: "Pro", price: 29 },
  enterprise: { maxTables: 999, label: "Enterprise", price: 79 },
} as const;

// Get plan limits for a restaurant
export const getPlanLimits = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    const restaurant = await ctx.db.get(args.restaurantId);
    if (!restaurant) return null;

    const plan = restaurant.subscriptionPlan ?? "free";
    const limits = PLAN_LIMITS[plan];

    // Always use the plan's standard limit.
    // restaurant.maxTables is only used when explicitly set by admin
    // to a value different from any plan default.
    const maxTables = limits.maxTables;

    // Count current tables
    const tables = await ctx.db
      .query("tables")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
      .collect();

    return {
      plan,
      planLabel: limits.label,
      price: limits.price,
      maxTables,
      currentTables: tables.length,
      canAddTable: tables.length < maxTables,
      subscriptionStatus: restaurant.subscriptionStatus ?? "trial",
      subscriptionEndsAt: restaurant.subscriptionEndsAt,
    };
  },
});

// Super admin: list all restaurants with stats
export const listRestaurants = query({
  args: { adminUserId: v.id("users") },
  handler: async (ctx, args) => {
    // Verify the user is an admin
    const user = await ctx.db.get(args.adminUserId);
    if (!user || user.role !== "admin") return [];

    const restaurants = await ctx.db.query("restaurants").collect();

    const restaurantsWithStats = await Promise.all(
      restaurants.map(async (r) => {
        // Count tables
        const tables = await ctx.db
          .query("tables")
          .withIndex("by_restaurant", (q) => q.eq("restaurantId", r._id))
          .collect();

        // Count orders
        const orders = await ctx.db
          .query("orders")
          .withIndex("by_restaurant", (q) => q.eq("restaurantId", r._id))
          .collect();

        // Count menu items
        const menuItems = await ctx.db
          .query("menuItems")
          .withIndex("by_restaurant", (q) => q.eq("restaurantId", r._id))
          .collect();

        // Count staff
        const staff = await ctx.db
          .query("staff")
          .withIndex("by_restaurant", (q) => q.eq("restaurantId", r._id))
          .collect();

        // Get owner info
        const owner = await ctx.db.get(r.ownerId);

        const plan = r.subscriptionPlan ?? "free";
        const planLimits = PLAN_LIMITS[plan];

        return {
          _id: r._id,
          name: r.name,
          slug: r.slug,
          description: r.description,
          isOpen: r.isOpen,
          createdAt: r.createdAt,
          subscriptionStatus: r.subscriptionStatus ?? "trial",
          subscriptionPlan: plan,
          planLabel: planLimits.label,
          planPrice: planLimits.price,
          maxTables: r.maxTables ?? planLimits.maxTables,
          suspendedAt: r.suspendedAt,
          suspendedReason: r.suspendedReason,
          ownerName: owner?.name ?? "Unknown",
          ownerEmail: owner?.email ?? "Unknown",
          stats: {
            tables: tables.length,
            activeTables: tables.filter((t) => t.isActive).length,
            orders: orders.length,
            menuItems: menuItems.length,
            staff: staff.length,
            totalRevenue: orders
              .filter((o) => o.paymentStatus === "paid")
              .reduce((sum, o) => sum + o.totalAmount, 0),
          },
        };
      }),
    );

    return restaurantsWithStats;
  },
});

// Super admin: update a restaurant's subscription plan
export const updateSubscription = mutation({
  args: {
    adminUserId: v.id("users"),
    restaurantId: v.id("restaurants"),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    maxTables: v.optional(v.number()),
    subscriptionStatus: v.optional(
      v.union(v.literal("active"), v.literal("trial"), v.literal("expired")),
    ),
  },
  handler: async (ctx, args) => {
    // Verify admin
    const user = await ctx.db.get(args.adminUserId);
    if (!user || user.role !== "admin") throw new Error("Unauthorized");

    const restaurant = await ctx.db.get(args.restaurantId);
    if (!restaurant) throw new Error("Restaurant not found");

    const planLimits = PLAN_LIMITS[args.plan];

    await ctx.db.patch(args.restaurantId, {
      subscriptionPlan: args.plan,
      maxTables: args.maxTables ?? planLimits.maxTables,
      subscriptionStatus: args.subscriptionStatus ?? "active",
    });

    return { success: true };
  },
});

// Super admin: suspend or activate a restaurant
export const toggleRestaurantStatus = mutation({
  args: {
    adminUserId: v.id("users"),
    restaurantId: v.id("restaurants"),
    suspend: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.adminUserId);
    if (!user || user.role !== "admin") throw new Error("Unauthorized");

    if (args.suspend) {
      await ctx.db.patch(args.restaurantId, {
        isOpen: false,
        subscriptionStatus: "suspended",
        suspendedAt: Date.now(),
        suspendedReason: args.reason,
      });
    } else {
      await ctx.db.patch(args.restaurantId, {
        isOpen: true,
        subscriptionStatus: "active",
        suspendedAt: undefined,
        suspendedReason: undefined,
      });
    }

    return { success: true };
  },
});

// Super admin: update platform settings
export const updateSetting = mutation({
  args: {
    adminUserId: v.id("users"),
    key: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.adminUserId);
    if (!user || user.role !== "admin") throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("adminSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
    } else {
      await ctx.db.insert("adminSettings", {
        key: args.key,
        value: args.value,
      });
    }

    return { success: true };
  },
});

// Super admin: get platform settings
export const getSetting = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("adminSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    return setting?.value ?? null;
  },
});

// Initialize default subscription plans (run once)
export const initPlans = mutation({
  args: { adminUserId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.adminUserId);
    if (!user || user.role !== "admin") throw new Error("Unauthorized");

    const plans = [
      {
        id: "free",
        name: "Free",
        price: 0,
        maxTables: 5,
        features: [
          "Up to 5 tables",
          "Basic menu management",
          "Order management",
          "QR code generation",
          "Basic analytics",
        ],
        isActive: true,
      },
      {
        id: "pro",
        name: "Pro",
        price: 29,
        maxTables: 10,
        features: [
          "Up to 10 tables",
          "Menu with images",
          "Order management",
          "QR code generation",
          "Staff management",
          "Payment tracking",
          "Advanced analytics",
          "AI menu scanner",
        ],
        isActive: true,
      },
      {
        id: "enterprise",
        name: "Enterprise",
        price: 79,
        maxTables: 999,
        features: [
          "Unlimited tables",
          "Everything in Pro",
          "Bulk menu import",
          "Priority support",
          "Custom branding",
          "API access",
          "Multi-location",
          "Dedicated support",
        ],
        isActive: true,
      },
    ];

    for (const plan of plans) {
      const existing = await ctx.db
        .query("subscriptionPlans")
        .withIndex("by_planId", (q) => q.eq("id", plan.id))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, plan);
      } else {
        await ctx.db.insert("subscriptionPlans", plan);
      }
    }

    return { success: true, plans };
  },
});

// Get all subscription plans (public)
export const getPlans = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("subscriptionPlans").collect();
  },
});

// Get platform-wide stats for super admin
export const getPlatformStats = query({
  args: { adminUserId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.adminUserId);
    if (!user || user.role !== "admin") return null;

    const restaurants = await ctx.db.query("restaurants").collect();
    const allOrders = await ctx.db.query("orders").collect();
    const allUsers = await ctx.db.query("users").collect();

    const totalRevenue = allOrders
      .filter((o) => o.paymentStatus === "paid")
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const planCounts = { free: 0, pro: 0, enterprise: 0 };
    for (const r of restaurants) {
      const plan = (r.subscriptionPlan ?? "free") as keyof typeof planCounts;
      planCounts[plan]++;
    }

    return {
      totalRestaurants: restaurants.length,
      activeRestaurants: restaurants.filter((r) => r.isOpen).length,
      totalOrders: allOrders.length,
      totalUsers: allUsers.length,
      totalRevenue,
      planCounts,
      trialRestaurants: restaurants.filter((r) => r.subscriptionStatus === "trial").length,
      activeSubscriptions: restaurants.filter((r) => r.subscriptionStatus === "active").length,
      expiredSubscriptions: restaurants.filter((r) => r.subscriptionStatus === "expired").length,
      suspendedRestaurants: restaurants.filter((r) => r.subscriptionStatus === "suspended").length,
    };
  },
});
