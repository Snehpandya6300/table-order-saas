/**
 * Platform adapters for third-party food delivery aggregators.
 *
 * Every provider speaks a different dialect, so each incoming payload is
 * normalised here into one internal shape before it touches the database.
 * Capabilities are declared per platform: not every aggregator supports the
 * same API operations, so the UI documents unsupported operations instead of
 * pretending every platform behaves the same way.
 */

export type PlatformId = "zomato" | "swiggy" | "urbanpiper" | "petpooja" | "custom";

export type Capabilities = {
  orderIngest: boolean;
  acceptReject: boolean;
  statusSync: boolean;
  menuSync: boolean;
  settlement: boolean;
  paymentInfo: boolean;
};

export type PlatformDefinition = {
  id: PlatformId;
  name: string;
  brandColor: string;
  /** Header the platform uses to sign webhook payloads. */
  signatureHeader: string;
  capabilities: Capabilities;
  /** Human readable note about credentials / limits. */
  note: string;
};

export const PLATFORM_CATALOG: PlatformDefinition[] = [
  {
    id: "zomato",
    name: "Zomato",
    brandColor: "#E23744",
    signatureHeader: "x-zomato-signature",
    capabilities: {
      orderIngest: true,
      acceptReject: true,
      statusSync: true,
      menuSync: true,
      settlement: true,
      paymentInfo: true,
    },
    note: "Needs a Zomato partner API key issued for your outlet. Webhooks are HMAC-SHA256 signed.",
  },
  {
    id: "swiggy",
    name: "Swiggy",
    brandColor: "#FC8019",
    signatureHeader: "x-swiggy-signature",
    capabilities: {
      orderIngest: true,
      acceptReject: true,
      statusSync: true,
      menuSync: false,
      settlement: true,
      paymentInfo: true,
    },
    note: "Swiggy menu push is not part of the partner API — menu edits stay manual here.",
  },
  {
    id: "urbanpiper",
    name: "UrbanPiper",
    brandColor: "#0F62FE",
    signatureHeader: "x-urbanpiper-signature",
    capabilities: {
      orderIngest: true,
      acceptReject: true,
      statusSync: true,
      menuSync: true,
      settlement: true,
      paymentInfo: true,
    },
    note: "UrbanPiper relays orders from multiple brands. Use the outlet id to pick the branch.",
  },
  {
    id: "petpooja",
    name: "Petpooja",
    brandColor: "#7C3AED",
    signatureHeader: "x-petpooja-signature",
    capabilities: {
      orderIngest: true,
      acceptReject: true,
      statusSync: true,
      menuSync: true,
      settlement: false,
      paymentInfo: true,
    },
    note: "Petpooja does not send settlement or commission data, so those figures stay blank.",
  },
  {
    id: "custom",
    name: "Other aggregator",
    brandColor: "#4A8C6F",
    signatureHeader: "x-aggregator-signature",
    capabilities: {
      orderIngest: true,
      acceptReject: true,
      statusSync: true,
      menuSync: false,
      settlement: true,
      paymentInfo: true,
    },
    note: "Generic adapter for any aggregator that can POST a signed JSON webhook.",
  },
];

export function getPlatformDefinition(platform: string): PlatformDefinition {
  return (
    PLATFORM_CATALOG.find((p) => p.id === platform) ??
    PLATFORM_CATALOG[PLATFORM_CATALOG.length - 1]
  );
}

export function signatureHeadersFor(platform: string): string[] {
  const specific = getPlatformDefinition(platform).signatureHeader;
  return [specific, "x-aggregator-signature", "x-webhook-signature"];
}

/* ------------------------------------------------------------------ */
/* Small coercion helpers                                              */
/* ------------------------------------------------------------------ */

type Raw = Record<string, unknown>;

function asRecord(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Raw)
    : {};
}

function pick(source: Raw, keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function toText(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toMoney(value: unknown): number {
  const parsed = toNumber(value);
  return parsed === undefined ? 0 : Math.round(parsed * 100) / 100;
}

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Normalised shapes                                                   */
/* ------------------------------------------------------------------ */

export type NormalizedItem = {
  externalItemId: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
};

export type NormalizedOrder = {
  externalOrderId: string;
  customerName?: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress?: string;
  items: NormalizedItem[];
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  totalAmount: number;
  commission?: number;
  platformPaid: boolean;
  channel: "delivery" | "takeaway";
  externalStatus?: string;
  placedAt?: number;
  instructions?: string;
};

export type NormalizedStatusEvent = {
  externalOrderId: string;
  status: "accepted" | "preparing" | "ready" | "served" | "cancelled";
  reason?: string;
};

export class PayloadError extends Error {}

/** Outlet / branch reference carried by the aggregator payload, if any. */
export function extractOutletReference(payload: Record<string, unknown>): string | undefined {
  const nested = asRecord(pick(payload, ["store", "outlet", "restaurant", "branch"]));
  return (
    toText(pick(nested, ["id", "store_id", "outlet_id", "restaurant_id", "branch_id"])) ??
    toText(
      pick(payload, [
        "store_id",
        "storeId",
        "outlet_id",
        "outletId",
        "restaurant_id",
        "restaurantId",
        "branch_id",
        "branchId",
      ]),
    )
  );
}

/* ------------------------------------------------------------------ */
/* Event type detection                                                */
/* ------------------------------------------------------------------ */

export type AggregatorEventType = "order.placed" | "order.status" | "order.cancelled";

export function detectEventType(platform: PlatformId, payload: Raw): AggregatorEventType {
  const declared = normalizeName(
    toText(pick(payload, ["event", "event_type", "eventType", "type", "action"])) ?? "",
  );

  if (declared.includes("cancel") || declared.includes("reject")) return "order.cancelled";
  if (declared.includes("status") || declared.includes("update") && !declared.includes("place")) {
    return "order.status";
  }
  if (declared.includes("placed") || declared.includes("create") || declared.includes("new")) {
    return "order.placed";
  }

  // Fall back to payload shape: a payload carrying line items is a new order.
  const hasItems = Array.isArray(
    pick(payload, ["items", "order_items", "orderItems", "cart", "line_items"]),
  );
  if (hasItems) return "order.placed";

  void platform;
  return "order.status";
}

/* ------------------------------------------------------------------ */
/* Order payload normalisation                                         */
/* ------------------------------------------------------------------ */

const ITEM_KEYS = ["items", "order_items", "orderItems", "cart", "products", "line_items", "item_list"];

function extractItems(payload: Raw): NormalizedItem[] {
  const rawItems = pick(payload, ITEM_KEYS);
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new PayloadError("Order payload does not contain any line items");
  }

  return rawItems.map((raw, index) => {
    const item = asRecord(raw);
    const name = toText(pick(item, ["name", "item_name", "itemName", "title", "product_name"]));
    if (!name) throw new PayloadError(`Line item ${index + 1} is missing a name`);

    const price = toNumber(
      pick(item, ["price", "unit_price", "unitPrice", "rate", "item_price", "amount"]),
    );
    if (price === undefined) {
      throw new PayloadError(`Line item "${name}" is missing a price`);
    }

    const quantity = Math.max(
      1,
      Math.round(toNumber(pick(item, ["quantity", "qty", "count"])) ?? 1),
    );

    const externalItemId =
      toText(pick(item, ["item_id", "itemId", "id", "sku_id", "skuId", "menu_item_id", "product_id"])) ??
      `unknown-${index}`;

    const note = toText(
      pick(item, ["note", "item_note", "instructions", "special_instructions", "comment"]),
    );

    const addons = pick(item, ["addons", "modifiers", "options", "variants"]);
    const addonText = Array.isArray(addons)
      ? addons
          .map((addon) => {
            const record = asRecord(addon);
            const addonName = toText(record.name);
            const addonPrice = toNumber(record.price);
            if (!addonName) return null;
            return addonPrice ? `${addonName} (+${addonPrice})` : addonName;
          })
          .filter(Boolean)
          .join(", ")
      : "";

    const combinedNote = [note, addonText || undefined].filter(Boolean).join(" · ");

    return {
      externalItemId,
      name,
      price,
      quantity,
      note: combinedNote || undefined,
    };
  });
}

function extractCustomer(payload: Raw) {
  const nested = asRecord(pick(payload, ["customer", "user", "consumer", "delivery_address"]));
  const name =
    toText(pick(nested, ["name", "full_name", "customer_name"])) ??
    toText(pick(payload, ["customer_name", "customerName", "cust_name", "name"]));
  const phone =
    toText(pick(nested, ["phone", "mobile", "contact_number", "phone_number"])) ??
    toText(pick(payload, ["customer_phone", "customerPhone", "cust_contact", "phone", "mobile"])) ??
    "";
  const email =
    toText(pick(nested, ["email"])) ?? toText(pick(payload, ["customer_email", "email"]));
  const address =
    toText(pick(nested, ["address", "line1", "formatted_address", "delivery_address"])) ??
    toText(pick(payload, ["address", "delivery_address", "customer_address"]));

  return { name, phone, email, address };
}

function isPlatformPaid(payload: Raw): boolean {
  const payment = asRecord(pick(payload, ["payment", "payment_details", "transaction"]));
  const raw =
    toText(pick(payment, ["status", "payment_status"])) ??
    toText(pick(payload, ["payment_status", "paymentStatus", "payment_mode", "paid"])) ??
    "";
  const normalized = normalizeName(raw);
  if (!normalized) return false;

  // Careful: "unpaid" contains "paid", and COD / pending must never be
  // treated as prepaid — the restaurant would lose the collection.
  const negatives = [
    "unpaid",
    "not paid",
    "pending",
    "cod",
    "cash",
    "failed",
    "authorized",
    "authorised",
  ];
  if (negatives.some((token) => normalized.includes(token))) return false;

  return ["paid", "settled", "prepaid", "online", "captured", "success"].some(
    (token) => normalized.includes(token),
  );
}

function extractChannel(payload: Raw): "delivery" | "takeaway" {
  const raw =
    toText(pick(payload, ["order_type", "orderType", "delivery_type", "fulfillment", "channel"])) ??
    "";
  const normalized = normalizeName(raw);
  if (normalized.includes("take") || normalized.includes("pick") || normalized.includes("walk")) {
    return "takeaway";
  }
  return "delivery";
}

/**
 * Normalise a "new order" webhook payload for any supported platform.
 * Key aliases cover the payload dialects of Zomato, Swiggy, UrbanPiper,
 * Petpooja and the generic adapter.
 */
export function normalizeOrderPayload(platform: PlatformId, payload: Raw): NormalizedOrder {
  const externalOrderId = toText(
    pick(payload, [
      "order_id",
      "orderId",
      "external_order_id",
      "externalOrderId",
      "ref_id",
      "refId",
      "id",
    ]),
  );
  if (!externalOrderId) {
    throw new PayloadError("Order payload is missing the external order id");
  }

  const items = extractItems(payload);
  const customer = extractCustomer(payload);
  const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const charges = asRecord(pick(payload, ["charges", "bill", "totals", "pricing"]));
  const subtotal = toMoney(pick(charges, ["subtotal", "sub_total", "item_total"])) || itemsTotal;
  const taxAmount = toMoney(pick(charges, ["tax", "taxes", "gst", "tax_amount"]));
  const deliveryFee = toMoney(pick(charges, ["delivery_fee", "deliveryFee", "delivery_charge"]));
  const suppliedTotal = toMoney(pick(charges, ["total", "grand_total", "order_total"]));
  const payloadTotal = toMoney(pick(payload, ["total", "order_total", "grand_total", "amount"]));
  const totalAmount =
    suppliedTotal || payloadTotal || Math.round((subtotal + taxAmount + deliveryFee) * 100) / 100;

  const commission = toNumber(
    pick(payload, ["commission", "commission_amount", "platform_commission"]),
  );

  const placedAt = toNumber(pick(payload, ["created_at", "createdAt", "placed_at", "order_time"]));

  return {
    externalOrderId,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerEmail: customer.email,
    customerAddress: customer.address,
    items,
    subtotal,
    taxAmount,
    deliveryFee,
    totalAmount,
    commission: commission === undefined ? undefined : toMoney(commission),
    platformPaid: isPlatformPaid(payload),
    channel: extractChannel(payload),
    externalStatus: toText(pick(payload, ["status", "order_status", "state"])),
    placedAt: placedAt && placedAt > 0 ? placedAt : undefined,
    instructions: toText(
      pick(payload, ["instructions", "special_instructions", "delivery_instructions", "notes"]),
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Status payload normalisation                                        */
/* ------------------------------------------------------------------ */

const EXTERNAL_STATUS_MAP: Record<string, NormalizedStatusEvent["status"]> = {
  cancelled: "cancelled",
  canceled: "cancelled",
  rejected: "cancelled",
  cancel: "cancelled",
  accepted: "accepted",
  accept: "accepted",
  confirmed: "accepted",
  acknowledged: "accepted",
  preparing: "preparing",
  in_kitchen: "preparing",
  processing: "preparing",
  ready: "ready",
  packed: "ready",
  dispatched: "ready",
  picked_up: "ready",
  delivered: "served",
  completed: "served",
  served: "served",
};

export function normalizeStatusPayload(
  platform: PlatformId,
  payload: Raw,
): NormalizedStatusEvent {
  const externalOrderId = toText(
    pick(payload, ["order_id", "orderId", "external_order_id", "externalOrderId", "ref_id", "id"]),
  );
  if (!externalOrderId) {
    throw new PayloadError("Status payload is missing the external order id");
  }

  const rawStatus =
    toText(pick(payload, ["status", "new_status", "order_status", "state", "event"])) ?? "";
  const key = normalizeName(rawStatus).replace(/ /g, "_");
  const mapped = EXTERNAL_STATUS_MAP[key];
  if (!mapped) {
    throw new PayloadError(
      `Unsupported status "${rawStatus || "unknown"}" for ${getPlatformDefinition(platform).name}`,
    );
  }

  return {
    externalOrderId,
    status: mapped,
    reason: toText(pick(payload, ["reason", "cancellation_reason", "rejection_reason", "note"])),
  };
}

/** Outbound status vocabulary per platform (used for status sync). */
export function mapInternalStatusToPlatform(platform: PlatformId, status: string): string {
  const vocabulary: Record<PlatformId, Record<string, string>> = {
    zomato: {
      accepted: "accepted",
      preparing: "preparing",
      ready: "ready",
      served: "dispatched",
      cancelled: "cancelled",
    },
    swiggy: {
      accepted: "confirm",
      preparing: "in_kitchen",
      ready: "ready",
      served: "delivered",
      cancelled: "cancel",
    },
    urbanpiper: {
      accepted: "accepted",
      preparing: "preparing",
      ready: "ready",
      served: "delivered",
      cancelled: "cancelled",
    },
    petpooja: {
      accepted: "accepted",
      preparing: "preparing",
      ready: "ready",
      served: "completed",
      cancelled: "cancelled",
    },
    custom: {
      accepted: "accepted",
      preparing: "preparing",
      ready: "ready",
      served: "served",
      cancelled: "cancelled",
    },
  };
  return vocabulary[platform][status] ?? status;
}

/* ------------------------------------------------------------------ */
/* Kitchen station routing                                             */
/* ------------------------------------------------------------------ */

const STATION_RULES: { station: string; keywords: string[] }[] = [
  {
    station: "Beverages",
    keywords: [
      "bar",
      "beverage",
      "drink",
      "mocktail",
      "cocktail",
      "shake",
      "juice",
      "coffee",
      "tea",
      "chai",
      "lassi",
      "soda",
      "water",
      "beer",
      "wine",
    ],
  },
  {
    station: "Grill",
    keywords: ["grill", "tandoor", "kebab", "bbq", "barbecue", "seekh", "tikka", "roast"],
  },
  {
    station: "Bakery",
    keywords: [
      "dessert",
      "cake",
      "ice cream",
      "bakery",
      "sweet",
      "brownie",
      "pastry",
      "waffle",
      "jamun",
      "halwa",
    ],
  },
  {
    station: "Starters",
    keywords: ["starter", "appetizer", "appetiser", "soup", "salad", "finger", "snack", "fries"],
  },
];

export const DEFAULT_STATION = "Main Kitchen";

/**
 * Resolve the kitchen station for an item from its category / item name.
 * Deterministic keyword routing so new items land somewhere sensible without
 * extra configuration, and station hints can be overridden by passing a label.
 */
export function resolveStation(...labels: (string | undefined)[]): string {
  const haystack = normalizeName(labels.filter(Boolean).join(" "));
  for (const rule of STATION_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) return rule.station;
  }
  return DEFAULT_STATION;
}

export function resolveStations(
  items: { name: string; categoryName?: string }[],
): string[] {
  const stations = new Set<string>();
  for (const item of items) {
    stations.add(resolveStation(item.categoryName, item.name));
  }
  if (stations.size === 0) stations.add(DEFAULT_STATION);
  return Array.from(stations);
}

export const ALL_STATIONS = [
  DEFAULT_STATION,
  "Starters",
  "Grill",
  "Beverages",
  "Bakery",
];
