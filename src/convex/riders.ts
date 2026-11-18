import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { deductOrderIngredients, round2 } from "./inventoryOps";

const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 120_000;

function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  const digits = trimmed.replace(/\D/g, "");
  return `${plus}${digits}`;
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return hex(bits);
}

async function newSalt(): Promise<string> {
  return hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

function publicRider(rider: Doc<"riders">) {
  return {
    _id: rider._id,
    name: rider.name,
    phone: rider.phone,
    vehicle: rider.vehicle,
    isOnline: rider.isOnline,
    isActive: rider.isActive,
    lastSeenAt: rider.lastSeenAt,
    currentLocation: rider.currentLocation,
  };
}

/** Resolves a rider session token, or throws. Sessions are revocable. */
async function riderFromToken(
  ctx: { db: MutationCtx["db"] },
  token: string,
): Promise<Doc<"riders">> {
  if (!token) throw new Error("Not signed in");
  const session = await ctx.db
    .query("riderSessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();
  if (!session) throw new Error("Session not found — please sign in again");
  if (session.expiresAt < Date.now()) {
    await ctx.db.delete(session._id);
    throw new Error("Session expired — please sign in again");
  }
  const rider = await ctx.db.get(session.riderId);
  if (!rider || !rider.isActive) throw new Error("This rider account is inactive");
  return rider;
}

// ── Manager console ──────────────────────────────────────────────────────

export const list = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    const [riders, orders] = await Promise.all([
      ctx.db
        .query("riders")
        .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
        .collect(),
      ctx.db
        .query("orders")
        .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
        .order("desc")
        .take(300),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return riders
      .map((rider) => {
        const assigned = orders.filter(
          (order) =>
            order.riderId === rider._id &&
            order.deliveryStatus !== "delivered" &&
            order.deliveryStatus !== "cancelled" &&
            order.status !== "cancelled",
        );
        const deliveredToday = orders.filter(
          (order) =>
            order.riderId === rider._id &&
            order.deliveryStatus === "delivered" &&
            (order.deliveredAt ?? 0) >= today.getTime(),
        );
        return {
          ...publicRider(rider),
          activeDeliveries: assigned.length,
          deliveredToday: deliveredToday.length,
          cashToday: round2(
            deliveredToday
              .filter((order) => order.paymentMethod === "cash")
              .reduce((sum, order) => sum + order.totalAmount, 0),
          ),
        };
      })
      .sort((a, b) => Number(b.isOnline) - Number(a.isOnline) || a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    name: v.string(),
    phone: v.string(),
    password: v.string(),
    vehicle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    const phone = normalizePhone(args.phone);
    if (!name) throw new Error("Rider name is required");
    if (phone.replace(/\D/g, "").length < 8) throw new Error("Enter a valid phone number");
    if (args.password.length < 4) {
      throw new Error("Password must be at least 4 characters");
    }

    const existing = await ctx.db
      .query("riders")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
      .collect();
    if (existing.some((rider) => normalizePhone(rider.phone) === phone)) {
      throw new Error("A rider with this phone number already exists");
    }

    const salt = await newSalt();
    return await ctx.db.insert("riders", {
      restaurantId: args.restaurantId,
      name,
      phone,
      passwordHash: await hashPassword(args.password, salt),
      passwordSalt: salt,
      vehicle: args.vehicle?.trim() || undefined,
      isActive: true,
      isOnline: false,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("riders"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    vehicle: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) {
      if (!args.name.trim()) throw new Error("Rider name is required");
      patch.name = args.name.trim();
    }
    if (args.phone !== undefined) {
      const phone = normalizePhone(args.phone);
      if (phone.replace(/\D/g, "").length < 8) throw new Error("Enter a valid phone number");
      patch.phone = phone;
    }
    if (args.vehicle !== undefined) patch.vehicle = args.vehicle.trim() || undefined;
    if (args.isActive !== undefined) {
      patch.isActive = args.isActive;
      if (!args.isActive) patch.isOnline = false;
    }
    await ctx.db.patch(args.id, patch);
  },
});

export const resetPassword = mutation({
  args: { id: v.id("riders"), password: v.string() },
  handler: async (ctx, args) => {
    if (args.password.length < 4) throw new Error("Password must be at least 4 characters");
    const salt = await newSalt();
    await ctx.db.patch(args.id, {
      passwordSalt: salt,
      passwordHash: await hashPassword(args.password, salt),
    });
    // Existing tokens are revoked so a lost phone cannot keep a session.
    const sessions = await ctx.db
      .query("riderSessions")
      .withIndex("by_rider", (q) => q.eq("riderId", args.id))
      .collect();
    await Promise.all(sessions.map((session) => ctx.db.delete(session._id)));
  },
});

export const remove = mutation({
  args: { id: v.id("riders") },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("riderSessions")
      .withIndex("by_rider", (q) => q.eq("riderId", args.id))
      .collect();
    await Promise.all(sessions.map((session) => ctx.db.delete(session._id)));
    await ctx.db.delete(args.id);
  },
});

// ── Rider sign-in ────────────────────────────────────────────────────────

export const login = mutation({
  args: { phone: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const phone = normalizePhone(args.phone);
    const rider = await ctx.db
      .query("riders")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();

    // Same message for unknown phone and wrong password so the endpoint does
    // not reveal which rider accounts exist.
    const invalid = new Error("Phone number or password is incorrect");
    if (!rider || !rider.isActive) throw invalid;

    const candidate = await hashPassword(args.password, rider.passwordSalt);
    if (candidate !== rider.passwordHash) throw invalid;

    const restaurant = await ctx.db.get(rider.restaurantId);
    if (!restaurant) throw new Error("Restaurant not found");

    const token = crypto.randomUUID().replace(/-/g, "");
    const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
    await ctx.db.insert("riderSessions", {
      riderId: rider._id,
      restaurantId: rider.restaurantId,
      token,
      expiresAt,
      createdAt: Date.now(),
    });
    await ctx.db.patch(rider._id, { lastSeenAt: Date.now() });

    return {
      token,
      rider: publicRider(rider),
      restaurant: { _id: restaurant._id, name: restaurant.name, address: restaurant.address },
    };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("riderSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (session) {
      await ctx.db.patch(session.riderId, { isOnline: false });
      await ctx.db.delete(session._id);
    }
  },
});

export const session = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return null;
    const session = await ctx.db
      .query("riderSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!session || session.expiresAt < Date.now()) return null;
    const rider = await ctx.db.get(session.riderId);
    if (!rider || !rider.isActive) return null;
    const restaurant = await ctx.db.get(rider.restaurantId);
    return {
      rider: publicRider(rider),
      restaurant: restaurant
        ? { _id: restaurant._id, name: restaurant.name, address: restaurant.address }
        : null,
    };
  },
});

export const setOnline = mutation({
  args: { token: v.string(), isOnline: v.boolean() },
  handler: async (ctx, args) => {
    const rider = await riderFromToken(ctx, args.token);
    await ctx.db.patch(rider._id, {
      isOnline: args.isOnline,
      lastSeenAt: Date.now(),
    });
  },
});

export const updateLocation = mutation({
  args: {
    token: v.string(),
    lat: v.number(),
    lng: v.number(),
    accuracy: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rider = await riderFromToken(ctx, args.token);
    if (Math.abs(args.lat) > 90 || Math.abs(args.lng) > 180) {
      throw new Error("Invalid coordinates");
    }
    await ctx.db.patch(rider._id, {
      currentLocation: {
        lat: args.lat,
        lng: args.lng,
        accuracy: args.accuracy,
        updatedAt: Date.now(),
      },
      lastSeenAt: Date.now(),
    });
  },
});

// ── Deliveries ───────────────────────────────────────────────────────────

const ACTIVE_DELIVERY = (order: Doc<"orders">) =>
  order.channel === "delivery" &&
  order.status !== "cancelled" &&
  order.deliveryStatus !== "delivered" &&
  order.deliveryStatus !== "cancelled";

export const myDeliveries = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return null;
    const session = await ctx.db
      .query("riderSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!session || session.expiresAt < Date.now()) return null;
    const rider = await ctx.db.get(session.riderId);
    if (!rider || !rider.isActive) return null;

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", rider.restaurantId))
      .order("desc")
      .take(200);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const mine = orders.filter((order) => order.riderId === rider._id && ACTIVE_DELIVERY(order));
    const available = orders.filter(
      (order) => !order.riderId && ACTIVE_DELIVERY(order) && order.status !== "received",
    );
    const completedToday = orders.filter(
      (order) =>
        order.riderId === rider._id &&
        order.deliveryStatus === "delivered" &&
        (order.deliveredAt ?? 0) >= today.getTime(),
    );

    return {
      rider: publicRider(rider),
      assigned: mine.sort((a, b) => a.createdAt - b.createdAt),
      available: available.sort((a, b) => a.createdAt - b.createdAt),
      completedToday: completedToday.length,
      cashToday: round2(
        completedToday
          .filter((order) => order.paymentMethod === "cash" && order.paymentStatus === "paid")
          .reduce((sum, order) => sum + order.totalAmount, 0),
      ),
    };
  },
});

export const claimDelivery = mutation({
  args: { token: v.string(), orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const rider = await riderFromToken(ctx, args.token);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.restaurantId !== rider.restaurantId) {
      throw new Error("Order not found");
    }
    if (!ACTIVE_DELIVERY(order)) throw new Error("This delivery is no longer open");
    if (order.riderId && order.riderId !== rider._id) {
      throw new Error("Another rider already took this delivery");
    }
    await ctx.db.patch(order._id, {
      riderId: rider._id,
      assignedAt: order.assignedAt ?? Date.now(),
      deliveryStatus: "assigned",
      status: order.status === "received" ? "accepted" : order.status,
    });
    await ctx.db.patch(rider._id, { lastSeenAt: Date.now() });
  },
});

export const pickUpDelivery = mutation({
  args: { token: v.string(), orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const rider = await riderFromToken(ctx, args.token);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.riderId !== rider._id) throw new Error("This delivery is not assigned to you");
    if (order.deliveryStatus === "delivered") throw new Error("This delivery is already complete");

    await ctx.db.patch(order._id, {
      deliveryStatus: "picked_up",
      pickedUpAt: Date.now(),
      status: order.status === "received" || order.status === "accepted" || order.status === "preparing"
        ? "ready"
        : order.status,
    });
  },
});

export const markDelivered = mutation({
  args: {
    token: v.string(),
    orderId: v.id("orders"),
    // Cash the rider actually collected at the door.
    cashCollected: v.optional(v.number()),
    paymentMethod: v.optional(
      v.union(v.literal("cash"), v.literal("upi"), v.literal("card"), v.literal("online")),
    ),
  },
  handler: async (ctx, args) => {
    const rider = await riderFromToken(ctx, args.token);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.riderId !== rider._id) throw new Error("This delivery is not assigned to you");
    if (order.deliveryStatus === "delivered") throw new Error("Already marked delivered");

    const now = Date.now();
    const patch: Record<string, unknown> = {
      deliveryStatus: "delivered",
      deliveredAt: now,
      completedAt: now,
      status: "served",
    };

    // Platform-paid orders are settled by the aggregator — never collect twice.
    if (!order.isPlatformPaid && order.paymentStatus !== "paid" && args.cashCollected !== undefined) {
      if (args.cashCollected < order.totalAmount - 0.01) {
        throw new Error(
          `Cash collected (${args.cashCollected.toFixed(2)}) is less than the order total (${order.totalAmount.toFixed(2)})`,
        );
      }
      patch.paymentStatus = "paid";
      patch.paymentMethod = args.paymentMethod ?? "cash";
      patch.paidAt = now;
    }

    await ctx.db.patch(order._id, patch);
    await ctx.db.patch(rider._id, { lastSeenAt: now });
  },
});

// ── Dispatch console ─────────────────────────────────────────────────────

export const dispatchBoard = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    const [orders, riders] = await Promise.all([
      ctx.db
        .query("orders")
        .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
        .order("desc")
        .take(200),
      ctx.db
        .query("riders")
        .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
        .collect(),
    ]);

    const byId = new Map(riders.map((rider) => [rider._id, rider]));

    return {
      active: orders
        .filter(ACTIVE_DELIVERY)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((order) => ({
          ...order,
          riderName: order.riderId ? byId.get(order.riderId)?.name : undefined,
          riderPhone: order.riderId ? byId.get(order.riderId)?.phone : undefined,
          cashToCollect: order.isPlatformPaid || order.paymentStatus === "paid" ? 0 : order.totalAmount,
        })),
      unassignedCount: orders.filter((order) => ACTIVE_DELIVERY(order) && !order.riderId).length,
    };
  },
});

export const assignRider = mutation({
  args: { orderId: v.id("orders"), riderId: v.id("riders") },
  handler: async (ctx, args) => {
    const [order, rider] = await Promise.all([
      ctx.db.get(args.orderId),
      ctx.db.get(args.riderId),
    ]);
    if (!order) throw new Error("Order not found");
    if (!rider) throw new Error("Rider not found");
    if (order.restaurantId !== rider.restaurantId) {
      throw new Error("Rider belongs to a different restaurant");
    }
    if (!rider.isActive) throw new Error("This rider is inactive");

    await ctx.db.patch(args.orderId, {
      riderId: args.riderId,
      assignedAt: Date.now(),
      deliveryStatus: order.deliveryStatus === "picked_up" ? "picked_up" : "assigned",
      status: order.status === "received" ? "accepted" : order.status,
    });
  },
});

export const unassignRider = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    await ctx.db.patch(args.orderId, {
      riderId: undefined,
      assignedAt: undefined,
      pickedUpAt: undefined,
      deliveryStatus: order.deliveryStatus === "picked_up" ? "assigned" : "pending",
    });
  },
});

/** Manager-created delivery order (phone / walk-in delivery). */
export const createDeliveryOrder = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    customerName: v.optional(v.string()),
    customerPhone: v.string(),
    customerAddress: v.string(),
    items: v.array(
      v.object({
        menuItemId: v.id("menuItems"),
        quantity: v.number(),
      }),
    ),
    riderId: v.optional(v.id("riders")),
    paymentMethod: v.optional(v.union(v.literal("cash"), v.literal("upi"), v.literal("card"))),
  },
  handler: async (ctx, args) => {
    if (!args.customerAddress.trim()) throw new Error("Delivery address is required");
    if (args.items.length === 0) throw new Error("Add at least one item");

    const lines = [];
    for (const line of args.items) {
      const item = await ctx.db.get(line.menuItemId);
      if (!item || item.restaurantId !== args.restaurantId) {
        throw new Error("Unknown menu item");
      }
      if (line.quantity < 1) throw new Error("Quantity must be at least 1");
      lines.push({
        menuItemId: item._id,
        name: item.name,
        price: item.price,
        quantity: line.quantity,
      });
    }

    const now = Date.now();
    const subtotal = round2(lines.reduce((sum, l) => sum + l.price * l.quantity, 0));
    const orderId = await ctx.db.insert("orders", {
      restaurantId: args.restaurantId,
      customerName: args.customerName?.trim() || undefined,
      customerPhone: normalizePhone(args.customerPhone),
      customerAddress: args.customerAddress.trim(),
      items: lines,
      subtotal,
      totalAmount: subtotal,
      status: "received",
      source: "pos",
      channel: "delivery",
      deliveryStatus: args.riderId ? "assigned" : "pending",
      riderId: args.riderId,
      assignedAt: args.riderId ? now : undefined,
      paymentStatus: "unpaid",
      paymentMethod: args.paymentMethod,
      createdAt: now,
    });

    await deductOrderIngredients(
      ctx,
      args.restaurantId,
      lines.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity })),
      orderId,
    );

    return orderId;
  },
});
