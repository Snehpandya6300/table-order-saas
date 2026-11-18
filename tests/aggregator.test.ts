import { describe, expect, test } from "bun:test";
import {
  PayloadError,
  detectEventType,
  extractOutletReference,
  getPlatformDefinition,
  mapInternalStatusToPlatform,
  normalizeOrderPayload,
  normalizeStatusPayload,
  resolveStation,
  resolveStations,
} from "../src/convex/aggregatorAdapters";
import {
  hmacHex,
  safeEqual,
  sha256Hex,
  stripSignaturePrefix,
} from "../src/convex/aggregatorSignature";

/**
 * Targeted tests for the third-party aggregator module.
 *
 * These cover the pure parts of the pipeline: payload dialects, signature
 * verification, idempotency key derivation, event classification (including
 * out-of-order detection) and kitchen routing. Database-level behaviour
 * (duplicate order creation, mapping replay) lives in the Convex mutation and
 * is exercised from Settings → Online Ordering.
 */

const charges = { subtotal: 200, tax: 10, delivery_fee: 25, total: 235 };

const zomatoOrder = {
  event: "order.placed",
  order_id: "ZOM-1001",
  restaurant_id: "KOR-1",
  customer: {
    name: "Aarav Sharma",
    phone: "+91 98100 11111",
    delivery_address: "12 MG Road",
  },
  order_items: [
    { item_id: "i1", name: "Margherita Pizza", quantity: 2, price: 250 },
    {
      item_id: "i2",
      name: "Coke",
      quantity: 1,
      price: 60,
      note: "No ice",
      addons: [{ name: "Extra Cheese", price: 50 }],
    },
  ],
  charges,
  commission: 60,
  payment_status: "paid",
  order_type: "delivery",
};

const swiggyOrder = {
  event_type: "order.new",
  orderId: "SWG-2002",
  store_id: "KOR-1",
  customerName: "Neha Verma",
  customerPhone: "+91 98200 22222",
  address: "44 Indiranagar",
  items: [
    { itemId: "i3", name: "Chicken Biryani", unitPrice: 320, qty: 1 },
  ],
  bill: { subtotal: 320, taxes: 16, deliveryFee: 30, total: 366 },
  payment: { status: "PAID" },
  order_type: "takeaway",
};

describe("incoming aggregator orders", () => {
  test("normalises a Zomato order with customer, notes, addons and charges", () => {
    const order = normalizeOrderPayload("zomato", zomatoOrder);

    expect(order.externalOrderId).toBe("ZOM-1001");
    expect(order.items).toHaveLength(2);
    expect(order.items[0]).toEqual({
      externalItemId: "i1",
      name: "Margherita Pizza",
      price: 250,
      quantity: 2,
      note: undefined,
    });
    expect(order.items[1].note).toBe("No ice · Extra Cheese (+50)");
    expect(order.customerName).toBe("Aarav Sharma");
    expect(order.customerPhone).toBe("+91 98100 11111");
    expect(order.customerAddress).toBe("12 MG Road");
    expect(order.subtotal).toBe(200);
    expect(order.taxAmount).toBe(10);
    expect(order.deliveryFee).toBe(25);
    expect(order.totalAmount).toBe(235);
    expect(order.commission).toBe(60);
    expect(order.platformPaid).toBe(true);
    expect(order.channel).toBe("delivery");
  });

  test("normalises a Swiggy order and reads the bill plus payment block", () => {
    const order = normalizeOrderPayload("swiggy", swiggyOrder);

    expect(order.externalOrderId).toBe("SWG-2002");
    expect(order.items[0]).toMatchObject({
      externalItemId: "i3",
      name: "Chicken Biryani",
      price: 320,
      quantity: 1,
    });
    expect(order.totalAmount).toBe(366);
    expect(order.platformPaid).toBe(true);
    expect(order.channel).toBe("takeaway");
    expect(order.customerPhone).toBe("+91 98200 22222");
  });

  test("normalises UrbanPiper, Petpooja and the generic adapter", () => {
    const urbanpiper = normalizeOrderPayload("urbanpiper", {
      event: "order.placed",
      id: "UPI-1",
      items: [{ sku_id: "s1", name: "Paneer Tikka", price: 210, qty: 2 }],
      charges: { subtotal: 420, tax: 21, delivery_fee: 0, grand_total: 441 },
      payment_status: "settled",
      commission: 44,
    });
    expect(urbanpiper.externalOrderId).toBe("UPI-1");
    expect(urbanpiper.items[0].quantity).toBe(2);
    expect(urbanpiper.totalAmount).toBe(441);
    expect(urbanpiper.platformPaid).toBe(true);

    const petpooja = normalizeOrderPayload("petpooja", {
      event: "new_order",
      order_id: "PET-9",
      cust_name: "Priya Nair",
      cust_contact: "+91 98400 44444",
      items: [{ item_id: "p1", item_name: "Naan", quantity: 3, price: 40 }],
      charges,
      payment_status: "unpaid",
    });
    expect(petpooja.customerName).toBe("Priya Nair");
    expect(petpooja.platformPaid).toBe(false);

    const generic = normalizeOrderPayload("custom", {
      event: "order.placed",
      order_id: "GEN-7",
      items: [{ item_id: "g1", name: "Pasta", quantity: 1, price: 300 }],
      charges,
    });
    expect(generic.externalOrderId).toBe("GEN-7");
    expect(generic.items[0].name).toBe("Pasta");
  });

  test("rejects malformed payloads instead of importing garbage", () => {
    expect(() =>
      normalizeOrderPayload("zomato", { order_id: "x", order_items: [] }),
    ).toThrow(PayloadError);
    expect(() => normalizeOrderPayload("zomato", { order_items: [] })).toThrow(
      /missing the external order id/,
    );
    expect(() =>
      normalizeOrderPayload("zomato", {
        order_id: "x",
        order_items: [{ name: "Nameless price" }],
      }),
    ).toThrow(/missing a price/);
    expect(() =>
      normalizeOrderPayload("zomato", {
        order_id: "x",
        order_items: [{ price: 10 }],
      }),
    ).toThrow(/missing a name/);
  });
});

describe("platform-paid vs collectable orders", () => {
  const lineItem = {
    item_id: "i1",
    name: "Item",
    quantity: 1,
    price: 100,
  };

  const paidFlag = (payment: Record<string, unknown>) =>
    normalizeOrderPayload("zomato", {
      order_id: "PAY-1",
      order_items: [lineItem],
      ...payment,
    }).platformPaid;

  test("never treats unpaid, pending or cash-on-delivery as prepaid", () => {
    expect(paidFlag({ payment_status: "unpaid" })).toBe(false);
    expect(paidFlag({ payment_status: "PENDING" })).toBe(false);
    expect(paidFlag({ payment_mode: "COD" })).toBe(false);
    expect(paidFlag({ payment_mode: "cash" })).toBe(false);
    expect(paidFlag({ payment: { status: "authorized" } })).toBe(false);
    expect(paidFlag({})).toBe(false);
  });

  test("recognises platform-paid orders", () => {
    expect(paidFlag({ payment_status: "paid" })).toBe(true);
    expect(paidFlag({ payment_status: "settled" })).toBe(true);
    expect(paidFlag({ payment: { status: "captured" } })).toBe(true);
    expect(paidFlag({ payment_mode: "online" })).toBe(true);
  });
});

describe("webhook event classification", () => {
  test("classifies new orders", () => {
    expect(detectEventType("zomato", zomatoOrder)).toBe("order.placed");
    expect(detectEventType("swiggy", swiggyOrder)).toBe("order.placed");
    expect(
      detectEventType("petpooja", { event: "new_order", order_id: "x" }),
    ).toBe("order.placed");
  });

  test("classifies cancellations and status updates", () => {
    expect(
      detectEventType("zomato", { event: "order.cancelled", order_id: "x" }),
    ).toBe("order.cancelled");
    expect(
      detectEventType("swiggy", { event_type: "order.status", order_id: "x" }),
    ).toBe("order.status");
    expect(
      detectEventType("urbanpiper", { event: "order.updated", order_id: "x" }),
    ).toBe("order.status");
  });

  test("treats an item-less payload as a status event (out-of-order intake)", () => {
    expect(detectEventType("zomato", { order_id: "x", status: "preparing" })).toBe(
      "order.status",
    );
    expect(detectEventType("zomato", { status: "cancelled" })).toBe("order.status");
  });
});

describe("status synchronisation", () => {
  test("maps inbound platform statuses to internal statuses", () => {
    expect(normalizeStatusPayload("zomato", { order_id: "x", status: "accepted" })).toEqual({
      externalOrderId: "x",
      status: "accepted",
      reason: undefined,
    });
    expect(
      normalizeStatusPayload("swiggy", { order_id: "x", status: "in_kitchen" }).status,
    ).toBe("preparing");
    expect(
      normalizeStatusPayload("urbanpiper", { order_id: "x", status: "dispatched" }).status,
    ).toBe("ready");
    expect(
      normalizeStatusPayload("petpooja", { order_id: "x", status: "delivered" }).status,
    ).toBe("served");
  });

  test("keeps the cancellation reason and rejects unknown statuses", () => {
    const cancelled = normalizeStatusPayload("zomato", {
      order_id: "x",
      status: "cancelled",
      reason: "Item out of stock",
    });
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.reason).toBe("Item out of stock");

    expect(() =>
      normalizeStatusPayload("zomato", { order_id: "x", status: "teleported" }),
    ).toThrow(/Unsupported status/);
    expect(() => normalizeStatusPayload("zomato", { status: "ready" })).toThrow(
      /missing the external order id/,
    );
  });

  test("maps internal statuses to each platform vocabulary", () => {
    expect(mapInternalStatusToPlatform("zomato", "served")).toBe("dispatched");
    expect(mapInternalStatusToPlatform("swiggy", "accepted")).toBe("confirm");
    expect(mapInternalStatusToPlatform("petpooja", "cancelled")).toBe("cancelled");
    expect(mapInternalStatusToPlatform("custom", "preparing")).toBe("preparing");
  });
});

describe("signature verification", () => {
  const secret = "whsec_test_123";
  const body = JSON.stringify(zomatoOrder);

  test("HMAC-SHA256 is stable for identical bodies", async () => {
    const first = await hmacHex(secret, body);
    const second = await hmacHex(secret, body);
    expect(first).toBe(second);
    expect(first).toHaveLength(64);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  test("accepts the correct signature and rejects tampering", async () => {
    const signature = await hmacHex(secret, body);
    expect(safeEqual(signature, signature)).toBe(true);
    expect(safeEqual(stripSignaturePrefix(`sha256=${signature}`), signature)).toBe(
      true,
    );
    expect(safeEqual(stripSignaturePrefix(`hmac-sha256=${signature}`), signature)).toBe(
      true,
    );

    const tamperedBody = body.replace("ZOM-1001", "ZOM-9999");
    const tamperedSignature = await hmacHex(secret, tamperedBody);
    expect(safeEqual(signature, tamperedSignature)).toBe(false);
    expect(safeEqual(signature, await hmacHex("other-secret", body))).toBe(false);
    expect(safeEqual(signature, signature.slice(0, -2))).toBe(false);
  });

  test("retried deliveries derive the same idempotency key", async () => {
    // Mirrors the webhook's fallback event id: `<eventType>:<sha256[0..24]>`
    const keyFor = async (payload: string) =>
      `order.placed:${(await sha256Hex(payload)).slice(0, 24)}`;
    const retryKey = await keyFor(JSON.stringify(zomatoOrder));
    expect(await keyFor(JSON.stringify(zomatoOrder))).toBe(retryKey);
    expect(await keyFor(JSON.stringify({ ...zomatoOrder, order_id: "ZOM-1002" }))).not.toBe(
      retryKey,
    );
  });
});

describe("branch mapping", () => {
  test("reads outlet references from common payload shapes", () => {
    expect(extractOutletReference({ store_id: "KOR-1" })).toBe("KOR-1");
    expect(extractOutletReference({ restaurant_id: "R9" })).toBe("R9");
    expect(extractOutletReference({ store: { id: "BLR-2" } })).toBe("BLR-2");
    expect(extractOutletReference({ outlet_id: "MUM-3" })).toBe("MUM-3");
    expect(extractOutletReference({ order_id: "no-outlet" })).toBeUndefined();
  });
});

describe("kitchen station routing", () => {
  test("routes categories and item names to stations", () => {
    expect(resolveStation("Masala Chai")).toBe("Beverages");
    expect(resolveStation("Beverages", "Cold Coffee")).toBe("Beverages");
    expect(resolveStation("Tandoori Chicken")).toBe("Grill");
    expect(resolveStation("Chocolate Brownie")).toBe("Bakery");
    expect(resolveStation("Veg Soup")).toBe("Starters");
    expect(resolveStation("Paneer Butter Masala")).toBe("Main Kitchen");
  });

  test("collects distinct stations for a mixed order", () => {
    const stations = resolveStations([
      { name: "Masala Chai" },
      { name: "Masala Chai" },
      { name: "Paneer Tikka" },
      { name: "Veg Soup" },
    ]);
    expect(stations.sort()).toEqual(["Beverages", "Grill", "Starters"]);
  });

  test("falls back to the main kitchen when nothing matches", () => {
    expect(resolveStations([])).toEqual(["Main Kitchen"]);
  });
});

describe("platform catalogue", () => {
  test("declares capabilities honestly for every platform", () => {
    expect(getPlatformDefinition("swiggy").capabilities.menuSync).toBe(false);
    expect(getPlatformDefinition("petpooja").capabilities.settlement).toBe(false);
    expect(getPlatformDefinition("zomato").capabilities.statusSync).toBe(true);
    expect(getPlatformDefinition("unknown").id).toBe("custom");
  });
});
