import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Search,
  QrCode,
  ShoppingCart,
  Minus,
  Plus,
  Leaf,
  X,
  Send,
  CheckCircle2,
  Clock,
  ChefHat,
  Utensils,
  History,
  ChevronLeft,
  Hash,
  CreditCard,
  ChevronRight,
  User,
  Flame,
  Coffee,
  Cookie,
  IceCreamCone,
  Package,
  Sandwich,
  Salad,
  Beef,
  Fish,
  Soup,
  Wine,
  CupSoda,
  Cake,
} from "lucide-react";

interface CartItem {
  menuItemId: Id<"menuItems">;
  name: string;
  price: number;
  quantity: number;
  note: string;
}

type MenuItem = {
  _id: Id<"menuItems">;
  _creationTime: number;
  restaurantId: Id<"restaurants">;
  categoryId: Id<"categories">;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  isVeg: boolean;
  sortOrder: number;
};

function getStoredOrderIds(restaurantId: Id<"restaurants">): string[] {
  try {
    const raw = localStorage.getItem(`qr-orders-${restaurantId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addStoredOrderId(restaurantId: Id<"restaurants">, orderId: string) {
  try {
    const existing = getStoredOrderIds(restaurantId);
    if (!existing.includes(orderId)) {
      localStorage.setItem(
        `qr-orders-${restaurantId}`,
        JSON.stringify([orderId, ...existing].slice(0, 50)),
      );
    }
  } catch {
    // ignore
  }
}

const STATUS_STEPS = [
  { key: "received", label: "Received", icon: Clock },
  { key: "accepted", label: "Accepted", icon: CheckCircle2 },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "ready", label: "Ready", icon: Utensils },
  { key: "served", label: "Served", icon: CheckCircle2 },
] as const;

const STATUS_ORDER = [
  "received",
  "accepted",
  "preparing",
  "ready",
  "served",
  "cancelled",
];

type ViewMode = "menu" | "orders" | "orderDetail";

const CATEGORY_ICONS: Record<string, typeof Utensils> = {
  foods: Utensils,
  food: Utensils,
  drinks: Coffee,
  drink: Coffee,
  snack: Cookie,
  snacks: Cookie,
  dessert: Cake,
  desserts: Cake,
  package: Package,
  packages: Package,
  chicken: Beef,
  seafood: Fish,
  fish: Fish,
  pizza: Utensils,
  pasta: Utensils,
  salad: Salad,
  soup: Soup,
  juice: CupSoda,
  tea: Coffee,
  wine: Wine,
  beer: Wine,
  default: Utensils,
};

function getCategoryIcon(name: string): typeof Utensils {
  const lower = name.toLowerCase();
  for (const [key, Icon] of Object.entries(CATEGORY_ICONS)) {
    if (lower.includes(key)) return Icon;
  }
  return CATEGORY_ICONS.default;
}

export default function CustomerMenu() {
  const { token } = useParams<{ token: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemNote, setItemNote] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("menu");
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null);

  const tableData = useQuery(
    api.tables.getByQrToken,
    token ? { qrToken: token } : "skip",
  );

  const restaurant = useQuery(
    api.restaurants.getById,
    tableData?.restaurantId ? { id: tableData.restaurantId } : "skip",
  );
  const categories = useQuery(
    api.categories.getByRestaurant,
    tableData?.restaurantId
      ? { restaurantId: tableData.restaurantId }
      : "skip",
  );
  const menuItems = useQuery(
    api.menuItems.getByRestaurant,
    tableData?.restaurantId
      ? { restaurantId: tableData.restaurantId }
      : "skip",
  );
  const searchResults = useQuery(
    api.menuItems.search,
    tableData?.restaurantId && searchQuery.trim()
      ? { restaurantId: tableData.restaurantId, query: searchQuery }
      : "skip",
  );
  const createOrder = useMutation(api.orders.create);

  const [storedOrderIds, setStoredOrderIds] = useState<string[]>([]);

  useEffect(() => {
    if (tableData?.restaurantId) {
      setStoredOrderIds(getStoredOrderIds(tableData.restaurantId));
    }
  }, [tableData?.restaurantId]);

  useEffect(() => {
    if (tableData?.restaurantId && orderSuccess) {
      setStoredOrderIds(getStoredOrderIds(tableData.restaurantId));
    }
  }, [tableData?.restaurantId, orderSuccess]);

  const previousOrders = useQuery(
    api.orders.getByIds,
    storedOrderIds.length > 0
      ? { ids: storedOrderIds as Id<"orders">[] }
      : "skip",
  );

  const viewingOrder = useQuery(
    api.orders.getById,
    viewingOrderId ? { id: viewingOrderId as Id<"orders"> } : "skip",
  );

  useEffect(() => {
    setSearchQuery("");
    setActiveCategory(null);
    setCart([]);
  }, [tableData?._id]);

  const visibleCategories = useMemo(() => {
    if (!categories) return [];
    return [...categories]
      .filter((c) => c.isVisible)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [categories]);

  const visibleItems = useMemo(() => {
    if (!menuItems) return [];
    return [...menuItems]
      .filter((item) => item.isAvailable)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [menuItems]);

  const displayedItems = useMemo(() => {
    if (searchQuery.trim() && searchResults) return searchResults;
    if (activeCategory)
      return visibleItems.filter((item) => item.categoryId === activeCategory);
    return visibleItems;
  }, [searchQuery, searchResults, activeCategory, visibleItems]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );
  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const addToCart = useCallback(
    (item: MenuItem, quantity: number, note: string) => {
      setCart((prev) => {
        const existing = prev.find(
          (c) => c.menuItemId === item._id && c.note === note,
        );
        if (existing) {
          return prev.map((c) =>
            c.menuItemId === item._id && c.note === note
              ? { ...c, quantity: c.quantity + quantity }
              : c,
          );
        }
        return [
          ...prev,
          {
            menuItemId: item._id,
            name: item.name,
            price: item.price,
            quantity,
            note,
          },
        ];
      });
    },
    [],
  );

  const updateCartQuantity = useCallback(
    (index: number, delta: number) => {
      setCart((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          quantity: updated[index].quantity + delta,
        };
        return updated.filter((item) => item.quantity > 0);
      });
    },
    [],
  );

  const removeCartItem = useCallback((index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleOrder = async () => {
    if (!tableData || !restaurant || cart.length === 0) return;
    const phone = customerPhone.replace(/\s/g, "");
    if (!phone || phone.length < 6) {
      setPhoneError("Please enter a valid mobile number.");
      return;
    }
    setPhoneError("");
    setIsOrdering(true);
    try {
      const orderId = await createOrder({
        restaurantId: tableData.restaurantId,
        tableId: tableData._id,
        tableLabel: tableData.label,
        customerName: customerName.trim() || undefined,
        customerPhone: phone,
        items: cart.map((c) => ({
          menuItemId: c.menuItemId,
          name: c.name,
          price: c.price,
          quantity: c.quantity,
          note: c.note || undefined,
        })),
        totalAmount: cartTotal,
      });
      addStoredOrderId(tableData.restaurantId, orderId);
      setStoredOrderIds(getStoredOrderIds(tableData.restaurantId));
      setOrderSuccess(orderId);
      setCart([]);
      setShowCart(false);
    } catch (err) {
      console.error("Failed to place order:", err);
    } finally {
      setIsOrdering(false);
    }
  };

  const openItemDetail = (item: MenuItem) => {
    setSelectedItem(item);
    setItemQuantity(1);
    setItemNote("");
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const statusColor = (status: string) => {
    switch (status) {
      case "received":
        return "bg-blue-100 text-blue-700";
      case "accepted":
        return "bg-indigo-100 text-indigo-700";
      case "preparing":
        return "bg-amber-100 text-amber-700";
      case "ready":
        return "bg-emerald-100 text-emerald-700";
      case "served":
        return "bg-gray-100 text-gray-600";
      case "cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  // Loading
  if (!token || tableData === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Invalid QR
  if (!tableData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-50">
            <QrCode className="h-8 w-8 text-orange-400" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Invalid QR Code</h1>
          <p className="text-sm text-muted-foreground">
            This QR code is not valid or has been deactivated. Please ask the
            staff for assistance.
          </p>
        </div>
      </div>
    );
  }

  // Table disabled
  if (!tableData.isActive) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-50">
            <CheckCircle2 className="h-8 w-8 text-orange-400" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Table Unavailable</h1>
          <p className="text-sm text-muted-foreground">
            This table is currently unavailable. Please ask the staff for
            assistance.
          </p>
        </div>
      </div>
    );
  }

  // Order success
  if (orderSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-200">
            <CheckCircle2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Order Placed!</h1>
          <p className="text-sm text-muted-foreground mb-1">
            Your order has been sent to the kitchen.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            {tableData.label}
          </p>
          <div className="flex flex-col gap-2">
            <Button
              className="cursor-pointer bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0"
              onClick={() => {
                setOrderSuccess(null);
                setViewMode("orders");
              }}
            >
              <History className="mr-2 h-4 w-4" />
              View My Orders
            </Button>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setOrderSuccess(null)}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Menu
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Order Detail View
  if (viewMode === "orderDetail" && viewingOrder) {
    const currentStepIndex = STATUS_ORDER.indexOf(viewingOrder.status);
    const isCancelled = viewingOrder.status === "cancelled";

    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50/50 to-amber-50/30">
        <header className="sticky top-0 z-40 border-b border-orange-100 bg-white/90 backdrop-blur-lg">
          <div className="mx-auto flex h-14 max-w-2xl items-center px-4 gap-3">
            <button
              className="cursor-pointer"
              onClick={() => {
                setViewingOrderId(null);
                setViewMode("orders");
              }}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h1 className="text-sm font-semibold">Order Details</h1>
          </div>
        </header>

        <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
          <Card className="border-orange-100 bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Hash className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-sm font-semibold">
                    {viewingOrder.tableLabel ?? `Table`}
                  </span>
                </div>
                <span className="text-sm font-bold tabular-nums text-orange-600">
                  ${viewingOrder.totalAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColor(viewingOrder.status)}`}
                >
                  {viewingOrder.status.charAt(0).toUpperCase() +
                    viewingOrder.status.slice(1)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatTime(viewingOrder.createdAt)}
                </span>
              </div>
              {viewingOrder.paymentStatus && (
                <div className="flex items-center gap-1.5 mt-2">
                  <CreditCard className="h-3 w-3 text-muted-foreground" />
                  <span
                    className={`text-[11px] font-medium ${viewingOrder.paymentStatus === "paid" ? "text-emerald-600" : viewingOrder.paymentStatus === "refunded" ? "text-amber-600" : "text-muted-foreground"}`}
                  >
                    {viewingOrder.paymentStatus === "paid"
                      ? `Paid (${viewingOrder.paymentMethod ?? ""})`
                      : viewingOrder.paymentStatus === "refunded"
                        ? "Refunded"
                        : "Unpaid"}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {isCancelled ? (
            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="p-4 flex items-center gap-3">
                <X className="h-5 w-5 text-red-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-700">
                    Order Cancelled
                  </p>
                  <p className="text-xs text-red-600/70">
                    This order has been cancelled.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {STATUS_STEPS.map((step) => {
                const stepIndex = STATUS_ORDER.indexOf(step.key);
                const isCompleted = stepIndex <= currentStepIndex;
                const isCurrent = step.key === viewingOrder.status;
                const StepIcon = step.icon;

                return (
                  <div
                    key={step.key}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                      isCurrent
                        ? "border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 shadow-sm"
                        : isCompleted
                          ? "border-orange-100 bg-orange-50/30"
                          : "border-border/30 bg-transparent opacity-50"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        isCurrent
                          ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white"
                          : isCompleted
                            ? "bg-orange-100 text-orange-600"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <StepIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${
                          isCurrent || isCompleted
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </p>
                    </div>
                    {isCurrent && (
                      <span className="text-[10px] font-medium text-orange-600 bg-orange-100 rounded-full px-2 py-0.5">
                        Current
                      </span>
                    )}
                    {isCompleted && !isCurrent && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <Card className="border-orange-100 bg-white shadow-sm">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Items Ordered</h3>
              <div className="space-y-2">
                {viewingOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.quantity}× {item.name}
                      {item.note && (
                        <span className="italic text-muted-foreground/70 ml-1">
                          — {item.note}
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums font-medium">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-orange-100 flex justify-between text-sm font-semibold">
                <span>Total</span>
                <span className="tabular-nums text-orange-600">
                  ${viewingOrder.totalAmount.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── MAIN MENU VIEW ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/40 via-white to-amber-50/20">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-orange-100 bg-white/95 backdrop-blur-lg shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-md shadow-orange-200">
              <Flame className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-none text-gray-900">
                {restaurant?.name ?? "Restaurant"}
              </h1>
              <p className="text-[11px] text-orange-500 font-medium mt-0.5">
                {tableData.label}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {viewMode === "menu" && cartCount > 0 && (
              <Button
                className="cursor-pointer bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0 shadow-md shadow-orange-200 relative rounded-full h-10 px-4"
                onClick={() => setShowCart(true)}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Cart
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-orange-600 text-[10px] font-bold">
                  {cartCount}
                </span>
              </Button>
            )}
            {viewMode === "menu" && cartCount === 0 && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 text-orange-500"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Cart Empty</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* ── LEFT: Category Sidebar (desktop) ── */}
          {viewMode === "menu" && !searchQuery.trim() && visibleCategories.length > 0 && (
            <aside className="hidden lg:flex flex-col w-20 shrink-0 gap-2 sticky top-24 self-start">
              <button
                className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all cursor-pointer ${
                  activeCategory === null
                    ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-200"
                    : "bg-white text-gray-500 hover:bg-orange-50 hover:text-orange-500 border border-orange-100"
                }`}
                onClick={() => setActiveCategory(null)}
              >
                <Utensils className="h-5 w-5" />
                <span className="text-[10px] font-semibold leading-tight text-center">All</span>
              </button>
              {visibleCategories.map((cat) => {
                const Icon = getCategoryIcon(cat.name);
                return (
                  <button
                    key={cat._id}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all cursor-pointer ${
                      activeCategory === cat._id
                        ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-200"
                        : "bg-white text-gray-500 hover:bg-orange-50 hover:text-orange-500 border border-orange-100"
                    }`}
                    onClick={() => setActiveCategory(cat._id)}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px] font-semibold leading-tight text-center line-clamp-2">{cat.name}</span>
                  </button>
                );
              })}
            </aside>
          )}

          {/* ── CENTER: Menu / Orders ── */}
          <main className="flex-1 min-w-0">
            {viewMode === "menu" && (
              <>
                {/* Search Bar */}
                <div className="relative mb-5">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-400" />
                  <Input
                    placeholder="Search or scan for items"
                    className="pl-11 h-12 rounded-xl bg-white border-orange-100 focus:border-orange-300 focus:ring-orange-200 text-sm shadow-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-orange-500 cursor-pointer"
                      onClick={() => setSearchQuery("")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Mobile Category Scroll */}
                {!searchQuery.trim() && visibleCategories.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none mb-2 lg:hidden">
                    <button
                      className={`flex-shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeCategory === null
                          ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white border-transparent shadow-md shadow-orange-200"
                          : "bg-white text-gray-500 border-orange-100 hover:border-orange-300"
                      }`}
                      onClick={() => setActiveCategory(null)}
                    >
                      <Utensils className="h-3.5 w-3.5" />
                      All
                    </button>
                    {visibleCategories.map((cat) => {
                      const Icon = getCategoryIcon(cat.name);
                      return (
                        <button
                          key={cat._id}
                          className={`flex-shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                            activeCategory === cat._id
                              ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white border-transparent shadow-md shadow-orange-200"
                              : "bg-white text-gray-500 border-orange-100 hover:border-orange-300"
                          }`}
                          onClick={() => setActiveCategory(cat._id)}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                  <span className="font-medium text-orange-500">
                    {activeCategory
                      ? visibleCategories.find((c) => c._id === activeCategory)?.name
                      : "All Items"}
                  </span>
                  <span>·</span>
                  <span>{displayedItems.length} items</span>
                </div>

                {/* Food Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {displayedItems.length === 0 ? (
                    <div className="col-span-full py-16 text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50">
                        <Search className="h-8 w-8 text-orange-300" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {searchQuery
                          ? "No items match your search."
                          : "No items available right now."}
                      </p>
                    </div>
                  ) : (
                    displayedItems.map((item) => {
                      const inCart = cart.find((c) => c.menuItemId === item._id);
                      return (
                        <button
                          key={item._id}
                          className="group text-left rounded-2xl bg-white border border-orange-100 overflow-hidden hover:border-orange-300 food-card-shadow transition-all duration-200 cursor-pointer"
                          onClick={() => openItemDetail(item)}
                        >
                          {/* Image */}
                          {item.imageUrl ? (
                            <div className="relative h-32 sm:h-36 overflow-hidden">
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                              <span className="absolute top-2 left-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-md">
                                ${item.price.toFixed(2)}
                              </span>
                              {item.isVeg && (
                                <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
                                  <Leaf className="h-3 w-3" />
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="relative h-32 sm:h-36 bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
                              <span className="text-4xl">🍽️</span>
                              <span className="absolute top-2 left-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-md">
                                ${item.price.toFixed(2)}
                              </span>
                              {item.isVeg && (
                                <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
                                  <Leaf className="h-3 w-3" />
                                </span>
                              )}
                            </div>
                          )}

                          {/* Info */}
                          <div className="p-3">
                            <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 mb-0.5">
                              {item.name}
                            </h3>
                            {item.description && (
                              <p className="text-[11px] text-gray-400 line-clamp-2 mb-2">
                                {item.description}
                              </p>
                            )}
                            {!item.description && <div className="mb-2" />}

                            {inCart ? (
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-medium text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                                  {inCart.quantity} in cart
                                </span>
                                <span className="flex items-center gap-1">
                                  <span
                                    className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-600 hover:bg-orange-200 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const idx = cart.findIndex(
                                        (c) =>
                                          c.menuItemId === item._id &&
                                          c.note === "",
                                      );
                                      if (idx !== -1) updateCartQuantity(idx, 1);
                                    }}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </span>
                                </span>
                              </div>
                            ) : (
                              <div className="flex justify-end">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-200 group-hover:shadow-md group-hover:shadow-orange-300 transition-all">
                                  <Plus className="h-3.5 w-3.5" />
                                </span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {/* Previous Orders View */}
            {viewMode === "orders" && (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <h2 className="text-lg font-bold">My Orders</h2>
                </div>
                {!previousOrders || previousOrders.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50">
                      <History className="h-8 w-8 text-orange-300" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      No orders yet. Place an order and it will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {previousOrders.map((order) => (
                      <button
                        key={order._id}
                        className="w-full text-left rounded-2xl border border-orange-100 bg-white p-4 hover:border-orange-300 food-card-shadow transition-all cursor-pointer"
                        onClick={() => {
                          setViewingOrderId(order._id);
                          setViewMode("orderDetail");
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {order.tableLabel ?? `Table`}
                            </span>
                            <span
                              className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColor(order.status)}`}
                            >
                              {order.status.charAt(0).toUpperCase() +
                                order.status.slice(1)}
                            </span>
                          </div>
                          <span className="text-sm font-bold tabular-nums text-orange-600">
                            ${order.totalAmount.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {order.items
                              .map((it) => `${it.quantity}× ${it.name}`)
                              .join(", ")}
                          </p>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">
                            {formatTime(order.createdAt)}
                          </span>
                        </div>
                        {order.paymentStatus && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <CreditCard className="h-3 w-3 text-muted-foreground" />
                            <span
                              className={`text-[11px] ${order.paymentStatus === "paid" ? "text-emerald-600" : "text-muted-foreground"}`}
                            >
                              {order.paymentStatus === "paid"
                                ? `Paid (${order.paymentMethod ?? ""})`
                                : order.paymentStatus === "refunded"
                                  ? "Refunded"
                                  : "Unpaid"}
                            </span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </main>

          {/* ── RIGHT: Cart Panel (desktop only) ── */}
          {viewMode === "menu" && (
            <aside className="hidden lg:block w-80 shrink-0 sticky top-24 self-start">
              <Card className="border-orange-100 bg-white shadow-sm overflow-hidden">
                <div className="p-4 border-b border-orange-50 bg-gradient-to-r from-orange-500 to-amber-500">
                  <div className="flex items-center gap-2 text-white">
                    <ShoppingCart className="h-4 w-4" />
                    <span className="text-sm font-bold">Your Order</span>
                    <span className="ml-auto text-[11px] font-medium bg-white/20 px-2 py-0.5 rounded-full">
                      {tableData.label}
                    </span>
                  </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto">
                  {cart.length === 0 ? (
                    <div className="py-10 text-center px-4">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50">
                        <ShoppingCart className="h-6 w-6 text-orange-300" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Your cart is empty. Browse the menu to add items.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-orange-50">
                      {cart.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 hover:bg-orange-50/30 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {item.name}
                            </p>
                            {item.note && (
                              <p className="text-[10px] text-muted-foreground italic truncate">
                                {item.note}
                              </p>
                            )}
                            <p className="text-[11px] text-orange-500 font-medium mt-0.5">
                              ${item.price.toFixed(2)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              className="cursor-pointer flex h-6 w-6 items-center justify-center rounded-full border border-orange-200 text-orange-500 hover:bg-orange-50 transition-colors"
                              onClick={() => updateCartQuantity(index, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-sm font-bold w-5 text-center tabular-nums text-gray-900">
                              {item.quantity}
                            </span>
                            <button
                              className="cursor-pointer flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-600 hover:bg-orange-200 transition-colors"
                              onClick={() => updateCartQuantity(index, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {cart.length > 0 && (
                  <div className="p-4 border-t border-orange-100 space-y-3">
                    <div className="space-y-2">
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-orange-400" />
                        <Input
                          type="tel"
                          placeholder="Mobile number *"
                          className="pl-9 h-9 text-xs bg-orange-50/50 border-orange-100"
                          value={customerPhone}
                          onChange={(e) => {
                            setCustomerPhone(e.target.value);
                            if (phoneError) setPhoneError("");
                          }}
                          required
                        />
                      </div>
                      {phoneError && (
                        <p className="text-[10px] text-red-500">{phoneError}</p>
                      )}
                      <Input
                        placeholder="Your name (optional)"
                        className="h-9 text-xs bg-orange-50/50 border-orange-100"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-gray-700">Total</span>
                      <span className="text-orange-600 tabular-nums">
                        ${cartTotal.toFixed(2)}
                      </span>
                    </div>
                    <Button
                      className="cursor-pointer w-full h-11 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0 shadow-md shadow-orange-200 font-semibold text-sm"
                      onClick={handleOrder}
                      disabled={isOrdering || !customerPhone.replace(/\s/g, "")}
                    >
                      {isOrdering ? (
                        "Placing Order..."
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Place Order
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </Card>
            </aside>
          )}
        </div>
      </div>

      {/* ── Mobile Cart Sheet ── */}
      <Sheet open={showCart} onOpenChange={setShowCart}>
        <SheetContent className="flex flex-col w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-orange-600">Your Order</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-4">
            {cart.length === 0 ? (
              <div className="py-12 text-center">
                <ShoppingCart className="mx-auto mb-3 h-8 w-8 text-orange-200" />
                <p className="text-sm text-muted-foreground">
                  Your cart is empty.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="tel"
                    placeholder="e.g. +1 234 567 890"
                    value={customerPhone}
                    onChange={(e) => {
                      setCustomerPhone(e.target.value);
                      if (phoneError) setPhoneError("");
                    }}
                    className="border-orange-100 focus:border-orange-300"
                    required
                  />
                  {phoneError && (
                    <p className="text-[11px] text-red-500 mt-1">{phoneError}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Your Name <span className="text-muted-foreground/60">(optional)</span>
                  </label>
                  <Input
                    placeholder="Optional"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="border-orange-100 focus:border-orange-300"
                  />
                </div>
                <div className="divide-y rounded-xl border border-orange-100">
                  {cart.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        {item.note && (
                          <p className="text-[11px] text-muted-foreground italic truncate">{item.note}</p>
                        )}
                        <p className="text-xs text-orange-500 font-medium mt-0.5">
                          ${item.price.toFixed(2)} each
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer h-7 w-7 p-0 border-orange-200"
                          onClick={() => removeCartItem(index)}
                        >
                          <X className="h-3 w-3 text-red-400" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer h-7 w-7 p-0 border-orange-200"
                          onClick={() => updateCartQuantity(index, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-bold w-6 text-center tabular-nums">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer h-7 w-7 p-0 border-orange-200 bg-orange-50"
                          onClick={() => updateCartQuantity(index, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {cart.length > 0 && (
            <SheetFooter className="border-t border-orange-100 pt-4">
              <div className="w-full space-y-3">
                <div className="flex justify-between text-sm font-bold">
                  <span>Total</span>
                  <span className="tabular-nums text-orange-600">
                    ${cartTotal.toFixed(2)}
                  </span>
                </div>
                <Button
                  className="cursor-pointer w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0"
                  onClick={handleOrder}
                  disabled={isOrdering || !customerPhone.replace(/\s/g, "")}
                >
                  {isOrdering ? (
                    "Placing Order..."
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Place Order
                    </>
                  )}
                </Button>
              </div>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Item Detail Sheet ── */}
      <Sheet
        open={!!selectedItem}
        onOpenChange={(open) => !open && setSelectedItem(null)}
      >
        <SheetContent className="flex flex-col w-full sm:max-w-md">
          {selectedItem && (
            <>
              <SheetHeader>
                <SheetTitle className="text-orange-600">{selectedItem.name}</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto py-4">
                {selectedItem.imageUrl ? (
                  <div className="relative h-56 rounded-xl overflow-hidden mb-4">
                    <img
                      src={selectedItem.imageUrl}
                      alt={selectedItem.name}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <span className="absolute bottom-3 left-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-lg font-bold px-3 py-1 rounded-lg shadow-lg">
                      ${selectedItem.price.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <div className="relative h-56 bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center rounded-xl mb-4">
                    <span className="text-5xl">🍽️</span>
                    <span className="absolute bottom-3 left-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-lg font-bold px-3 py-1 rounded-lg shadow-lg">
                      ${selectedItem.price.toFixed(2)}
                    </span>
                  </div>
                )}
                {selectedItem.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {selectedItem.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl font-bold tabular-nums text-orange-600">
                    ${selectedItem.price.toFixed(2)}
                  </span>
                  {selectedItem.isVeg && (
                    <Badge
                      variant="outline"
                      className="text-emerald-600 border-emerald-200 bg-emerald-50"
                    >
                      <Leaf className="mr-1 h-3 w-3" />
                      Vegetarian
                    </Badge>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Special Instructions
                    </label>
                    <Input
                      placeholder="e.g. No onions, extra sauce..."
                      value={itemNote}
                      onChange={(e) => setItemNote(e.target.value)}
                      className="border-orange-100 focus:border-orange-300"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Quantity
                    </label>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="cursor-pointer h-10 w-10 p-0 border-orange-200"
                        onClick={() =>
                          setItemQuantity(Math.max(1, itemQuantity - 1))
                        }
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="text-lg font-bold w-8 text-center tabular-nums">
                        {itemQuantity}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="cursor-pointer h-10 w-10 p-0 border-orange-200 bg-orange-50"
                        onClick={() => setItemQuantity(itemQuantity + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <SheetFooter className="border-t border-orange-100 pt-4">
                <Button
                  className="cursor-pointer w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0 shadow-md shadow-orange-200 font-semibold"
                  onClick={() => {
                    addToCart(selectedItem, itemQuantity, itemNote);
                    setSelectedItem(null);
                  }}
                >
                  Add to Cart — ${(selectedItem.price * itemQuantity).toFixed(2)}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-orange-100 bg-white/95 backdrop-blur-lg lg:hidden">
        <div className="mx-auto flex h-14 max-w-2xl items-center">
          <button
            className={`flex flex-1 flex-col items-center gap-0.5 cursor-pointer transition-colors ${
              viewMode === "menu"
                ? "text-orange-600"
                : "text-gray-400 hover:text-orange-400"
            }`}
            onClick={() => setViewMode("menu")}
          >
            <Utensils className="h-4 w-4" />
            <span className="text-[10px] font-semibold">Menu</span>
          </button>
          <button
            className={`flex flex-1 flex-col items-center gap-0.5 cursor-pointer relative transition-colors ${
              viewMode === "orders" || viewMode === "orderDetail"
                ? "text-orange-600"
                : "text-gray-400 hover:text-orange-400"
            }`}
            onClick={() => {
              setViewMode("orders");
              setViewingOrderId(null);
            }}
          >
            <History className="h-4 w-4" />
            <span className="text-[10px] font-semibold">My Orders</span>
            {storedOrderIds.length > 0 && (
              <span className="absolute top-0.5 right-[calc(50%-16px)] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-orange-500 text-white text-[8px] font-bold">
                {storedOrderIds.length}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* ── Mobile Floating Cart Button ── */}
      {viewMode === "menu" && cartCount > 0 && (
        <div className="fixed bottom-16 left-4 right-4 z-50 mx-auto max-w-2xl lg:hidden">
          <Button
            className="cursor-pointer w-full h-14 text-sm font-bold rounded-2xl shadow-xl shadow-orange-300/40 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0"
            onClick={() => setShowCart(true)}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            View Cart ({cartCount} item{cartCount !== 1 ? "s" : ""})
            <span className="ml-auto tabular-nums">
              ${cartTotal.toFixed(2)}
            </span>
          </Button>
        </div>
      )}
    </div>
  );
}
