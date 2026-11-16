import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  PayloadError,
  extractOutletReference,
  normalizeName,
  normalizeOrderPayload,
  normalizeStatusPayload,
  resolveStations,
  type NormalizedItem,
} from "./aggregatorAdapters";

/**
 * Idempotent webhook ingestion.
 *
 * Everything that writes an external order lives here. The mutation is
 * transactional, so the idempotency checks (event id + external order id) and
 * the insert either all commit or all roll back — a retried delivery can never
 * create a duplicate order.
 */

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export type IngestOutcome = {
  status: "processed" | "duplicate" | "unmapped" | "rejected" | "failed";
  reason?: string;
  orderId?: Id<"orders">;
  externalOrderId?: string;
  unmapped?: { externalItemId: string; name: string }[];
};

async function resolveMenuItem(
  ctx: MutationCtx,
  integration: Doc<"integrations">,
  item: NormalizedItem,
  menuItems: Doc<"menuItems">[],
) {
  const mapping = await ctx.db
    .query("externalMenuMappings")
    .withIndex("by_integration_external", (q) =>
      q
        .eq("integrationId", integration._id)
        .eq("externalItemId", item.externalItemId),
    )
    .first();

  if (mapping) {
    const menuItem = await ctx.db.get(mapping.menuItemId);
    if (menuItem) {
      await ctx.db.patch(mapping._id, {
        isAvailable: menuItem.isAvailable,
        lastSyncedAt: Date.now(),
      });
      return menuItem;
    }
    // Dangling mapping — fall through to name matching.
    await ctx.db.delete(mapping._id);
  }

  const target = normalizeName(item.name);
  const match =
    menuItems.find((menuItem) => normalizeName(menuItem.name) === target) ??
    menuItems.find((menuItem) => {
      const candidate = normalizeName(menuItem.name);
      return (
        candidate.length > 2 &&
        target.length > 2 &&
        (candidate.includes(target) || target.includes(candidate))
      );
    });

  if (!match) return null;

  await ctx.db.insert("externalMenuMappings", {
    integrationId: integration._id,
    restaurantId: integration.restaurantId,
    platform: integration.platform,
    externalItemId: item.externalItemId,
    externalItemName: item.name,
    externalPrice: item.price,
    menuItemId: match._id,
    isAvailable: match.isAvailable,
    lastSyncedAt: Date.now(),
  });

  return match;
}

/**
 * Out-of-order handling: a status/cancel event can arrive before the order it
 * belongs to. Those events are stored as `out_of_order` and applied here once
 * the order actually lands, oldest first so the newest status wins.
 */
async function applyDeferredEvents(
  ctx: MutationCtx,
  integration: Doc<"integrations">,
  orderId: Id<"orders">,
  externalOrderId: string,
) {
  const rows = await ctx.db
    .query("aggregatorEvents")
    .withIndex("by_externalOrder", (q) =>
      q
        .eq("integrationId", integration._id)
        .eq("externalOrderId", externalOrderId),
    )
    .collect();

  const deferred = rows
    .filter((row) => row.status === "rejected" && row.reason === "out_of_order")
    .sort((a, b) => a.receivedAt - b.receivedAt);

  if (deferred.length === 0) return false;

  const now = Date.now();
  for (const row of deferred) {
    try {
      const payload = JSON.parse(row.payload) as Record<string, unknown>;
      const statusEvent = normalizeStatusPayload(integration.platform, payload);
      const patch: Record<string, unknown> = {
        status: statusEvent.status,
        externalStatus: statusEvent.status,
      };
      if (statusEvent.status === "cancelled") {
        patch.completedAt = now;
        patch.deliveryStatus = "cancelled";
        if (statusEvent.reason) patch.rejectionReason = statusEvent.reason;
      }
      if (statusEvent.status === "ready") patch.readyAt = now;
      if (statusEvent.status === "served") patch.completedAt = now;
      await ctx.db.patch(orderId, patch);
    } catch {
      // Malformed deferred payloads are still closed out below.
    }
    await ctx.db.patch(row._id, {
      status: "processed",
      reason: "Applied after the order arrived",
      orderId,
      processedAt: now,
    });
  }

  return true;
}

async function ingestPayload(
  ctx: MutationCtx,
  integration: Doc<"integrations">,
  payloadJson: string,
  eventType: string,
): Promise<IngestOutcome> {
  const now = Date.now();

  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(payloadJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Payload must be a JSON object");
    }
    payload = parsed as Record<string, unknown>;
  } catch (error) {
    return {
      status: "rejected",
      reason: `Invalid JSON payload: ${(error as Error).message}`,
    };
  }

  // Restaurant / branch mapping validation
  if (integration.outletId) {
    const outlet = extractOutletReference(payload);
    if (outlet && normalizeName(outlet) !== normalizeName(integration.outletId)) {
      return {
        status: "rejected",
        reason: `Outlet mismatch: payload is for "${outlet}" but this integration is mapped to "${integration.outletId}"`,
      };
    }
  }

  if (eventType === "order.placed") {
    let normalized;
    try {
      normalized = normalizeOrderPayload(integration.platform, payload);
    } catch (error) {
      const reason =
        error instanceof PayloadError
          ? error.message
          : `Could not read the order payload: ${(error as Error).message}`;
      return { status: "rejected", reason };
    }

    const existingOrder = await ctx.db
      .query("orders")
      .withIndex("by_external", (q) =>
        q
          .eq("integrationId", integration._id)
          .eq("externalOrderId", normalized.externalOrderId),
      )
      .first();

    if (existingOrder) {
      return {
        status: "duplicate",
        reason: "This order was already imported",
        orderId: existingOrder._id,
        externalOrderId: normalized.externalOrderId,
      };
    }

    const menuItems = await ctx.db
      .query("menuItems")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", integration.restaurantId),
      )
      .collect();
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", integration.restaurantId),
      )
      .collect();
    const categoryNames = new Map(
      categories.map((category) => [category._id, category.name]),
    );

    const orderItems: {
      menuItemId: Id<"menuItems">;
      name: string;
      price: number;
      quantity: number;
      note?: string;
      externalItemId: string;
    }[] = [];
    const unmapped: { externalItemId: string; name: string }[] = [];
    const stationInputs: { name: string; categoryName?: string }[] = [];
    let unavailableCount = 0;

    for (const item of normalized.items) {
      const menuItem = await resolveMenuItem(ctx, integration, item, menuItems);
      if (!menuItem) {
        unmapped.push({ externalItemId: item.externalItemId, name: item.name });
        continue;
      }
      if (!menuItem.isAvailable) unavailableCount += 1;

      orderItems.push({
        menuItemId: menuItem._id,
        name: item.name || menuItem.name,
        price: item.price,
        quantity: item.quantity,
        note:
          [
            item.note,
            menuItem.isAvailable ? undefined : "Item is marked unavailable on the POS menu",
          ]
            .filter(Boolean)
            .join(" · ") || undefined,
        externalItemId: item.externalItemId,
      });
      stationInputs.push({
        name: menuItem.name,
        categoryName: categoryNames.get(menuItem.categoryId),
      });
    }

    if (unmapped.length > 0) {
      return {
        status: "unmapped",
        reason: `No POS menu match for: ${unmapped.map((item) => item.name).join(", ")}`,
        externalOrderId: normalized.externalOrderId,
        unmapped,
      };
    }

    const stations = resolveStations(stationInputs);
    const commission = normalized.commission;
    const netSettlement =
      commission !== undefined
        ? round2(normalized.totalAmount - commission)
        : undefined;

    const orderId = await ctx.db.insert("orders", {
      restaurantId: integration.restaurantId,
      customerName: normalized.customerName,
      customerPhone: normalized.customerPhone,
      items: orderItems,
      totalAmount: normalized.totalAmount,
      status: "received",
      paymentStatus: normalized.platformPaid ? "paid" : "unpaid",
      paymentMethod: normalized.platformPaid ? "online" : undefined,
      paidAt: normalized.platformPaid ? now : undefined,
      createdAt: normalized.placedAt ?? now,
      source: "aggregator",
      channel: normalized.channel,
      integrationId: integration._id,
      externalPlatform: integration.platform,
      externalOrderId: normalized.externalOrderId,
      externalStatus: normalized.externalStatus,
      customerEmail: normalized.customerEmail,
      customerAddress: normalized.customerAddress,
      subtotal: normalized.subtotal,
      taxAmount: normalized.taxAmount,
      deliveryFee: normalized.deliveryFee,
      commission,
      netSettlement,
      isPlatformPaid: normalized.platformPaid,
      deliveryStatus: normalized.channel === "delivery" ? "pending" : undefined,
      stations,
    });

    const appliedDeferred = await applyDeferredEvents(
      ctx,
      integration,
      orderId,
      normalized.externalOrderId,
    );

    const reasons: string[] = [];
    if (appliedDeferred) reasons.push("Applied an earlier out-of-order status event");
    if (unavailableCount > 0) {
      reasons.push(`${unavailableCount} item(s) are unavailable on the POS menu`);
    }

    return {
      status: "processed",
      orderId,
      externalOrderId: normalized.externalOrderId,
      reason: reasons.length > 0 ? reasons.join(". ") : undefined,
    };
  }

  // Status / cancellation events
  let statusEvent;
  try {
    statusEvent = normalizeStatusPayload(integration.platform, payload);
  } catch (error) {
    const reason =
      error instanceof PayloadError
        ? error.message
        : `Could not read the status payload: ${(error as Error).message}`;
    return { status: "rejected", reason };
  }

  const order = await ctx.db
    .query("orders")
    .withIndex("by_external", (q) =>
      q
        .eq("integrationId", integration._id)
        .eq("externalOrderId", statusEvent.externalOrderId),
    )
    .first();

  if (!order) {
    // Retained so it can be applied if the order event arrives later.
    return {
      status: "rejected",
      reason: "out_of_order",
      externalOrderId: statusEvent.externalOrderId,
    };
  }

  const patch: Record<string, unknown> = {
    status: statusEvent.status,
    externalStatus: statusEvent.status,
  };
  if (statusEvent.status === "accepted" && !order.acceptedAt) {
    patch.acceptedAt = now;
  }
  if (statusEvent.status === "ready") patch.readyAt = now;
  if (statusEvent.status === "served") {
    patch.completedAt = now;
    if (order.channel === "delivery") patch.deliveryStatus = "delivered";
  }
  if (statusEvent.status === "cancelled") {
    patch.completedAt = now;
    patch.deliveryStatus = "cancelled";
    if (statusEvent.reason) patch.rejectionReason = statusEvent.reason;
    if (order.isPlatformPaid) patch.paymentStatus = "refunded";
  }

  await ctx.db.patch(order._id, patch);

  return {
    status: "processed",
    orderId: order._id,
    externalOrderId: statusEvent.externalOrderId,
    reason: statusEvent.reason,
  };
}

export const ingestVerified = internalMutation({
  args: {
    integrationId: v.id("integrations"),
    eventId: v.string(),
    eventType: v.string(),
    payloadJson: v.string(),
  },
  handler: async (ctx, args): Promise<IngestOutcome> => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration) {
      return { status: "rejected", reason: "Unknown integration" };
    }
    if (!integration.isEnabled) {
      return { status: "rejected", reason: "Integration is disabled" };
    }

    const now = Date.now();
    const seen = await ctx.db
      .query("aggregatorEvents")
      .withIndex("by_integration_event", (q) =>
        q.eq("integrationId", integration._id).eq("eventId", args.eventId),
      )
      .first();

    if (seen && (seen.status === "processed" || seen.status === "duplicate")) {
      await ctx.db.patch(integration._id, { lastEventAt: now });
      return {
        status: "duplicate",
        reason: "Duplicate webhook delivery ignored",
        orderId: seen.orderId,
      };
    }

    const outcome = await ingestPayload(
      ctx,
      integration,
      args.payloadJson,
      args.eventType,
    );

    const logFields = {
      integrationId: integration._id,
      restaurantId: integration.restaurantId,
      platform: integration.platform,
      webhookKey: integration.webhookKey,
      eventId: args.eventId,
      eventType: args.eventType,
      status: outcome.status,
      reason: outcome.reason,
      externalOrderId: outcome.externalOrderId,
      orderId: outcome.orderId,
      payload: args.payloadJson,
      processedAt: now,
    };

    if (seen) {
      await ctx.db.patch(seen._id, logFields);
    } else {
      await ctx.db.insert("aggregatorEvents", {
        ...logFields,
        receivedAt: now,
      });
    }

    if (outcome.status === "processed" || outcome.status === "duplicate") {
      await ctx.db.patch(integration._id, {
        lastEventAt: now,
        lastSyncAt: now,
        lastError: undefined,
        failureCount: 0,
      });
    } else {
      await ctx.db.patch(integration._id, {
        lastEventAt: now,
        lastError: outcome.reason ?? outcome.status,
        failureCount: integration.failureCount + 1,
      });
    }

    return outcome;
  },
});

export const findByWebhookKey = internalQuery({
  args: { webhookKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("integrations")
      .withIndex("by_webhookKey", (q) => q.eq("webhookKey", args.webhookKey))
      .first();
  },
});

export const logRejectedEvent = internalMutation({
  args: {
    integrationId: v.optional(v.id("integrations")),
    webhookKey: v.string(),
    platform: v.string(),
    eventId: v.string(),
    eventType: v.string(),
    payloadJson: v.string(),
    reason: v.string(),
    restaurantId: v.optional(v.id("restaurants")),
  },
  handler: async (ctx, args) => {
    if (!args.integrationId) {
      await ctx.db.insert("aggregatorEvents", {
        platform: args.platform,
        webhookKey: args.webhookKey,
        eventId: args.eventId,
        eventType: args.eventType,
        status: "rejected",
        reason: args.reason,
        payload: args.payloadJson,
        receivedAt: Date.now(),
        processedAt: Date.now(),
      });
      return;
    }

    const existing = await ctx.db
      .query("aggregatorEvents")
      .withIndex("by_integration_event", (q) =>
        q
          .eq("integrationId", args.integrationId)
          .eq("eventId", args.eventId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "rejected",
        reason: args.reason,
        processedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("aggregatorEvents", {
        integrationId: args.integrationId,
        restaurantId: args.restaurantId,
        platform: args.platform,
        webhookKey: args.webhookKey,
        eventId: args.eventId,
        eventType: args.eventType,
        status: "rejected",
        reason: args.reason,
        payload: args.payloadJson,
        receivedAt: Date.now(),
        processedAt: Date.now(),
      });
    }

    const integration = await ctx.db.get(args.integrationId);
    if (integration) {
      await ctx.db.patch(integration._id, {
        lastEventAt: Date.now(),
        lastError: args.reason,
        failureCount: integration.failureCount + 1,
      });
    }
  },
});
