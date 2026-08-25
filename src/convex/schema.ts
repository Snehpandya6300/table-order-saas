import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(v.union(v.literal("admin"), v.literal("owner"), v.literal("staff"), v.literal("customer"))),
  }).index("email", ["email"]),

  restaurants: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    coverUrl: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    ownerId: v.id("users"),
    isOpen: v.boolean(),
    subscriptionStatus: v.optional(v.union(v.literal("active"), v.literal("trial"), v.literal("expired"))),
    subscriptionEndsAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_slug", ["slug"]),

  categories: defineTable({
    restaurantId: v.id("restaurants"),
    name: v.string(),
    sortOrder: v.number(),
    isVisible: v.boolean(),
  }).index("by_restaurant", ["restaurantId"]),

  menuItems: defineTable({
    restaurantId: v.id("restaurants"),
    categoryId: v.id("categories"),
    name: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    imageUrl: v.optional(v.string()),
    isAvailable: v.boolean(),
    isVeg: v.boolean(),
    sortOrder: v.number(),
  }).index("by_restaurant", ["restaurantId"])
    .index("by_category", ["categoryId"]),

  tables: defineTable({
    restaurantId: v.id("restaurants"),
    label: v.string(),
    qrToken: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_restaurant", ["restaurantId"])
    .index("by_qrToken", ["qrToken"]),

  orders: defineTable({
    restaurantId: v.id("restaurants"),
    tableId: v.id("tables"),
    tableLabel: v.string(),
    customerName: v.optional(v.string()),
    customerPhone: v.string(),
    items: v.array(v.object({
      menuItemId: v.id("menuItems"),
      name: v.string(),
      price: v.number(),
      quantity: v.number(),
      note: v.optional(v.string()),
    })),
    totalAmount: v.number(),
    status: v.union(
      v.literal("received"),
      v.literal("accepted"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("served"),
      v.literal("cancelled"),
    ),
    createdAt: v.number(),
  })
    .index("by_restaurant", ["restaurantId", "createdAt"])
    .index("by_table", ["tableId"]),

  adminSettings: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),
});

export default schema;
