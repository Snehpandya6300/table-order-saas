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
  ArrowLeft,
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
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  const table = useQuery(
    api.tables.getByQrToken,
    token ? { token } : "skip",
  );
  const restaurant = useQuery(
    api.restaurants.getById,
    table?.restaurantId ? { id: table.restaurantId } : "skip",
  );
  const categories = useQuery(
    api.categories.getByRestaurant,
    table?.restaurantId ? { restaurantId: table.restaurantId } : "skip",
  );
  const menuItems = useQuery(
    api.menuItems.getByRestaurant,
    table?.restaurantId ? { restaurantId: table.restaurantId } : "skip",
  );
  const searchResults = useQuery(
    api.menuItems.search,
    table?.restaurantId && searchQuery.trim()
      ? { restaurantId: table.restaurantId, query: searchQuery }
      : "skip",
  );
  const createOrder = useMutation(api.orders.create);

  // Reset search when table changes
  useEffect(() => {
    setSearchQuery("");
    setActiveCategory(null);
    setCart([]);
  }, [table?._id]);

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
    if (searchQuery.trim() && searchResults) {
      return searchResults;
    }
    if (activeCategory) {
      return visibleItems.filter((item) => item.categoryId === activeCategory);
    }
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

  const handleOrder = async () => {
    if (!table || !restaurant || cart.length === 0) return;
    setIsOrdering(true);
    try {
      const orderId = await createOrder({
        restaurantId: table.restaurantId,
        tableId: table._id,
        tableLabel: table.label,
        customerName: customerName.trim() || undefined,
        items: cart.map((c) => ({
          menuItemId: c.menuItemId,
          name: c.name,
          price: c.price,
          quantity: c.quantity,
          note: c.note || undefined,
        })),
        totalAmount: cartTotal,
      });
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

  // Loading state
  if (!token || table === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  // Invalid token
  if (!table) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <QrCode className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Invalid QR Code</h1>
          <p className="text-sm text-muted-foreground">
            This QR code is not valid or has been deactivated. Please ask
            your server for a new one.
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
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Order Placed</h1>
          <p className="text-sm text-muted-foreground mb-2">
            Your order has been sent to the kitchen.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Table {table.label}
          </p>
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() => setOrderSuccess(null)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Menu
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <div>
            <h1 className="text-sm font-semibold leading-none truncate max-w-[180px]">
              {restaurant?.name ?? "Restaurant"}
            </h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {table.label}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer relative"
            onClick={() => setShowCart(true)}
          >
            <ShoppingCart className="h-4 w-4" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background text-[10px] font-bold">
                {cartCount}
              </span>
            )}
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-4">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search the menu..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category Pills (only when not searching) */}
        {!searchQuery.trim() && visibleCategories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none">
            <button
              className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                activeCategory === null
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
              }`}
              onClick={() => setActiveCategory(null)}
            >
              All
            </button>
            {visibleCategories.map((cat) => (
              <button
                key={cat._id}
                className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  activeCategory === cat._id
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
                }`}
                onClick={() => setActiveCategory(cat._id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Menu Items */}
        <div className="space-y-3">
          {displayedItems.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? "No items match your search."
                  : "No items available right now."}
              </p>
            </div>
          ) : (
            displayedItems.map((item) => (
              <button
                key={item._id}
                className="w-full text-left rounded-xl border border-border/50 bg-card p-3 hover:border-border hover:shadow-sm transition-all cursor-pointer"
                onClick={() => openItemDetail(item)}
              >
                <div className="flex gap-3">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-20 w-20 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
                      🍽️
                    </div>
                  )}
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold truncate">
                        {item.name}
                      </span>
                      {item.isVeg && (
                        <Leaf className="h-3 w-3 text-emerald-600 shrink-0" />
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {item.description}
                      </p>
                    )}
                    <p className="text-sm font-bold mt-1.5 tabular-nums">
                      ${item.price.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-end shrink-0">
                    <Button
                      size="sm"
                      className="cursor-pointer h-8 w-8 p-0 rounded-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(item, 1, "");
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-4 right-4 z-50 mx-auto max-w-2xl">
          <Button
            className="cursor-pointer w-full h-14 text-sm font-semibold rounded-xl shadow-lg"
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

      {/* Cart Sheet */}
      <Sheet open={showCart} onOpenChange={setShowCart}>
        <SheetContent className="flex flex-col w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Your Order</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {cart.length === 0 ? (
              <div className="py-12 text-center">
                <ShoppingCart className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Your cart is empty. Browse the menu to add items.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Your Name
                  </label>
                  <Input
                    placeholder="Optional"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="divide-y rounded-lg border">
                  {cart.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.name}
                        </p>
                        {item.note && (
                          <p className="text-[11px] text-muted-foreground italic truncate">
                            {item.note}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          ${item.price.toFixed(2)} each
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer h-7 w-7 p-0"
                          onClick={() => updateCartQuantity(index, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-semibold w-6 text-center tabular-nums">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer h-7 w-7 p-0"
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
            <SheetFooter className="border-t pt-4">
              <div className="w-full space-y-3">
                <div className="flex justify-between text-sm font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">${cartTotal.toFixed(2)}</span>
                </div>
                <Button
                  className="cursor-pointer w-full h-12"
                  onClick={handleOrder}
                  disabled={isOrdering}
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

      {/* Item Detail Sheet */}
      <Sheet
        open={!!selectedItem}
        onOpenChange={(open) => !open && setSelectedItem(null)}
      >
        <SheetContent className="flex flex-col w-full sm:max-w-md">
          {selectedItem && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedItem.name}</SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto py-4">
                {selectedItem.imageUrl ? (
                  <img
                    src={selectedItem.imageUrl}
                    alt={selectedItem.name}
                    className="w-full h-48 rounded-xl object-cover mb-4"
                  />
                ) : (
                  <div className="flex w-full h-48 items-center justify-center rounded-xl bg-muted text-4xl mb-4">
                    🍽️
                  </div>
                )}

                {selectedItem.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {selectedItem.description}
                  </p>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl font-bold tabular-nums">
                    ${selectedItem.price.toFixed(2)}
                  </span>
                  {selectedItem.isVeg && (
                    <Badge
                      variant="outline"
                      className="text-emerald-600 border-emerald-200"
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
                        className="cursor-pointer h-9 w-9 p-0"
                        onClick={() =>
                          setItemQuantity(Math.max(1, itemQuantity - 1))
                        }
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="text-lg font-semibold w-8 text-center tabular-nums">
                        {itemQuantity}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="cursor-pointer h-9 w-9 p-0"
                        onClick={() => setItemQuantity(itemQuantity + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <SheetFooter className="border-t pt-4">
                <Button
                  className="cursor-pointer w-full h-12"
                  onClick={() => {
                    addToCart(selectedItem, itemQuantity, itemNote);
                    setSelectedItem(null);
                  }}
                >
                  Add to Cart — $
                  {(selectedItem.price * itemQuantity).toFixed(2)}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
