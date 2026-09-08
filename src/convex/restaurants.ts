import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByOwner = query({
  args: { ownerId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("restaurants")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .collect();
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("restaurants")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const getById = query({
  args: { id: v.id("restaurants") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("restaurants").collect();
  },
});

// Get restaurants where the user is a staff member (not owner)
export const getByStaffEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // Find staff records matching this email
    const staffRecords = await ctx.db
      .query("staff")
      .collect();
    const matchingStaff = staffRecords.filter(
      (s) => s.email.toLowerCase() === args.email.toLowerCase() && s.isActive,
    );
    if (matchingStaff.length === 0) return [];

    // Get the restaurants for these staff records
    const restaurants = [];
    for (const staff of matchingStaff) {
      const restaurant = await ctx.db.get(staff.restaurantId);
      if (restaurant) {
        restaurants.push({
          ...restaurant,
          staffRole: staff.role,
          staffName: staff.name,
        });
      }
    }
    return restaurants;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    ownerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const restaurantId = await ctx.db.insert("restaurants", {
      ...args,      isOpen: true,
      subscriptionStatus: "trial",
      createdAt: Date.now(),
    });
    return restaurantId;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const update = mutation({
  args: {
    id: v.id("restaurants"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    coverUrl: v.optional(v.string()),
    isOpen: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});
