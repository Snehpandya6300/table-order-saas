import { v } from "convex/values";
import {
  action,
  mutation,
  query,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  PLATFORM_CATALOG,
  getPlatformDefinition,
  mapInternalStatusToPlatform,
  normalizeName,
  normalizeOrderPayload,
  type PlatformId,
} from "./aggregatorAdapters";
import { hmacHex, randomToken } from "./aggregatorSignature";
import type { IngestOutcome } from "./aggregatorIngest";

const platformValidator = v.union(
  v.literal("zomato"),
  v.literal("swiggy"),
  v.literal("urbanpiper"),
  v.literal("petpooja"),
  v.literal("custom"),
);

const eventStatusValidator = v.union(
  v.literal("processed"),
  v.literal("duplicate"),
  v.literal("rejected"),
  v.literal("unmapped"),
  v.literal("failed"),
);

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function requireOwner(
  ctx: QueryCtx | MutationCtx,
  restaurantId: Id<"restaurants">,
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Please sign in to manage online ordering");
  const restaurant = await ctx.db.get(restaurantId);
  if (!restaurant) throw new Error("Restaurant not found");
  if (restaurant.ownerId !== userId) {
    throw new Error("Only the restaurant owner can manage online ordering");
  }
  return restaurant;
}

/* ------------------------------------------------------------------ */
/* Queries                                                            */
/* ------------------------------------------------------------------ */

export const list = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.restaurantId);

    const integrations = await ctx.db
      .query("integrations")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
      .order("desc")
      .collect();
    const events = await ctx.db
      .query("aggregatorEvents")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
      .order("desc")
      .collect();

    return integrations.map((integration) => {
      const own = events.filter((event) => event.integrationId === integration._id);
      const failures = own.filter(
        (event) => event.status === "rejected" || event.status === "failed",
      );
      const unmapped = own.filter((event) => event.status === "unmapped");
      const duplicates = own.filter((event) => event.status === "duplicate");
      const lastProcessed = own.find((event) => event.status === "processed");

      let status: "connected" | "error" | "pending" | "disabled" = "pending";
      if (!integration.isEnabled) status = "disabled";
      else if (!integration.lastEventAt) status = "pending";
      else if (integration.lastError && integration.failureCount > 0) status = "error";
      else status = "connected";

      return {
        _id: integration._id,
        platform: integration.platform,
        displayName: integration.displayName,
        outletId: integration.outletId,
        isEnabled: integration.isEnabled,
        webhookKey: integration.webhookKey,
        hasApiCredentials: Boolean(integration.apiKey),
        apiBaseUrl: integration.apiBaseUrl,
        lastEventAt: integration.lastEventAt,
        lastSuccessfulSync: lastProcessed?.processedAt ?? integration.lastSyncAt,
        lastError: integration.lastError,
        failureCount: failures.length,
        unmappedCount: unmapped.length,
        duplicateCount: duplicates.length,
        eventsReceived: own.length,
        createdAt: integration.createdAt,
        status,
      };
    });
  },
});

export const logs = query({
  args: {
    restaurantId: v.id("restaurants"),
    integrationId: v.optional(v.id("integrations")),
    status: v.optional(eventStatusValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.restaurantId);

    const all = await ctx.db
      .query("aggregatorEvents")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
      .order("desc")
      .collect();

    let rows = all;
    if (args.integrationId) {
      rows = rows.filter((row) => row.integrationId === args.integrationId);
    }
    if (args.status) {
      rows = rows.filter((row) => row.status === args.status);
    }

    return rows.slice(0, args.limit ?? 40);
  },
});

export const mappings = query({
  args: { integrationId: v.id("integrations") },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration) return [];
    await requireOwner(ctx, integration.restaurantId);

    const rows = await ctx.db
      .query("externalMenuMappings")
      .withIndex("by_integration", (q) => q.eq("integrationId", args.integrationId))
      .collect();

    const result = [];
    for (const row of rows) {
      const menuItem = await ctx.db.get(row.menuItemId);
      result.push({
        ...row,
        menuItemName: menuItem?.name ?? "Missing menu item",
        menuItemAvailable: menuItem?.isAvailable ?? false,
        menuItemPrice: menuItem?.price ?? 0,
      });
    }
    return result.sort((a, b) => a.externalItemName.localeCompare(b.externalItemName));
  },
});

async function collectUnmappedItems(
  ctx: QueryCtx | MutationCtx,
  integration: Doc<"integrations">,
) {
  const events = await ctx.db
    .query("aggregatorEvents")
    .withIndex("by_integration", (q) => q.eq("integrationId", integration._id))
    .order("desc")
    .collect();

  const found = new Map<
    string,
    {
      externalItemId: string;
      name: string;
      count: number;
      lastSeen: number;
      externalOrderId?: string;
    }
  >();

  for (const event of events) {
    if (event.status !== "unmapped") continue;
    try {
      const payload = JSON.parse(event.payload) as Record<string, unknown>;
      const normalized = normalizeOrderPayload(integration.platform, payload);
      for (const item of normalized.items) {
        const existing = found.get(item.externalItemId);
        if (existing) {
          existing.count += 1;
          existing.lastSeen = Math.max(existing.lastSeen, event.receivedAt);
        } else {
          found.set(item.externalItemId, {
            externalItemId: item.externalItemId,
            name: item.name,
            count: 1,
            lastSeen: event.receivedAt,
            externalOrderId: normalized.externalOrderId,
          });
        }
      }
    } catch {
      // Malformed payloads are surfaced in the delivery log instead.
    }
  }

  return Array.from(found.values()).sort((a, b) => b.lastSeen - a.lastSeen);
}

export const pendingItems = query({
  args: { integrationId: v.id("integrations") },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration) return [];
    await requireOwner(ctx, integration.restaurantId);
    return await collectUnmappedItems(ctx, integration);
  },
});

export const report = query({
  args: {
    restaurantId: v.id("restaurants"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.restaurantId);
    const days = args.days ?? 30;
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const orders = (
      await ctx.db
        .query("orders")
        .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
        .collect()
    ).filter((order) => order.createdAt >= since);

    type Bucket = {
      orders: number;
      cancelled: number;
      rejected: number;
      refunded: number;
      gross: number;
      commission: number;
      net: number;
    };
    const emptyBucket = (): Bucket => ({
      orders: 0,
      cancelled: 0,
      rejected: 0,
      refunded: 0,
      gross: 0,
      commission: 0,
      net: 0,
    });

    const platforms = new Map<string, Bucket>();
    for (const platform of PLATFORM_CATALOG) {
      platforms.set(platform.id, emptyBucket());
    }
    const direct = emptyBucket();
    const aggregator = emptyBucket();

    for (const order of orders) {
      const isAggregator = order.source === "aggregator" || Boolean(order.integrationId);
      const bucket = isAggregator
        ? (platforms.get(order.externalPlatform ?? "custom") ?? emptyBucket())
        : null;

      for (const target of [isAggregator ? aggregator : direct, bucket]) {
        if (!target) continue;
        target.orders += 1;
        if (order.status === "cancelled") {
          target.cancelled += 1;
          if (order.rejectionReason) target.rejected += 1;
        }
        if (order.paymentStatus === "refunded") target.refunded += 1;
        target.gross += order.totalAmount;
        target.commission += order.commission ?? 0;
        target.net +=
          order.netSettlement ??
          (isAggregator ? order.totalAmount - (order.commission ?? 0) : order.totalAmount);
      }
    }

    const summarise = (bucket: Bucket) => ({
      orders: bucket.orders,
      cancelled: bucket.cancelled,
      rejected: bucket.rejected,
      refunded: bucket.refunded,
      gross: round2(bucket.gross),
      commission: round2(bucket.commission),
      net: round2(bucket.net),
      aov: bucket.orders > 0 ? round2(bucket.gross / bucket.orders) : 0,
      cancellationRate:
        bucket.orders > 0 ? round2((bucket.cancelled / bucket.orders) * 100) : 0,
    });

    const platformRows = PLATFORM_CATALOG.map((definition) => {
      const bucket = platforms.get(definition.id) ?? emptyBucket();
      return {
        platform: definition.id,
        name: definition.name,
        color: definition.brandColor,
        ...summarise(bucket),
      };
    }).filter((row) => row.orders > 0);

    return {
      days,
      direct: summarise(direct),
      aggregator: summarise(aggregator),
      platforms: platformRows,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Integration management                                             */
/* ------------------------------------------------------------------ */

export const createIntegration = action({
  args: {
    restaurantId: v.id("restaurants"),
    platform: platformValidator,
    displayName: v.string(),
    outletId: v.optional(v.string()),
    apiKey: v.optional(v.string()),
    apiBaseUrl: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    integrationId: Id<"integrations">;
    webhookKey: string;
    webhookSecret: string;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please sign in to connect an aggregator");
    await ctx.runQuery(internal.aggregatorInternal.assertOwner, {
      restaurantId: args.restaurantId,
      userId,
    });

    const existing = await ctx.runQuery(
      internal.aggregatorInternal.findByRestaurantPlatform,
      { restaurantId: args.restaurantId, platform: args.platform },
    );
    if (existing) {
      throw new Error(
        `${getPlatformDefinition(args.platform).name} is already connected. Edit the existing connection instead.`,
      );
    }

    const webhookKey = randomToken(20);
    const webhookSecret = randomToken(40);

    const integrationId = await ctx.runMutation(
      internal.aggregatorInternal.insertIntegration,
      {
        restaurantId: args.restaurantId,
        platform: args.platform,
        displayName:
          args.displayName.trim() || getPlatformDefinition(args.platform).name,
        outletId: args.outletId?.trim() || undefined,
        apiKey: args.apiKey?.trim() || undefined,
        apiBaseUrl: args.apiBaseUrl?.trim() || undefined,
        webhookKey,
        webhookSecret,
      },
    );

    return { integrationId, webhookKey, webhookSecret };
  },
});

export const updateIntegration = mutation({
  args: {
    integrationId: v.id("integrations"),
    displayName: v.optional(v.string()),
    outletId: v.optional(v.string()),
    apiKey: v.optional(v.string()),
    apiBaseUrl: v.optional(v.string()),
    isEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration) throw new Error("Integration not found");
    await requireOwner(ctx, integration.restaurantId);

    const patch: Record<string, unknown> = {};
    if (args.displayName !== undefined && args.displayName.trim()) {
      patch.displayName = args.displayName.trim();
    }
    if (args.outletId !== undefined) patch.outletId = args.outletId.trim() || undefined;
    if (args.apiKey !== undefined) patch.apiKey = args.apiKey.trim() || undefined;
    if (args.apiBaseUrl !== undefined) {
      patch.apiBaseUrl = args.apiBaseUrl.trim() || undefined;
    }
    if (args.isEnabled !== undefined) {
      patch.isEnabled = args.isEnabled;
      if (args.isEnabled) {
        patch.lastError = undefined;
        patch.failureCount = 0;
      }
    }

    await ctx.db.patch(args.integrationId, patch);
  },
});

export const deleteIntegration = mutation({
  args: { integrationId: v.id("integrations") },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration) return;
    await requireOwner(ctx, integration.restaurantId);

    const mappings = await ctx.db
      .query("externalMenuMappings")
      .withIndex("by_integration", (q) => q.eq("integrationId", args.integrationId))
      .collect();
    for (const mapping of mappings) await ctx.db.delete(mapping._id);

    const events = await ctx.db
      .query("aggregatorEvents")
      .withIndex("by_integration", (q) => q.eq("integrationId", args.integrationId))
      .collect();
    for (const event of events) await ctx.db.delete(event._id);

    await ctx.db.delete(args.integrationId);
  },
});

export const revealCredentials = action({
  args: { integrationId: v.id("integrations") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    webhookUrl: string;
    webhookSecret: string;
    signatureHeader: string;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please sign in to view webhook credentials");
    const integration = await ctx.runQuery(
      internal.aggregatorInternal.getIntegrationForOwner,
      { integrationId: args.integrationId, userId },
    );
    const siteUrl = process.env.CONVEX_SITE_URL ?? "";
    return {
      webhookUrl: siteUrl
        ? `${siteUrl}/aggregator/webhook/${integration.webhookKey}`
        : `/aggregator/webhook/${integration.webhookKey}`,
      webhookSecret: integration.webhookSecret,
      signatureHeader: getPlatformDefinition(integration.platform).signatureHeader,
    };
  },
});

export const rotateWebhookSecret = action({
  args: { integrationId: v.id("integrations") },
  handler: async (
    ctx,
    args,
  ): Promise<{ webhookSecret: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please sign in to rotate the secret");
    const integration = await ctx.runQuery(
      internal.aggregatorInternal.getIntegrationForOwner,
      { integrationId: args.integrationId, userId },
    );
    const webhookSecret = randomToken(40);
    await ctx.runMutation(internal.aggregatorInternal.setWebhookSecret, {
      integrationId: integration._id,
      webhookSecret,
    });
    return { webhookSecret };
  },
});

/* ------------------------------------------------------------------ */
/* Menu mapping                                                       */
/* ------------------------------------------------------------------ */

export const mapItem = mutation({
  args: {
    integrationId: v.id("integrations"),
    externalItemId: v.string(),
    externalItemName: v.string(),
    menuItemId: v.id("menuItems"),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration) throw new Error("Integration not found");
    await requireOwner(ctx, integration.restaurantId);

    const menuItem = await ctx.db.get(args.menuItemId);
    if (!menuItem || menuItem.restaurantId !== integration.restaurantId) {
      throw new Error("That menu item belongs to a different restaurant");
    }

    const existing = await ctx.db
      .query("externalMenuMappings")
      .withIndex("by_integration_external", (q) =>
        q
          .eq("integrationId", args.integrationId)
          .eq("externalItemId", args.externalItemId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        menuItemId: args.menuItemId,
        externalItemName: args.externalItemName,
        isAvailable: menuItem.isAvailable,
        lastSyncedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("externalMenuMappings", {
      integrationId: args.integrationId,
      restaurantId: integration.restaurantId,
      platform: integration.platform,
      externalItemId: args.externalItemId,
      externalItemName: args.externalItemName,
      menuItemId: args.menuItemId,
      isAvailable: menuItem.isAvailable,
      lastSyncedAt: Date.now(),
    });
  },
});

export const unmapItem = mutation({
  args: { mappingId: v.id("externalMenuMappings") },
  handler: async (ctx, args) => {
    const mapping = await ctx.db.get(args.mappingId);
    if (!mapping) return;
    await requireOwner(ctx, mapping.restaurantId);
    await ctx.db.delete(args.mappingId);
  },
});

export const autoMapMenu = mutation({
  args: { integrationId: v.id("integrations") },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration) throw new Error("Integration not found");
    await requireOwner(ctx, integration.restaurantId);

    const pending = await collectUnmappedItems(ctx, integration);
    const menuItems = await ctx.db
      .query("menuItems")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", integration.restaurantId),
      )
      .collect();

    let mapped = 0;
    const stillUnmapped: string[] = [];

    for (const pendingItem of pending) {
      const target = normalizeName(pendingItem.name);
      const match =
        menuItems.find((item) => normalizeName(item.name) === target) ??
        menuItems.find((item) => {
          const candidate = normalizeName(item.name);
          return (
            candidate.length > 2 &&
            target.length > 2 &&
            (candidate.includes(target) || target.includes(candidate))
          );
        });

      if (!match) {
        stillUnmapped.push(pendingItem.name);
        continue;
      }

      await ctx.db.insert("externalMenuMappings", {
        integrationId: integration._id,
        restaurantId: integration.restaurantId,
        platform: integration.platform,
        externalItemId: pendingItem.externalItemId,
        externalItemName: pendingItem.name,
        menuItemId: match._id,
        isAvailable: match.isAvailable,
        lastSyncedAt: Date.now(),
      });
      mapped += 1;
    }

    return { mapped, stillUnmapped };
  },
});

/* ------------------------------------------------------------------ */
/* Replay & test tooling                                              */
/* ------------------------------------------------------------------ */

export const replayEvent = mutation({
  args: { eventId: v.id("aggregatorEvents") },
  handler: async (ctx, args): Promise<IngestOutcome> => {
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Webhook event not found");
    if (!event.integrationId) throw new Error("Event is not linked to an integration");
    if (!event.restaurantId) throw new Error("Event is missing its restaurant");

    await requireOwner(ctx, event.restaurantId);

    const outcome = await ctx.runMutation(
      internal.aggregatorIngest.ingestVerified,
      {
        integrationId: event.integrationId,
        eventId: `${event.eventId}#replay${Date.now()}`,
        eventType: event.eventType,
        payloadJson: event.payload,
      },
    );

    // Keep the log truthful: the original row reflects the replay outcome so the
    // pending-items list does not keep showing items that are now imported.
    await ctx.db.patch(event._id, {
      status: outcome.status,
      reason: `Replayed manually — ${outcome.status}${outcome.reason ? `: ${outcome.reason}` : ""}`,
      orderId: outcome.orderId ?? event.orderId,
      externalOrderId: outcome.externalOrderId ?? event.externalOrderId,
      processedAt: Date.now(),
    });

    return outcome;
  },
});

function buildSamplePayload(
  platform: PlatformId,
  items: Doc<"menuItems">[],
  outletId?: string,
) {
  const reference = `${platform.slice(0, 2).toUpperCase()}-${String(Date.now()).slice(-6)}`;
  const lines = items.map((item) => ({
    id: item._id as string,
    name: item.name,
    price: item.price,
    quantity: 1,
  }));
  const subtotal = round2(
    lines.reduce((sum, line) => sum + line.price * line.quantity, 0),
  );
  const tax = round2(subtotal * 0.05);
  const deliveryFee = 25;
  const total = round2(subtotal + tax + deliveryFee);
  const commission = round2(total * 0.12);
  const charges = { subtotal, tax, delivery_fee: deliveryFee, total };

  switch (platform) {
    case "zomato":
      return {
        event: "order.placed",
        order_id: reference,
        restaurant_id: outletId,
        customer: {
          name: "Aarav Sharma",
          phone: "+91 98100 11111",
          delivery_address: "12 MG Road, Bengaluru",
        },
        order_items: lines.map((line) => ({
          item_id: line.id,
          name: line.name,
          price: line.price,
          quantity: line.quantity,
        })),
        charges,
        commission,
        payment_status: "paid",
        order_type: "delivery",
        created_at: Date.now(),
      };
    case "swiggy":
      return {
        event_type: "order.new",
        orderId: reference,
        store_id: outletId,
        customerName: "Neha Verma",
        customerPhone: "+91 98200 22222",
        address: "44 Indiranagar, Bengaluru",
        items: lines.map((line) => ({
          itemId: line.id,
          name: line.name,
          unitPrice: line.price,
          qty: line.quantity,
        })),
        bill: { subtotal, taxes: tax, deliveryFee, total },
        payment: { status: "PAID", method: "upi" },
        order_type: "delivery",
      };
    case "urbanpiper":
      return {
        event: "order.placed",
        id: reference,
        ref_id: reference,
        store_id: outletId,
        customer: { name: "Rahul Iyer", phone: "+91 98300 33333" },
        items: lines.map((line) => ({
          sku_id: line.id,
          name: line.name,
          price: line.price,
          qty: line.quantity,
        })),
        charges: { subtotal, tax, delivery_fee: deliveryFee, grand_total: total },
        payment_status: "paid",
        commission,
      };
    case "petpooja":
      return {
        event: "new_order",
        order_id: reference,
        cust_name: "Priya Nair",
        cust_contact: "+91 98400 44444",
        items: lines.map((line) => ({
          item_id: line.id,
          item_name: line.name,
          quantity: line.quantity,
          price: line.price,
        })),
        charges,
        payment_status: "unpaid",
        order_type: "delivery",
      };
    default:
      return {
        event: "order.placed",
        order_id: reference,
        store_id: outletId,
        customer: { name: "Test Customer", phone: "+91 98500 55555" },
        items: lines.map((line) => ({
          item_id: line.id,
          name: line.name,
          quantity: line.quantity,
          price: line.price,
        })),
        charges,
        commission,
        payment_status: "paid",
      };
  }
}

export const simulateOrder = mutation({
  args: { integrationId: v.id("integrations") },
  handler: async (ctx, args): Promise<IngestOutcome> => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration) throw new Error("Integration not found");
    await requireOwner(ctx, integration.restaurantId);

    const menuItems = await ctx.db
      .query("menuItems")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", integration.restaurantId),
      )
      .collect();
    const sample = menuItems.filter((item) => item.isAvailable).slice(0, 2);
    if (sample.length === 0) {
      throw new Error("Add at least one available menu item before sending a test order");
    }

    const payload = buildSamplePayload(
      integration.platform,
      sample,
      integration.outletId,
    );

    return await ctx.runMutation(
      internal.aggregatorIngest.ingestVerified,
      {
        integrationId: integration._id,
        eventId: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        eventType: "order.placed",
        payloadJson: JSON.stringify(payload),
      },
    );
  },
});

export const simulateStatus = mutation({
  args: {
    integrationId: v.id("integrations"),
    externalOrderId: v.string(),
    status: v.union(
      v.literal("accepted"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("served"),
      v.literal("cancelled"),
    ),
  },
  handler: async (ctx, args): Promise<IngestOutcome> => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration) throw new Error("Integration not found");
    await requireOwner(ctx, integration.restaurantId);

    return await ctx.runMutation(
      internal.aggregatorIngest.ingestVerified,
      {
        integrationId: integration._id,
        eventId: `sim-status-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        eventType: args.status === "cancelled" ? "order.cancelled" : "order.status",
        payloadJson: JSON.stringify({
          event: args.status === "cancelled" ? "order.cancelled" : "order.status",
          order_id: args.externalOrderId,
          status: args.status,
          reason:
            args.status === "cancelled" ? "Rejected by restaurant" : undefined,
        }),
      },
    );
  },
});

export const webhookExample = action({
  args: { integrationId: v.id("integrations") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    url: string;
    body: string;
    signature: string;
    headers: Record<string, string>;
    curl: string;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please sign in to view the webhook example");

    const integration = await ctx.runQuery(
      internal.aggregatorInternal.getIntegrationForOwner,
      { integrationId: args.integrationId, userId },
    );
    const sampleItems = await ctx.runQuery(
      internal.aggregatorInternal.sampleMenuItems,
      { restaurantId: integration.restaurantId },
    );

    const payload = buildSamplePayload(
      integration.platform,
      sampleItems,
      integration.outletId,
    );
    const body = JSON.stringify(payload);
    const signature = await hmacHex(integration.webhookSecret, body);
    const siteUrl = process.env.CONVEX_SITE_URL ?? "";
    const path = `/aggregator/webhook/${integration.webhookKey}`;
    const definition = getPlatformDefinition(integration.platform);
    const url = siteUrl
      ? `${siteUrl}${path}`
      : `https://<your-deployment>.convex.site${path}`;

    return {
      url,
      body,
      signature,
      headers: {
        "content-type": "application/json",
        [definition.signatureHeader]: signature,
        "x-event-id": `test-${Date.now()}`,
      },
      curl: `curl -X POST '${url}' \\\n  -H 'content-type: application/json' \\\n  -H '${definition.signatureHeader}: ${signature}' \\\n  -H 'x-event-id: test-1' \\\n  -d '${body}'`,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Outbound status sync                                               */
/* ------------------------------------------------------------------ */

export const pushOrderStatus = action({
  args: { orderId: v.id("orders") },
  handler: async (
    ctx,
    args,
  ): Promise<{ synced: boolean; reason?: string; externalStatus?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please sign in");

    const data = await ctx.runQuery(internal.aggregatorInternal.getOrderForSync, {
      orderId: args.orderId,
    });
    if (!data) return { synced: false, reason: "order_not_found" };
    if (data.ownerId !== userId) throw new Error("Not authorized");

    const integration = data.integration;
    if (!integration) return { synced: false, reason: "not_an_aggregator_order" };

    const definition = getPlatformDefinition(integration.platform);
    if (!definition.capabilities.statusSync) {
      return { synced: false, reason: "unsupported_by_platform" };
    }
    if (!integration.isEnabled) {
      return { synced: false, reason: "integration_disabled" };
    }
    if (!integration.apiBaseUrl) {
      await ctx.runMutation(internal.aggregatorInternal.markSyncFailure, {
        integrationId: integration._id,
        reason: "Status sync needs an API base URL in the integration settings",
      });
      return { synced: false, reason: "missing_api_base_url" };
    }

    const externalStatus = mapInternalStatusToPlatform(
      integration.platform,
      data.order.status,
    );
    const body = JSON.stringify({
      event: "order.status",
      order_id: data.order.externalOrderId,
      status: externalStatus,
      reason: data.order.rejectionReason,
    });

    try {
      const signature = await hmacHex(integration.webhookSecret, body);
      const response = await fetch(
        `${integration.apiBaseUrl.replace(/\/+$/, "")}/orders/${data.order.externalOrderId}/status`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-signature": signature,
            ...(integration.apiKey
              ? { authorization: `Bearer ${integration.apiKey}` }
              : {}),
          },
          body,
        },
      );

      if (!response.ok) {
        await ctx.runMutation(internal.aggregatorInternal.markSyncFailure, {
          integrationId: integration._id,
          reason: `Status sync failed with HTTP ${response.status}`,
        });
        return { synced: false, reason: `http_${response.status}` };
      }

      await ctx.runMutation(internal.aggregatorInternal.markSyncSuccess, {
        integrationId: integration._id,
      });
      return { synced: true, externalStatus };
    } catch (error) {
      await ctx.runMutation(internal.aggregatorInternal.markSyncFailure, {
        integrationId: integration._id,
        reason: `Status sync failed: ${(error as Error).message}`,
      });
      return { synced: false, reason: "network_error" };
    }
  },
});
