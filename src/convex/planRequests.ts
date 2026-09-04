import { v } from "convex/values";
import { mutation, action, query } from "./_generated/server";

// Store a plan upgrade request and send email to super admin
export const submit = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    restaurantName: v.string(),
    ownerName: v.string(),
    ownerEmail: v.string(),
    ownerPhone: v.optional(v.string()),
    currentPlan: v.string(),
    requestedPlan: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requestId = await ctx.db.insert("planRequests", {
      restaurantId: args.restaurantId,
      restaurantName: args.restaurantName,
      ownerName: args.ownerName,
      ownerEmail: args.ownerEmail,
      ownerPhone: args.ownerPhone,
      currentPlan: args.currentPlan,
      requestedPlan: args.requestedPlan,
      message: args.message,
      status: "pending",
      createdAt: Date.now(),
    });

    return requestId;
  },
});

// Send email notification to super admin via Resend
export const sendEmail = action({
  args: {
    restaurantName: v.string(),
    ownerName: v.string(),
    ownerEmail: v.string(),
    ownerPhone: v.optional(v.string()),
    currentPlan: v.string(),
    requestedPlan: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("RESEND_API_KEY not configured — skipping email");
      return { sent: false, reason: "no_api_key" };
    }

    const planLabels: Record<string, string> = {
      free: "Free ($0/mo)",
      pro: "Pro ($29/mo)",
      enterprise: "Enterprise ($79/mo)",
    };

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;">
        <div style="background: linear-gradient(135deg, #FF6B35, #F7931E); padding: 20px 24px; border-radius: 10px 10px 0 0; margin: -24px -24px 24px -24px;">
          <h1 style="color: #fff; margin: 0; font-size: 22px; font-weight: 700;">📋 New Plan Upgrade Request</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 6px 0 0; font-size: 14px;">QR Table Order — Super Admin Notification</p>
        </div>

        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 16px; color: #374151; margin: 0 0 12px; border-bottom: 2px solid #FF6B35; padding-bottom: 6px;">Restaurant Details</h2>
          <table style="width: 100%; font-size: 14px; color: #4b5563;">
            <tr><td style="padding: 6px 0; font-weight: 600; width: 140px;">Restaurant:</td><td>${args.restaurantName}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Owner:</td><td>${args.ownerName}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Email:</td><td><a href="mailto:${args.ownerEmail}" style="color: #FF6B35;">${args.ownerEmail}</a></td></tr>
            ${args.ownerPhone ? `<tr><td style="padding: 6px 0; font-weight: 600;">Phone:</td><td>${args.ownerPhone}</td></tr>` : ""}
          </table>
        </div>

        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 16px; color: #374151; margin: 0 0 12px; border-bottom: 2px solid #F7931E; padding-bottom: 6px;">Upgrade Details</h2>
          <table style="width: 100%; font-size: 14px; color: #4b5563;">
            <tr><td style="padding: 6px 0; font-weight: 600; width: 140px;">Current Plan:</td><td>${planLabels[args.currentPlan] || args.currentPlan}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Requested Plan:</td><td style="color: #FF6B35; font-weight: 700;">${planLabels[args.requestedPlan] || args.requestedPlan}</td></tr>
          </table>
        </div>

        ${args.message ? `
        <div style="margin-bottom: 20px; background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 14px;">
          <h3 style="font-size: 13px; color: #92400e; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.5px;">Message from Owner</h3>
          <p style="margin: 0; font-size: 14px; color: #78350f; line-height: 1.5;">${args.message}</p>
        </div>
        ` : ""}

        <div style="background: #f9fafb; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 13px; color: #6b7280;">
            <strong>Next steps:</strong> Contact the restaurant owner to discuss the upgrade, process payment, and update their plan in the <a href="https://yourapp.com/admin" style="color: #FF6B35;">Admin Panel</a>.
          </p>
        </div>

        <div style="text-align: center; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 12px; color: #9ca3af;">This email was sent automatically by QR Table Order.</p>
        </div>
      </div>
    `;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "QR Table Order <onboarding@resend.dev>",
          to: ["snehbeta@gmail.com"],
          subject: `🆕 Plan Upgrade Request — ${args.restaurantName} wants ${args.requestedPlan.toUpperCase()}`,
          html,
          reply_to: args.ownerEmail,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("Resend API error:", err);
        return { sent: false, reason: "api_error", detail: err };
      }

      return { sent: true };
    } catch (err) {
      console.error("Email send failed:", err);
      return { sent: false, reason: "network_error" };
    }
  },
});

// List all pending requests (for super admin)
export const listPending = query({
  handler: async (ctx) => {
    const requests = await ctx.db
      .query("planRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();
    return requests;
  },
});

// Mark request as contacted/completed
export const updateStatus = mutation({
  args: {
    requestId: v.id("planRequests"),
    status: v.union(
      v.literal("pending"),
      v.literal("contacted"),
      v.literal("completed"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, { status: args.status });
  },
});
