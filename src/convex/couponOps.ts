import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { round2 } from "./inventoryOps";

export type CouponEvaluation =
  | { ok: true; coupon: Doc<"coupons">; discount: number }
  | { ok: false; reason: string };

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(h)) return -1;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

/**
 * Single source of truth for coupon validity. Used by the customer checkout
 * mutation and by the dashboard preview so the two can never disagree.
 */
export async function evaluateCoupon(
  ctx: QueryCtx | MutationCtx,
  restaurantId: Id<"restaurants">,
  code: string,
  subtotal: number,
  now = Date.now(),
): Promise<CouponEvaluation> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, reason: "Enter a coupon code" };

  const coupon = await ctx.db
    .query("coupons")
    .withIndex("by_restaurant_code", (q) =>
      q.eq("restaurantId", restaurantId).eq("code", normalized),
    )
    .first();

  if (!coupon) return { ok: false, reason: "That coupon code doesn't exist" };
  if (!coupon.isActive) return { ok: false, reason: "This coupon is no longer active" };
  if (coupon.startsAt && now < coupon.startsAt) {
    return { ok: false, reason: "This coupon isn't valid yet" };
  }
  if (coupon.endsAt && now > coupon.endsAt) {
    return { ok: false, reason: "This coupon has expired" };
  }
  if (coupon.maxUses !== undefined && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, reason: "This coupon has reached its usage limit" };
  }
  if (subtotal < coupon.minOrder) {
    return {
      ok: false,
      reason: `A minimum order of ${coupon.minOrder.toFixed(2)} is required`,
    };
  }

  // Happy-hour style daily window
  if (coupon.daysOfWeek && coupon.daysOfWeek.length > 0) {
    const day = new Date(now).getDay();
    if (!coupon.daysOfWeek.includes(day)) {
      return { ok: false, reason: "This offer isn't available today" };
    }
  }
  if (coupon.startTime && coupon.endTime) {
    const current = new Date(now);
    const minutes = current.getHours() * 60 + current.getMinutes();
    const start = minutesOf(coupon.startTime);
    const end = minutesOf(coupon.endTime);
    if (start >= 0 && end >= 0) {
      const inWindow = start <= end ? minutes >= start && minutes <= end : minutes >= start || minutes <= end;
      if (!inWindow) {
        return {
          ok: false,
          reason: `This offer is only available between ${coupon.startTime} and ${coupon.endTime}`,
        };
      }
    }
  }

  let discount =
    coupon.type === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;
  if (coupon.maxDiscount !== undefined) {
    discount = Math.min(discount, coupon.maxDiscount);
  }
  discount = round2(Math.min(discount, subtotal));
  if (discount <= 0) return { ok: false, reason: "This coupon gives no discount on this order" };

  return { ok: true, coupon, discount };
}

export function couponWindowLabel(coupon: Doc<"coupons">): string {
  if (coupon.startTime && coupon.endTime) {
    return `${coupon.startTime}–${coupon.endTime}`;
  }
  return "All day";
}
