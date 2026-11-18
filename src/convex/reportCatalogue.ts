export type ReportGroup = "Sales" | "Menu" | "Stock" | "Customers" | "Floor" | "Delivery";

export const REPORT_CATALOGUE: {
  key: string;
  title: string;
  group: ReportGroup;
  description: string;
}[] = [
  { key: "sales_daily", title: "Sales by day", group: "Sales", description: "Orders, subtotal, discounts, tax and net sales for every day in the range." },
  { key: "channel_mix", title: "Order type mix", group: "Sales", description: "Dine-in, delivery and takeaway split with average order value." },
  { key: "payment_methods", title: "Payment methods", group: "Sales", description: "Cash, UPI, card and online collections, including what is still unpaid." },
  { key: "discounts_tax", title: "Discounts & tax", group: "Sales", description: "Coupon redemptions, discount value and tax collected per day." },
  { key: "peak_hours", title: "Peak hours", group: "Sales", description: "Order volume and revenue by hour of day to plan staffing." },
  { key: "weekday_sales", title: "Day of week", group: "Sales", description: "Which weekdays carry the week, with average ticket size." },
  { key: "popular_items", title: "Popular items", group: "Menu", description: "Best sellers by quantity and revenue, with the number of orders they appeared in." },
  { key: "category_performance", title: "Category performance", group: "Menu", description: "Revenue share and units sold per menu category." },
  { key: "food_cost_margin", title: "Food cost & margins", group: "Menu", description: "Recipe cost vs selling price for every dish, with gross margin percentage." },
  { key: "inventory_valuation", title: "Stock valuation", group: "Stock", description: "Current stock on hand, unit cost, stock value and par-level status." },
  { key: "stock_ledger", title: "Stock movements", group: "Stock", description: "Every purchase, deduction, waste entry and adjustment in the range." },
  { key: "waste", title: "Waste log", group: "Stock", description: "Wasted quantity and value by ingredient with reasons." },
  { key: "purchase_spend", title: "Supplier spend", group: "Stock", description: "Received purchase orders grouped by supplier." },
  { key: "customer_retention", title: "Customer retention", group: "Customers", description: "New vs returning vs loyal guests and the revenue each segment brings." },
  { key: "customer_leaderboard", title: "Top customers", group: "Customers", description: "Highest spending guests with order counts and last visit." },
  { key: "reservations_waitlist", title: "Reservations & covers", group: "Floor", description: "Bookings, covers, no-shows and waitlist volume per day." },
  { key: "rider_performance", title: "Rider performance", group: "Delivery", description: "Deliveries completed, average delivery time and cash handled per rider." },
  { key: "aggregator_settlements", title: "Aggregator settlements", group: "Delivery", description: "Gross value, commission and net payout per online ordering platform." },
];

export const REPORT_KEYS = REPORT_CATALOGUE.map((report) => report.key);
