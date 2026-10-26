import { v } from "convex/values";
import { mutation, action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const OTP_TTL_MS = 5 * 60 * 1000; // code valid for 5 minutes
const RESEND_COOLDOWN_MS = 30 * 1000; // min 30s between sends per phone
const MAX_ATTEMPTS = 5; // max wrong attempts per code

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

// Generate + store a 6-digit code (internal, called by the sendOtp action)
export const createCode = internalMutation({
  args: { restaurantId: v.id("restaurants"), phone: v.string() },
  handler: async (ctx, args) => {
    const phone = normalizePhone(args.phone);
    if (phone.length < 8) {
      throw new Error("Please enter a valid mobile number.");
    }

    const existing = await ctx.db
      .query("phoneOtps")
      .withIndex("by_restaurant_phone", (q) =>
        q.eq("restaurantId", args.restaurantId).eq("phone", phone),
      )
      .collect();

    const now = Date.now();
    for (const otp of existing) {
      if (now - otp.createdAt < RESEND_COOLDOWN_MS) {
        const wait = Math.ceil(
          (RESEND_COOLDOWN_MS - (now - otp.createdAt)) / 1000,
        );
        throw new Error(`Please wait ${wait}s before requesting a new code.`);
      }
    }
    for (const otp of existing) {
      await ctx.db.delete(otp._id);
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const otpId = await ctx.db.insert("phoneOtps", {
      restaurantId: args.restaurantId,
      phone,
      code,
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      createdAt: now,
    });

    return { otpId, code, phone };
  },
});

// Send an OTP via SMS (Twilio). Falls back to returning the code for
// development when no SMS provider is configured.
export const sendOtp = action({
  args: { restaurantId: v.id("restaurants"), phone: v.string() },
  handler: async (ctx, args): Promise<{
    sent: boolean;
    otpId: Id<"phoneOtps">;
    devOtp?: string;
    reason?: string;
  }> => {
    const { otpId, code, phone } = await ctx.runMutation(
      internal.otp.createCode,
      { restaurantId: args.restaurantId, phone: args.phone },
    );

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;

    if (!sid || !token || !from) {
      // No SMS provider configured — return the code so the flow is testable
      console.warn("Twilio not configured — returning OTP for dev fallback");
      return { sent: false, otpId, devOtp: code, reason: "no_provider" };
    }

    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: phone,
            From: from,
            Body: `Your verification code is ${code}. Valid for 5 minutes. Do not share it with anyone.`,
          }),
        },
      );

      if (!res.ok) {
        const detail = await res.text();
        console.error("Twilio SMS error:", detail);
        return { sent: false, otpId, devOtp: code, reason: "sms_error" };
      }

      return { sent: true, otpId };
    } catch (err) {
      console.error("OTP SMS send failed:", err);
      return { sent: false, otpId, devOtp: code, reason: "network_error" };
    }
  },
});

// Verify a code. Deletes the record on success (single-use) and
// tracks failed attempts to prevent brute-forcing.
export const verify = mutation({
  args: { otpId: v.id("phoneOtps"), code: v.string() },
  handler: async (ctx, args) => {
    const otp = await ctx.db.get(args.otpId);
    if (!otp) {
      return {
        verified: false,
        error: "Code expired. Please request a new one.",
      };
    }
    if (Date.now() > otp.expiresAt) {
      await ctx.db.delete(args.otpId);
      return {
        verified: false,
        error: "Code expired. Please request a new one.",
      };
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      await ctx.db.delete(args.otpId);
      return {
        verified: false,
        error: "Too many attempts. Please request a new code.",
      };
    }
    if (otp.code !== args.code.trim()) {
      await ctx.db.patch(args.otpId, { attempts: otp.attempts + 1 });
      return { verified: false, error: "Incorrect code. Please try again." };
    }

    await ctx.db.delete(args.otpId);
    return { verified: true };
  },
});
