import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Internal helpers live in their own module so the public marketing API can
 * reference them without the same-file `internal.*` circular inference that
 * breaks Convex's generated types.
 */

export const campaignForSend = internalQuery({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return null;
    const restaurant = await ctx.db.get(campaign.restaurantId);
    if (!restaurant) return null;

    const customers = await ctx.db
      .query("customers")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", campaign.restaurantId))
      .collect();

    const lapsedCutoff = Date.now() - 45 * 24 * 60 * 60 * 1000;
    const audience = customers.filter((customer) => {
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
    });

    return {
      campaign,
      restaurant: { name: restaurant.name, phone: restaurant.phone },
      // Email needs an address; SMS/WhatsApp handoff uses phone numbers.
      recipients: audience
        .filter((customer) =>
          campaign.channel === "email" ? Boolean(customer.email) : Boolean(customer.phone),
        )
        .map((customer) => ({
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        })),
      totalAudience: audience.length,
    };
  },
});

export const recordCampaignResult = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    sentCount: v.number(),
    failedCount: v.number(),
    recipientCount: v.optional(v.number()),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return;
    const sent = args.sentCount > 0;
    await ctx.db.patch(args.campaignId, {
      status: sent ? "sent" : "failed",
      recipientCount: args.recipientCount ?? campaign.recipientCount,
      sentCount: args.sentCount,
      failedCount: args.failedCount,
      lastError: args.lastError,
      sentAt: sent ? Date.now() : undefined,
    });
  },
});
