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
    role: v.optional(
      v.union(
        v.literal("admin"),
        v.literal("owner"),
        v.literal("manager"),
        v.literal("staff"),
        v.literal("customer"),
      ),
    ),
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
    subscriptionStatus: v.optional(
      v.union(v.literal("active"), v.literal("trial"), v.literal("expired"), v.literal("suspended")),
    ),
    subscriptionPlan: v.optional(
      v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    ),
    subscriptionEndsAt: v.optional(v.number()),
    maxTables: v.optional(v.number()),
    suspendedAt: v.optional(v.number()),
    suspendedReason: v.optional(v.string()),
    nextTokenNumber: v.optional(v.number()),
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
  })
    .index("by_restaurant", ["restaurantId"])
    .index("by_category", ["categoryId"]),

  // Table-based ordering
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
        // Present when the line came from an aggregator menu item.
        externalItemId: v.optional(v.string()),
      }),
    ),
    totalAmount: v.number(),
    // Order source. Missing `source` on legacy rows means a direct QR order.
    source: v.optional(
      v.union(
        v.literal("qr"),
        v.literal("pos"),
        v.literal("aggregator"),
      ),
    ),
    channel: v.optional(
      v.union(
        v.literal("dine_in"),
        v.literal("delivery"),
        v.literal("takeaway"),
      ),
    ),
    // Third-party aggregator reference (Zomato / Swiggy / UrbanPiper / Petpooja)
    integrationId: v.optional(v.id("integrations")),
    externalPlatform: v.optional(v.string()),
    externalOrderId: v.optional(v.string()),
    externalStatus: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    customerAddress: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    // Money breakdown used for reconciliation
    subtotal: v.optional(v.number()),
    taxAmount: v.optional(v.number()),
    deliveryFee: v.optional(v.number()),
    commission: v.optional(v.number()),
    netSettlement: v.optional(v.number()),
    isPlatformPaid: v.optional(v.boolean()),
    deliveryStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("assigned"),
        v.literal("picked_up"),
        v.literal("delivered"),
        v.literal("cancelled"),
      ),
    ),
    // Kitchen stations the order was routed to
    stations: v.optional(v.array(v.string())),
    acceptedAt: v.optional(v.number()),
    readyAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    status: v.union(
      v.literal("received"),
      v.literal("accepted"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("served"),
      v.literal("cancelled"),
    ),
    // Payment tracking
    paymentStatus: v.optional(
      v.union(
        v.literal("unpaid"),
        v.literal("paid"),
        v.literal("refunded"),
      ),
    ),
    paymentMethod: v.optional(
      v.union(
        v.literal("cash"),
        v.literal("upi"),
        v.literal("card"),
        v.literal("online"),
      ),
    ),
    paidAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_restaurant", ["restaurantId", "createdAt"])
    .index("by_phone", ["customerPhone"])
    .index("by_external", ["integrationId", "externalOrderId"]),

  // Customer management
  customers: defineTable({
    restaurantId: v.id("restaurants"),
    name: v.optional(v.string()),
    phone: v.string(),
    email: v.optional(v.string()),
    totalOrders: v.number(),
    totalSpent: v.number(),
    lastOrderAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_restaurant", ["restaurantId"])
    .index("by_phone", ["restaurantId", "phone"]),

  // Staff management
  staff: defineTable({
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
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_restaurant", ["restaurantId"])
    .index("by_user", ["userId"]),

  // Super admin settings (platform config)
  adminSettings: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),

  // Platform subscription plans config
  subscriptionPlans: defineTable({
    id: v.string(),
    name: v.string(),
    price: v.number(),
    maxTables: v.number(),
    features: v.array(v.string()),
    isActive: v.boolean(),
  }).index("by_planId", ["id"]),

  // Phone OTP verification for customer orders
  phoneOtps: defineTable({
    restaurantId: v.id("restaurants"),
    phone: v.string(),
    code: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
    createdAt: v.number(),
  })
    .index("by_restaurant_phone", ["restaurantId", "phone"])
    .index("by_expiresAt", ["expiresAt"]),

  // Online ordering integrations (Zomato, Swiggy, UrbanPiper, Petpooja, custom)
  integrations: defineTable({
    restaurantId: v.id("restaurants"),
    platform: v.union(
      v.literal("zomato"),
      v.literal("swiggy"),
      v.literal("urbanpiper"),
      v.literal("petpooja"),
      v.literal("custom"),
    ),
    displayName: v.string(),
    // Public token used in the webhook URL
    webhookKey: v.string(),
    // HMAC-SHA256 signing secret shared with the aggregator
    webhookSecret: v.string(),
    // Outbound API credentials for status / menu sync (optional)
    apiKey: v.optional(v.string()),
    apiBaseUrl: v.optional(v.string()),
    // External outlet / branch this integration maps to
    outletId: v.optional(v.string()),
    isEnabled: v.boolean(),
    lastEventAt: v.optional(v.number()),
    lastSyncAt: v.optional(v.number()),
    lastVerifiedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    failureCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_restaurant", ["restaurantId"])
    .index("by_restaurant_platform", ["restaurantId", "platform"])
    .index("by_webhookKey", ["webhookKey"]),

  // Webhook delivery log + idempotency ledger
  aggregatorEvents: defineTable({
    integrationId: v.optional(v.id("integrations")),
    restaurantId: v.optional(v.id("restaurants")),
    platform: v.string(),
    webhookKey: v.string(),
    eventId: v.string(),
    eventType: v.string(),
    status: v.union(
      v.literal("processed"),
      v.literal("duplicate"),
      v.literal("rejected"),
      v.literal("unmapped"),
      v.literal("failed"),
    ),
    reason: v.optional(v.string()),
    externalOrderId: v.optional(v.string()),
    orderId: v.optional(v.id("orders")),
    payload: v.string(),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index("by_integration", ["integrationId"])
    .index("by_integration_event", ["integrationId", "eventId"])
    .index("by_restaurant", ["restaurantId"])
    .index("by_externalOrder", ["integrationId", "externalOrderId"]),

  // External menu item -> internal menu item mappings
  externalMenuMappings: defineTable({
    integrationId: v.id("integrations"),
    restaurantId: v.id("restaurants"),
    platform: v.string(),
    externalItemId: v.string(),
    externalItemName: v.string(),
    externalPrice: v.optional(v.number()),
    menuItemId: v.id("menuItems"),
    // Availability mirrored from the platform, if known
    isAvailable: v.boolean(),
    lastSyncedAt: v.number(),
  })
    .index("by_integration", ["integrationId"])
    .index("by_integration_external", ["integrationId", "externalItemId"])
    .index("by_menuItem", ["menuItemId"]),

  // Plan upgrade requests from restaurant owners
  planRequests: defineTable({
    restaurantId: v.id("restaurants"),
    restaurantName: v.string(),
    ownerName: v.string(),
    ownerEmail: v.string(),
    ownerPhone: v.optional(v.string()),
    currentPlan: v.string(),
    requestedPlan: v.string(),
    message: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("contacted"),
      v.literal("completed"),
    ),
    createdAt: v.number(),
  }).index("by_status", ["status"]),
});

export default schema;
