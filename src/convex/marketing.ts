import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { evaluateCoupon, couponWindowLabel } from "./couponOps";

const couponType = v.union(v.literal("percent"), v.literal("flat"));
const audienceType = v.union(
  v.literal("all"),
  v.literal("repeat"),
  v.literal("lapsed"),
  v.literal("high_spenders"),
);

// ── Coupons ──────────────────────────────────────────────────────────────

export const listCoupons = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    const coupons = await ctx.db
      .query("coupons")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
      .collect();
    return coupons
      .map((coupon) => ({
        ...coupon,
        window: couponWindowLabel(coupon),
        remaining:
          coupon.maxUses === undefined ? null : Math.max(0, coupon.maxUses - coupon.usedCount),
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const createCoupon = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    code: v.string(),
    description: v.optional(v.string()),
    type: couponType,
    value: v.number(),
    minOrder: v.optional(v.number()),
    maxDiscount: v.optional(v.number()),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    daysOfWeek: v.optional(v.array(v.number())),
    maxUses: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const code = args.code.trim().toUpperCase().replace(/\s+/g, "");
    if (code.length < 3) throw new Error("Coupon code must be at least 3 characters");
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      throw new Error("Use letters, numbers, dashes or underscores only");
    }
    if (args.value <= 0) throw new Error("Discount value must be greater than zero");
    if (args.type === "percent" && args.value > 100) {
      throw new Error("Percentage discount cannot exceed 100%");
    }
    if (args.startsAt && args.endsAt && args.startsAt >= args.endsAt) {
      throw new Error("The start date must come before the end date");
    }
    if (Boolean(args.startTime) !== Boolean(args.endTime)) {
      throw new Error("Set both a happy-hour start and end time");
    }

    const existing = await ctx.db
      .query("coupons")
      .withIndex("by_restaurant_code", (q) =>
        q.eq("restaurantId", args.restaurantId).eq("code", code),
      )
      .first();
    if (existing) throw new Error(`Coupon ${code} already exists`);

    return await ctx.db.insert("coupons", {
      restaurantId: args.restaurantId,
      code,
      description: args.description?.trim() || undefined,
      type: args.type,
      value: args.value,
      minOrder: args.minOrder ?? 0,
      maxDiscount: args.maxDiscount,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      startTime: args.startTime,
      endTime: args.endTime,
      daysOfWeek: args.daysOfWeek,
      maxUses: args.maxUses,
      usedCount: 0,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const updateCoupon = mutation({
  args: {
    id: v.id("coupons"),
    description: v.optional(v.string()),
    value: v.optional(v.number()),
    minOrder: v.optional(v.number()),
    maxDiscount: v.optional(v.number()),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    daysOfWeek: v.optional(v.array(v.number())),
    maxUses: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    if (rest.value !== undefined && rest.value <= 0) {
      throw new Error("Discount value must be greater than zero");
    }
    await ctx.db.patch(id, rest);
  },
});

export const removeCoupon = mutation({
  args: { id: v.id("coupons") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/** Preview an order total with a coupon — same evaluator checkout uses. */
export const previewCoupon = query({
  args: {
    restaurantId: v.id("restaurants"),
    code: v.string(),
    subtotal: v.number(),
  },
  handler: async (ctx, args) => {
    const evaluation = await evaluateCoupon(
      ctx,
      args.restaurantId,
      args.code,
      args.subtotal,
    );
    if (!evaluation.ok) return { ok: false as const, reason: evaluation.reason };
    return {
      ok: true as const,
      code: evaluation.coupon.code,
      discount: evaluation.discount,
      total: Math.round((args.subtotal - evaluation.discount) * 100) / 100,
      description: evaluation.coupon.description,
    };
  },
});

// ── Campaigns ────────────────────────────────────────────────────────────

export const listCampaigns = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    const campaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
      .collect();
    return campaigns.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const createCampaign = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    name: v.string(),
    channel: v.union(v.literal("email"), v.literal("sms"), v.literal("whatsapp")),
    subject: v.optional(v.string()),
    body: v.string(),
    fromAddress: v.optional(v.string()),
    audience: audienceType,
  },
  handler: async (ctx, args) => {
    if (!args.name.trim()) throw new Error("Campaign name is required");
    if (!args.body.trim()) throw new Error("Write the campaign message");
    if (args.channel === "email" && !args.subject?.trim()) {
      throw new Error("Email campaigns need a subject line");
    }

    return await ctx.db.insert("campaigns", {
      restaurantId: args.restaurantId,
      name: args.name.trim(),
      channel: args.channel,
      subject: args.subject?.trim() || undefined,
      body: args.body.trim(),
      fromAddress: args.fromAddress?.trim() || undefined,
      audience: args.audience,
      status: "draft",
      recipientCount: 0,
      sentCount: 0,
      failedCount: 0,
      createdAt: Date.now(),
    });
  },
});

export const deleteCampaign = mutation({
  args: { id: v.id("campaigns") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/** Audience size for each segment, used by the campaign composer. */
export const audienceSizes = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, args) => {
    const customers = await ctx.db
      .query("customers")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
      .collect();
    const lapsedCutoff = Date.now() - 45 * 24 * 60 * 60 * 1000;

    return {
      all: customers.length,
      repeat: customers.filter((c) => c.totalOrders > 1).length,
      lapsed: customers.filter((c) => c.lastOrderAt < lapsedCutoff).length,
      high_spenders: customers.filter((c) => c.totalSpent >= 1000).length,
      withEmail: customers.filter((c) => c.email).length,
      withPhone: customers.filter((c) => c.phone).length,
    };
  },
});

/**
 * Sends an email campaign through the restaurant's mail provider. Resend is
 * used because it accepts any verified sending domain, so a restaurant can
 * send from reservations@their-domain.com rather than a shared address.
 * SMS and WhatsApp are intentionally a handoff: export the audience and run
 * the blast in the restaurant's messaging tool.
 */
export const sendEmailCampaign = action({
  args: { campaignId: v.id("campaigns"), limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ sent: boolean; sentCount: number; failedCount: number; reason?: string }> => {
    const data = await ctx.runQuery(internal.marketingInternal.campaignForSend, {
      campaignId: args.campaignId,
    });
    if (!data) return { sent: false, sentCount: 0, failedCount: 0, reason: "Campaign not found" };
    if (data.campaign.channel !== "email") {
      return { sent: false, sentCount: 0, failedCount: 0, reason: "Not an email campaign" };
    }

    const recipients = data.recipients
      .slice(0, args.limit ?? 50)
      .map((recipient) => ({ ...recipient, email: recipient.email ?? "" }))
      .filter((recipient) => recipient.email.length > 0);

    if (recipients.length === 0) {
      await ctx.runMutation(internal.marketingInternal.recordCampaignResult, {
        campaignId: args.campaignId,
        sentCount: 0,
        failedCount: 0,
        recipientCount: 0,
        lastError: "No customers in this audience have an email address",
      });
      return {
        sent: false,
        sentCount: 0,
        failedCount: 0,
        reason: "No customers in this audience have an email address",
      };
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.marketingInternal.recordCampaignResult, {
        campaignId: args.campaignId,
        sentCount: 0,
        failedCount: recipients.length,
        recipientCount: recipients.length,
        lastError: "RESEND_API_KEY is not configured",
      });
      return {
        sent: false,
        sentCount: 0,
        failedCount: recipients.length,
        reason: "Add RESEND_API_KEY in the project keys to send email",
      };
    }

    const sender =
      data.campaign.fromAddress ||
      `${data.restaurant.name} <onboarding@resend.dev>`;
    const bodyHtml = data.campaign.body
      .split("\n")
      .map((line) => `<p style="margin:0 0 12px;line-height:1.6;color:#374151">${line}</p>`)
      .join("");

    let sentCount = 0;
    let failedCount = 0;
    let lastError: string | undefined;

    for (const recipient of recipients) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: sender,
            to: [recipient.email],
            subject: data.campaign.subject ?? data.campaign.name,
            html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <h2 style="font-size:18px;color:#111827;margin:0 0 16px">${data.restaurant.name}</h2>
              ${bodyHtml}
              <p style="margin-top:24px;font-size:12px;color:#9ca3af">You received this because you ordered from ${data.restaurant.name}.</p>
            </div>`,
          }),
        });
        if (response.ok) {
          sentCount += 1;
        } else {
          failedCount += 1;
          lastError = await response.text();
        }
      } catch (error) {
        failedCount += 1;
        lastError = error instanceof Error ? error.message : "Network error";
      }
    }

    await ctx.runMutation(internal.marketingInternal.recordCampaignResult, {
      campaignId: args.campaignId,
      sentCount,
      failedCount,
      recipientCount: recipients.length,
      lastError,
    });

    return { sent: sentCount > 0, sentCount, failedCount, reason: lastError };
  },
});

/** Marks SMS/WhatsApp campaigns as handed to the restaurant's messaging tool. */
export const handOffCampaign = mutation({
  args: { id: v.id("campaigns"), recipientCount: v.number() },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.id);
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.channel === "email") {
      throw new Error("Email campaigns are sent from the app, not handed off");
    }
    await ctx.db.patch(args.id, {
      status: "handed_off",
      recipientCount: args.recipientCount,
      sentCount: args.recipientCount,
      failedCount: 0,
      sentAt: Date.now(),
    });
  },
});

/** Recipient list for handoff / CSV export. */
export const campaignRecipients = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return [];
    const customers = await ctx.db
      .query("customers")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", campaign.restaurantId))
      .collect();
    const lapsedCutoff = Date.now() - 45 * 24 * 60 * 60 * 1000;

    return customers
      .filter((customer) => {
        switch (campaign.audience) {
          case "repeat":
            return customer.totalOrders > 1;
          case "lapsed":
            return customer.lastOrderAt < lapsedCutoff;
          case "high_spenders":
            return customer.totalSpent >= 1000;
          default:
            return true;
        }
      })
      .filter((customer) => (campaign.channel === "email" ? customer.email : customer.phone))
      .map((customer) => ({
        name: customer.name ?? "",
        email: customer.email ?? "",
        phone: customer.phone,
        totalOrders: customer.totalOrders,
        totalSpent: customer.totalSpent,
      }));
  },
});
