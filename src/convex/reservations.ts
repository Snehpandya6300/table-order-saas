import { query, mutation } from "./_generated/server";
import { v } from "convex/values";


const DEFAULT_DURATION = 90;
const AVG_TURN_MINUTES = 50;

const statusValidator = v.union(
  v.literal("booked"),
  v.literal("seated"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("no_show"),
);

function toMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function overlaps(
  aStart: number,
  aDuration: number,
  bStart: number,
  bDuration: number,
): boolean {
  return aStart < bStart + bDuration && bStart < aStart + aDuration;
}

export const listForDate = query({
  args: {
    restaurantId: v.id("restaurants"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const [reservations, waitlist, tables] = await Promise.all([
      ctx.db
        .query("reservations")
        .withIndex("by_restaurant_date", (q) =>
          q.eq("restaurantId", args.restaurantId).eq("date", args.date),
        )
        .collect(),
      ctx.db
        .query("waitlistEntries")
        .withIndex("by_restaurant_status", (q) =>
          q.eq("restaurantId", args.restaurantId).eq("status", "waiting"),
        )
        .collect(),
      ctx.db
        .query("tables")
        .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
        .collect(),
    ]);

    const now = Date.now();
    return {
      date: args.date,
      reservations: reservations.sort((a, b) => a.time.localeCompare(b.time)),
      waitlist: waitlist.sort((a, b) => a.joinedAt - b.joinedAt).map((entry) => ({
        ...entry,
        waitedMinutes: Math.max(0, Math.round((now - entry.joinedAt) / 60000)),
      })),
      tables: tables
        .filter((table) => table.isActive)
        .sort((a, b) => a.label.localeCompare(b.label)),
      covers: reservations
        .filter((r) => r.status === "booked" || r.status === "seated")
        .reduce((sum, r) => sum + r.partySize, 0),
      avgTurnMinutes: AVG_TURN_MINUTES,
    };
  },
});

export const create = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    guestName: v.string(),
    guestPhone: v.string(),
    guestEmail: v.optional(v.string()),
    partySize: v.number(),
    date: v.string(),
    time: v.string(),
    durationMinutes: v.optional(v.number()),
    tableId: v.optional(v.id("tables")),
    notes: v.optional(v.string()),
    source: v.optional(
      v.union(v.literal("phone"), v.literal("walk_in"), v.literal("online"), v.literal("staff")),
    ),
  },
  handler: async (ctx, args) => {
    if (!args.guestName.trim()) throw new Error("Guest name is required");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error("Invalid reservation date");
    if (toMinutes(args.time) === null) throw new Error("Invalid reservation time");
    if (args.partySize < 1) throw new Error("Party size must be at least 1");

    const duration = args.durationMinutes ?? DEFAULT_DURATION;
    let tableLabel: string | undefined;

    if (args.tableId) {
      const table = await ctx.db.get(args.tableId);
      if (!table || table.restaurantId !== args.restaurantId) {
        throw new Error("Table not found");
      }
      tableLabel = table.label;

      const sameDay = await ctx.db
        .query("reservations")
        .withIndex("by_restaurant_date", (q) =>
          q.eq("restaurantId", args.restaurantId).eq("date", args.date),
        )
        .collect();
      const start = toMinutes(args.time)!;
      const clash = sameDay.find(
        (r) =>
          r.tableId === args.tableId &&
          (r.status === "booked" || r.status === "seated") &&
          overlaps(start, duration, toMinutes(r.time) ?? 0, r.durationMinutes),
      );
      if (clash) {
        throw new Error(
          `${tableLabel} is already booked for ${clash.guestName} at ${clash.time}`,
        );
      }
    }

    return await ctx.db.insert("reservations", {
      restaurantId: args.restaurantId,
      guestName: args.guestName.trim(),
      guestPhone: args.guestPhone.trim(),
      guestEmail: args.guestEmail?.trim() || undefined,
      partySize: args.partySize,
      tableId: args.tableId,
      tableLabel,
      date: args.date,
      time: args.time.trim(),
      durationMinutes: duration,
      status: "booked",
      source: args.source ?? "staff",
      notes: args.notes?.trim() || undefined,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("reservations"),
    guestName: v.optional(v.string()),
    guestPhone: v.optional(v.string()),
    guestEmail: v.optional(v.string()),
    partySize: v.optional(v.number()),
    date: v.optional(v.string()),
    time: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    tableId: v.optional(v.id("tables")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.id);
    if (!reservation) throw new Error("Reservation not found");

    const patch: Record<string, unknown> = {};
    if (args.guestName !== undefined) patch.guestName = args.guestName.trim();
    if (args.guestPhone !== undefined) patch.guestPhone = args.guestPhone.trim();
    if (args.guestEmail !== undefined) patch.guestEmail = args.guestEmail.trim() || undefined;
    if (args.partySize !== undefined) {
      if (args.partySize < 1) throw new Error("Party size must be at least 1");
      patch.partySize = args.partySize;
    }
    if (args.date !== undefined) patch.date = args.date;
    if (args.time !== undefined) {
      if (toMinutes(args.time) === null) throw new Error("Invalid reservation time");
      patch.time = args.time.trim();
    }
    if (args.durationMinutes !== undefined) patch.durationMinutes = args.durationMinutes;
    if (args.notes !== undefined) patch.notes = args.notes.trim() || undefined;

    if (args.tableId !== undefined) {
      const table = await ctx.db.get(args.tableId);
      if (!table || table.restaurantId !== reservation.restaurantId) {
        throw new Error("Table not found");
      }
      patch.tableId = args.tableId;
      patch.tableLabel = table.label;
    }

    await ctx.db.patch(args.id, patch);
  },
});

export const setStatus = mutation({
  args: { id: v.id("reservations"), status: statusValidator },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.id);
    if (!reservation) throw new Error("Reservation not found");

    const now = Date.now();
    const patch: Record<string, unknown> = { status: args.status };
    if (args.status === "seated") patch.seatedAt = now;
    if (args.status === "completed" || args.status === "cancelled" || args.status === "no_show") {
      patch.completedAt = now;
    }
    await ctx.db.patch(args.id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("reservations") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// ── Waitlist ─────────────────────────────────────────────────────────────

export const addToWaitlist = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    guestName: v.string(),
    guestPhone: v.string(),
    partySize: v.number(),
    notes: v.optional(v.string()),
    quotedMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.guestName.trim()) throw new Error("Guest name is required");
    if (args.partySize < 1) throw new Error("Party size must be at least 1");

    // Estimate from the live queue and how many tables can turn over.
    const [waiting, tables] = await Promise.all([
      ctx.db
        .query("waitlistEntries")
        .withIndex("by_restaurant_status", (q) =>
          q.eq("restaurantId", args.restaurantId).eq("status", "waiting"),
        )
        .collect(),
      ctx.db
        .query("tables")
        .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
        .collect(),
    ]);
    const activeTables = Math.max(1, tables.filter((t) => t.isActive).length);
    const partyAhead = waiting.filter((entry) => entry.partySize >= args.partySize).length;
    const estimate = Math.max(
      5,
      Math.round(((partyAhead + 1) * AVG_TURN_MINUTES) / activeTables / 3) * 5,
    );

    return await ctx.db.insert("waitlistEntries", {
      restaurantId: args.restaurantId,
      guestName: args.guestName.trim(),
      guestPhone: args.guestPhone.trim(),
      partySize: args.partySize,
      status: "waiting",
      quotedMinutes: args.quotedMinutes ?? estimate,
      notes: args.notes?.trim() || undefined,
      joinedAt: Date.now(),
    });
  },
});

export const notifyWaitlistGuest = mutation({
  args: { id: v.id("waitlistEntries") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { notifiedAt: Date.now() });
  },
});

export const seatWaitlistGuest = mutation({
  args: {
    id: v.id("waitlistEntries"),
    tableId: v.optional(v.id("tables")),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id);
    if (!entry) throw new Error("Waitlist entry not found");

    let tableLabel: string | undefined;
    if (args.tableId) {
      const table = await ctx.db.get(args.tableId);
      if (!table || table.restaurantId !== entry.restaurantId) {
        throw new Error("Table not found");
      }
      tableLabel = table.label;
    }

    await ctx.db.patch(args.id, {
      status: "seated",
      seatedAt: Date.now(),
      tableId: args.tableId,
      tableLabel,
    });
  },
});

export const cancelWaitlistGuest = mutation({
  args: { id: v.id("waitlistEntries") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "cancelled" });
  },
});

export const getDayStats = query({
  args: { restaurantId: v.id("restaurants"), date: v.string() },
  handler: async (ctx, args) => {
    const reservations = await ctx.db
      .query("reservations")
      .withIndex("by_restaurant_date", (q) =>
        q.eq("restaurantId", args.restaurantId).eq("date", args.date),
      )
      .collect();
    const waiting = await ctx.db
      .query("waitlistEntries")
      .withIndex("by_restaurant_status", (q) =>
        q.eq("restaurantId", args.restaurantId).eq("status", "waiting"),
      )
      .collect();

    return {
      booked: reservations.filter((r) => r.status === "booked").length,
      seated: reservations.filter((r) => r.status === "seated").length,
      noShows: reservations.filter((r) => r.status === "no_show").length,
      cancels: reservations.filter((r) => r.status === "cancelled").length,
      covers: reservations
        .filter((r) => r.status === "booked" || r.status === "seated" || r.status === "completed")
        .reduce((sum, r) => sum + r.partySize, 0),
      waitlistWaiting: waiting.length,
      waitlistGuests: waiting.reduce((sum, w) => sum + w.partySize, 0),
    };
  },
});

export const upcoming = query({
  args: { restaurantId: v.id("restaurants"), date: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("reservations")
      .withIndex("by_restaurant_date", (q) => q.eq("restaurantId", args.restaurantId))
      .collect();
    return rows
      .filter((r) => r.status === "booked" && r.date >= args.date)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .slice(0, 20);
  },
});
