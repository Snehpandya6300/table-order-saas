import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { REPORT_CATALOGUE } from "./reportCatalogue";
import { round2 } from "./inventoryOps";

type Cell = string | number;
type ReportResult = {
  key: string;
  title: string;
  description: string;
  columns: string[];
  rows: Cell[][];
  summary: { label: string; value: string }[];
  note?: string;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dayKey(ts: number): string {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function hourKey(ts: number): string {
  return `${String(new Date(ts).getHours()).padStart(2, "0")}:00`;
}

function money(value: number): string {
  return value.toFixed(2);
}

export const get = query({
  args: {
    restaurantId: v.id("restaurants"),
    report: v.string(),
    from: v.number(),
    to: v.number(),
  },
  handler: async (ctx, args): Promise<ReportResult> => {
    const meta = REPORT_CATALOGUE.find((entry) => entry.key === args.report);
    if (!meta) throw new Error(`Unknown report: ${args.report}`);

    const allOrders = await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
      .collect();
    const orders = allOrders.filter(
      (order) =>
        order.createdAt >= args.from &&
        order.createdAt <= args.to &&
        order.status !== "cancelled",
    );

    const [menuItems, categories, ingredients, movements, purchaseOrders, customers, riders] =
      await Promise.all([
        ctx.db
          .query("menuItems")
          .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
          .collect(),
        ctx.db
          .query("categories")
          .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
          .collect(),
        ctx.db
          .query("ingredients")
          .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
          .collect(),
        ctx.db
          .query("stockMovements")
          .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
          .collect(),
        ctx.db
          .query("purchaseOrders")
          .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
          .collect(),
        ctx.db
          .query("customers")
          .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
          .collect(),
        ctx.db
          .query("riders")
          .withIndex("by_restaurant", (q) => q.eq("restaurantId", args.restaurantId))
          .collect(),
      ]);

    const fromDate = dayKey(args.from);
    const toDate = dayKey(args.to);
    const reservations = (
      await ctx.db.query("reservations").withIndex("by_restaurant").collect()
    ).filter(
      (row) =>
        row.restaurantId === args.restaurantId && row.date >= fromDate && row.date <= toDate,
    );
    const waitlist = (
      await ctx.db.query("waitlistEntries").withIndex("by_restaurant").collect()
    ).filter(
      (row) =>
        row.restaurantId === args.restaurantId &&
        dayKey(row.joinedAt) >= fromDate &&
        dayKey(row.joinedAt) <= toDate,
    );

    const ingredientById = new Map(ingredients.map((item) => [item._id, item]));
    const menuById = new Map(menuItems.map((item) => [item._id, item]));
    const categoryById = new Map(categories.map((item) => [item._id, item]));
    const grossSales = round2(orders.reduce((sum, order) => sum + order.totalAmount, 0));
    const base: Omit<ReportResult, "columns" | "rows" | "summary"> = {
      key: meta.key,
      title: meta.title,
      description: meta.description,
    };

    switch (meta.key) {
      case "sales_daily": {
        const byDay = new Map<string, Doc<"orders">[]>();
        for (const order of orders) {
          const key = dayKey(order.createdAt);
          byDay.set(key, [...(byDay.get(key) ?? []), order]);
        }
        const rows = [...byDay.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, dayOrders]) => {
            const total = round2(dayOrders.reduce((s, o) => s + o.totalAmount, 0));
            const subtotal = round2(dayOrders.reduce((s, o) => s + (o.subtotal ?? o.totalAmount), 0));
            const discount = round2(dayOrders.reduce((s, o) => s + (o.discountAmount ?? 0), 0));
            const tax = round2(dayOrders.reduce((s, o) => s + (o.taxAmount ?? 0), 0));
            return [
              day,
              dayOrders.length,
              money(subtotal),
              money(discount),
              money(tax),
              money(total),
              money(total / dayOrders.length),
            ];
          });
        return {
          ...base,
          columns: ["Date", "Orders", "Subtotal", "Discounts", "Tax", "Net sales", "Avg order"],
          rows,
          summary: [
            { label: "Net sales", value: money(grossSales) },
            { label: "Orders", value: String(orders.length) },
            {
              label: "Average order",
              value: money(orders.length ? grossSales / orders.length : 0),
            },
          ],
        };
      }

      case "channel_mix": {
        const channels: { key: string; label: string }[] = [
          { key: "dine_in", label: "Dine-in" },
          { key: "delivery", label: "Delivery" },
          { key: "takeaway", label: "Takeaway" },
        ];
        const rows = channels.map((channel) => {
          const subset = orders.filter((order) => (order.channel ?? "dine_in") === channel.key);
          const total = round2(subset.reduce((s, o) => s + o.totalAmount, 0));
          return [
            channel.label,
            subset.length,
            money(total),
            money(subset.length ? total / subset.length : 0),
            money(grossSales ? (total / grossSales) * 100 : 0),
          ];
        });
        return {
          ...base,
          columns: ["Order type", "Orders", "Revenue", "Avg order", "Share %"],
          rows,
          summary: [{ label: "Total revenue", value: money(grossSales) }],
        };
      }

      case "payment_methods": {
        const methods: { key: string; label: string }[] = [
          { key: "cash", label: "Cash" },
          { key: "upi", label: "UPI" },
          { key: "card", label: "Card" },
          { key: "online", label: "Online / prepaid" },
          { key: "unpaid", label: "Unpaid" },
        ];
        const rows = methods.map((method) => {
          const subset = orders.filter((order) =>
            method.key === "unpaid"
              ? order.paymentStatus !== "paid"
              : order.paymentMethod === method.key && order.paymentStatus === "paid",
          );
          return [
            method.label,
            subset.length,
            money(subset.reduce((s, o) => s + o.totalAmount, 0)),
            money(
              grossSales
                ? (subset.reduce((s, o) => s + o.totalAmount, 0) / grossSales) * 100
                : 0,
            ),
          ];
        });
        const unpaid = orders.filter((order) => order.paymentStatus !== "paid");
        return {
          ...base,
          columns: ["Payment method", "Orders", "Amount", "Share %"],
          rows,
          summary: [
            { label: "Collected", value: money(round2(orders.filter((o) => o.paymentStatus === "paid").reduce((s, o) => s + o.totalAmount, 0))) },
            { label: "Outstanding", value: money(round2(unpaid.reduce((s, o) => s + o.totalAmount, 0))) },
          ],
        };
      }

      case "discounts_tax": {
        const byDay = new Map<string, Doc<"orders">[]>();
        for (const order of orders) {
          const key = dayKey(order.createdAt);
          byDay.set(key, [...(byDay.get(key) ?? []), order]);
        }
        const rows = [...byDay.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, dayOrders]) => [
            day,
            dayOrders.filter((order) => order.discountAmount).length,
            money(round2(dayOrders.reduce((s, o) => s + (o.discountAmount ?? 0), 0))),
            money(round2(dayOrders.reduce((s, o) => s + (o.taxAmount ?? 0), 0))),
            money(round2(dayOrders.reduce((s, o) => s + o.totalAmount, 0))),
          ]);
        return {
          ...base,
          columns: ["Date", "Coupon orders", "Discount value", "Tax collected", "Net sales"],
          rows,
          summary: [
            {
              label: "Total discounts",
              value: money(round2(orders.reduce((s, o) => s + (o.discountAmount ?? 0), 0))),
            },
            {
              label: "Coupon orders",
              value: String(orders.filter((order) => order.discountAmount).length),
            },
          ],
        };
      }

      case "peak_hours": {
        const hours = Array.from(new Set(orders.map((order) => hourKey(order.createdAt)))).sort();
        const rows = hours.map((hour) => {
          const subset = orders.filter((order) => hourKey(order.createdAt) === hour);
          return [
            hour,
            subset.length,
            money(round2(subset.reduce((s, o) => s + o.totalAmount, 0))),
            money(round2(subset.reduce((s, o) => s + o.totalAmount, 0) / subset.length)),
          ];
        });
        const best = [...rows].sort((a, b) => Number(b[1]) - Number(a[1]))[0];
        return {
          ...base,
          columns: ["Hour", "Orders", "Revenue", "Avg order"],
          rows,
          summary: [
            { label: "Busiest hour", value: best ? String(best[0]) : "—" },
            { label: "Orders in range", value: String(orders.length) },
          ],
        };
      }

      case "weekday_sales": {
        const rows = WEEKDAYS.map((label, index) => {
          const subset = orders.filter((order) => new Date(order.createdAt).getDay() === index);
          const total = round2(subset.reduce((s, o) => s + o.totalAmount, 0));
          return [label, subset.length, money(total), money(subset.length ? total / subset.length : 0)];
        });
        return {
          ...base,
          columns: ["Weekday", "Orders", "Revenue", "Avg order"],
          rows,
          summary: [{ label: "Total revenue", value: money(grossSales) }],
        };
      }

      case "popular_items": {
        const stats = new Map<string, { qty: number; revenue: number; orders: Set<string> }>();
        for (const order of orders) {
          for (const line of order.items) {
            const entry = stats.get(line.name) ?? { qty: 0, revenue: 0, orders: new Set<string>() };
            entry.qty += line.quantity;
            entry.revenue += line.price * line.quantity;
            entry.orders.add(order._id);
            stats.set(line.name, entry);
          }
        }
        const rows = [...stats.entries()]
          .sort((a, b) => b[1].qty - a[1].qty)
          .slice(0, 50)
          .map(([name, entry], index) => [
            index + 1,
            name,
            entry.qty,
            money(round2(entry.revenue)),
            entry.orders.size,
            money(round2(entry.revenue / entry.qty)),
          ]);
        return {
          ...base,
          columns: ["#", "Item", "Qty sold", "Revenue", "Orders", "Avg price"],
          rows,
          summary: [
            { label: "Distinct items sold", value: String(stats.size) },
            { label: "Units sold", value: String([...stats.values()].reduce((s, e) => s + e.qty, 0)) },
          ],
        };
      }

      case "category_performance": {
        const rows = categories
          .map((category) => {
            const items = menuItems.filter((item) => item.categoryId === category._id);
            const names = new Set(items.map((item) => item.name));
            const lines = orders.flatMap((order) =>
              order.items.filter((line) => names.has(line.name)),
            );
            const revenue = round2(lines.reduce((s, l) => s + l.price * l.quantity, 0));
            return {
              label: category.name,
              values: [
                category.name,
                items.length,
                lines.reduce((s, l) => s + l.quantity, 0),
                money(revenue),
                money(grossSales ? (revenue / grossSales) * 100 : 0),
              ] as Cell[],
              revenue,
            };
          })
          .sort((a, b) => b.revenue - a.revenue);
        return {
          ...base,
          columns: ["Category", "Items", "Qty sold", "Revenue", "Share %"],
          rows: rows.map((row) => row.values),
          summary: [{ label: "Categories", value: String(categories.length) }],
        };
      }

      case "food_cost_margin": {
        const rows = menuItems
          .map((item) => {
            const cost = round2(
              (item.recipe ?? []).reduce(
                (sum, line) => sum + (ingredientById.get(line.ingredientId)?.costPerUnit ?? 0) * line.quantity,
                0,
              ),
            );
            const margin = round2(item.price - cost);
            const marginPct = item.price > 0 ? round2((margin / item.price) * 100) : 0;
            return {
              hasRecipe: (item.recipe ?? []).length > 0,
              values: [
                item.name,
                (item.recipe ?? []).length > 0 ? money(cost) : "No recipe",
                money(item.price),
                money(margin),
                `${marginPct}%`,
              ] as Cell[],
              marginPct,
            };
          })
          .sort((a, b) => a.marginPct - b.marginPct);
        const withRecipe = rows.filter((row) => row.hasRecipe);
        const average =
          withRecipe.length > 0
            ? round2(withRecipe.reduce((s, r) => s + r.marginPct, 0) / withRecipe.length)
            : 0;
        return {
          ...base,
          columns: ["Item", "Recipe cost", "Price", "Gross margin", "Margin %"],
          rows: rows.map((row) => row.values),
          summary: [
            { label: "Average margin", value: `${average}%` },
            { label: "Items without recipe", value: String(rows.length - withRecipe.length) },
          ],
        };
      }

      case "inventory_valuation": {
        const rows = [...ingredients]
          .sort((a, b) => a.currentStock * a.costPerUnit - b.currentStock * b.costPerUnit || a.name.localeCompare(b.name))
          .reverse()
          .map((item) => [
            item.name,
            item.unit,
            item.currentStock,
            money(item.costPerUnit),
            money(round2(item.currentStock * item.costPerUnit)),
            item.parLevel,
            item.currentStock <= 0 ? "Out of stock" : item.currentStock <= item.parLevel ? "Low" : "OK",
          ]);
        return {
          ...base,
          columns: ["Ingredient", "Unit", "On hand", "Unit cost", "Stock value", "Par level", "Status"],
          rows,
          summary: [
            {
              label: "Total stock value",
              value: money(round2(ingredients.reduce((s, i) => s + i.currentStock * i.costPerUnit, 0))),
            },
            {
              label: "Below par",
              value: String(ingredients.filter((i) => i.currentStock <= i.parLevel).length),
            },
          ],
        };
      }

      case "stock_ledger": {
        const rows = movements
          .filter((movement) => movement.createdAt >= args.from && movement.createdAt <= args.to)
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 1000)
          .map((movement) => {
            const ingredient = ingredientById.get(movement.ingredientId);
            return [
              dayKey(movement.createdAt),
              ingredient?.name ?? "Deleted ingredient",
              movement.type,
              movement.quantity,
              ingredient?.unit ?? "",
              money(round2(Math.abs(movement.quantity) * (movement.unitCost ?? 0))),
              movement.reason ?? "",
            ];
          });
        return {
          ...base,
          columns: ["Date", "Ingredient", "Type", "Qty", "Unit", "Value", "Reason"],
          rows,
          summary: [{ label: "Movements", value: String(rows.length) }],
        };
      }

      case "waste": {
        const waste = movements.filter(
          (movement) =>
            movement.type === "waste" &&
            movement.createdAt >= args.from &&
            movement.createdAt <= args.to,
        );
        const rows = waste
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((movement) => {
            const ingredient = ingredientById.get(movement.ingredientId);
            return [
              dayKey(movement.createdAt),
              ingredient?.name ?? "Deleted ingredient",
              Math.abs(movement.quantity),
              ingredient?.unit ?? "",
              money(round2(Math.abs(movement.quantity) * (movement.unitCost ?? 0))),
              movement.reason ?? "",
              movement.batchCode ?? "—",
            ];
          });
        const totalValue = round2(
          waste.reduce((s, m) => s + Math.abs(m.quantity) * (m.unitCost ?? 0), 0),
        );
        return {
          ...base,
          columns: ["Date", "Ingredient", "Qty", "Unit", "Value", "Reason", "Batch"],
          rows,
          summary: [
            { label: "Waste value", value: money(totalValue) },
            {
              label: "Waste as % of sales",
              value: grossSales ? `${round2((totalValue / grossSales) * 100)}%` : "—",
            },
          ],
        };
      }

      case "purchase_spend": {
        const received = purchaseOrders.filter(
          (po) => po.status === "received" && (po.receivedAt ?? po.createdAt) >= args.from && (po.receivedAt ?? po.createdAt) <= args.to,
        );
        const grouped = new Map<string, { count: number; spend: number }>();
        for (const po of received) {
          const entry = grouped.get(po.supplierName) ?? { count: 0, spend: 0 };
          const spend = po.items.reduce(
            (sum, line) => sum + (line.receivedQuantity ?? line.quantity) * line.unitCost,
            0,
          );
          grouped.set(po.supplierName, { count: entry.count + 1, spend: entry.spend + spend });
        }
        const rows = [...grouped.entries()]
          .sort((a, b) => b[1].spend - a[1].spend)
          .map(([supplier, entry]) => [
            supplier,
            entry.count,
            money(round2(entry.spend)),
            money(round2(entry.count ? entry.spend / entry.count : 0)),
          ]);
        return {
          ...base,
          columns: ["Supplier", "Receipts", "Spend", "Avg receipt"],
          rows,
          summary: [
            { label: "Total spend", value: money(round2([...grouped.values()].reduce((s, e) => s + e.spend, 0))) },
            { label: "Open purchase orders", value: String(purchaseOrders.filter((po) => po.status !== "received" && po.status !== "cancelled").length) },
          ],
        };
      }

      case "customer_retention": {
        const active = customers.filter((customer) => customer.lastOrderAt >= args.from);
        const segments = [
          { label: "First-time (1 order)", test: (c: Doc<"customers">) => c.totalOrders <= 1 },
          { label: "Returning (2-4 orders)", test: (c: Doc<"customers">) => c.totalOrders >= 2 && c.totalOrders <= 4 },
          { label: "Loyal (5+ orders)", test: (c: Doc<"customers">) => c.totalOrders >= 5 },
        ];
        const rows = segments.map((segment) => {
          const subset = active.filter(segment.test);
          const spend = round2(subset.reduce((s, c) => s + c.totalSpent, 0));
          return [
            segment.label,
            subset.length,
            money(spend),
            money(subset.length ? spend / subset.length : 0),
            money(round2(
              active.reduce((s, c) => s + c.totalSpent, 0)
                ? (spend / active.reduce((s, c) => s + c.totalSpent, 0)) * 100
                : 0,
            )),
          ];
        });
        const repeat = active.filter((customer) => customer.totalOrders > 1).length;
        return {
          ...base,
          columns: ["Segment", "Guests", "Lifetime spend", "Avg spend", "Revenue share %"],
          rows,
          summary: [
            {
              label: "Repeat rate",
              value: active.length ? `${round2((repeat / active.length) * 100)}%` : "—",
            },
            { label: "Active guests", value: String(active.length) },
          ],
          note: "Guest counts use lifetime totals; the date range filters who was active in the period.",
        };
      }

      case "customer_leaderboard": {
        const rows = [...customers]
          .sort((a, b) => b.totalSpent - a.totalSpent)
          .slice(0, 50)
          .map((customer, index) => [
            index + 1,
            customer.name ?? "Guest",
            customer.phone,
            customer.totalOrders,
            money(customer.totalSpent),
            money(round2(customer.totalOrders ? customer.totalSpent / customer.totalOrders : 0)),
            dayKey(customer.lastOrderAt),
          ]);
        return {
          ...base,
          columns: ["#", "Guest", "Phone", "Orders", "Spend", "Avg order", "Last visit"],
          rows,
          summary: [{ label: "Tracked guests", value: String(customers.length) }],
        };
      }

      case "reservations_waitlist": {
        const dates = [...new Set([...reservations.map((r) => r.date), ...waitlist.map((w) => dayKey(w.joinedAt))])].sort();
        const rows = dates.map((date) => {
          const dayReservations = reservations.filter((r) => r.date === date);
          const dayWaitlist = waitlist.filter((w) => dayKey(w.joinedAt) === date);
          return [
            date,
            dayReservations.length,
            dayReservations
              .filter((r) => r.status !== "cancelled" && r.status !== "no_show")
              .reduce((s, r) => s + r.partySize, 0),
            dayReservations.filter((r) => r.status === "seated" || r.status === "completed").length,
            dayReservations.filter((r) => r.status === "no_show").length,
            dayReservations.filter((r) => r.status === "cancelled").length,
            dayWaitlist.length,
            dayWaitlist.reduce((s, w) => s + w.partySize, 0),
          ];
        });
        return {
          ...base,
          columns: ["Date", "Bookings", "Covers", "Seated", "No-shows", "Cancelled", "Waitlist parties", "Waitlist guests"],
          rows,
          summary: [
            { label: "Bookings", value: String(reservations.length) },
            { label: "No-show rate", value: reservations.length ? `${round2((reservations.filter((r) => r.status === "no_show").length / reservations.length) * 100)}%` : "—" },
            { label: "Waitlist parties", value: String(waitlist.length) },
          ],
        };
      }

      case "rider_performance": {
        const delivered = allOrders.filter(
          (order) =>
            order.riderId &&
            order.deliveryStatus === "delivered" &&
            (order.deliveredAt ?? 0) >= args.from &&
            (order.deliveredAt ?? 0) <= args.to,
        );
        const rows = riders
          .map((rider) => {
            const mine = delivered.filter((order) => order.riderId === rider._id);
            const minutes = mine
              .filter((order) => order.assignedAt && order.deliveredAt)
              .map((order) => (order.deliveredAt! - order.assignedAt!) / 60000);
            return [
              rider.name,
              rider.isOnline ? "Online" : "Offline",
              mine.length,
              minutes.length ? round2(minutes.reduce((s, m) => s + m, 0) / minutes.length) : 0,
              money(round2(
                mine.filter((order) => order.paymentMethod === "cash").reduce((s, o) => s + o.totalAmount, 0),
              )),
              money(round2(mine.reduce((s, o) => s + o.totalAmount, 0))),
            ] as Cell[];
          })
          .sort((a, b) => Number(b[2]) - Number(a[2]));
        return {
          ...base,
          columns: ["Rider", "Status", "Deliveries", "Avg minutes", "Cash collected", "Order value"],
          rows,
          summary: [
            { label: "Deliveries", value: String(delivered.length) },
            { label: "Online now", value: String(riders.filter((r) => r.isOnline).length) },
          ],
        };
      }

      case "aggregator_settlements": {
        const platformOrders = orders.filter((order) => order.source === "aggregator");
        const grouped = new Map<string, Doc<"orders">[]>();
        for (const order of platformOrders) {
          const key = order.externalPlatform ?? "unknown";
          grouped.set(key, [...(grouped.get(key) ?? []), order]);
        }
        const rows = [...grouped.entries()]
          .sort((a, b) => b[1].length - a[1].length)
          .map(([platform, subset]) => {
            const gross = round2(subset.reduce((s, o) => s + o.totalAmount, 0));
            const commission = round2(subset.reduce((s, o) => s + (o.commission ?? 0), 0));
            const net = round2(subset.reduce((s, o) => s + (o.netSettlement ?? o.totalAmount), 0));
            return [
              platform,
              subset.length,
              money(gross),
              money(commission),
              money(net),
              money(round2(gross ? (commission / gross) * 100 : 0)),
              String(subset.filter((o) => o.isPlatformPaid).length),
            ];
          });
        return {
          ...base,
          columns: ["Platform", "Orders", "Gross", "Commission", "Net settlement", "Commission %", "Prepaid"],
          rows,
          summary: [
            { label: "Aggregator orders", value: String(platformOrders.length) },
            { label: "Net settlement", value: money(round2(platformOrders.reduce((s, o) => s + (o.netSettlement ?? o.totalAmount), 0))) },
          ],
          note: "Commission and settlement figures come from the platform payloads; direct orders are excluded.",
        };
      }

      default: {
        return {
          ...base,
          columns: [],
          rows: [],
          summary: [],
          note: "Report not implemented yet.",
        };
      }
    }
  },
});
