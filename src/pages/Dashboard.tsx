import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SetupRestaurant } from "@/components/dashboard/SetupRestaurant";
import { MenuManager } from "@/components/dashboard/MenuManager";
import { TableManager } from "@/components/dashboard/TableManager";
import { OrderManager } from "@/components/dashboard/OrderManager";
import { StaffManager } from "@/components/dashboard/StaffManager";
import {
  LogOut,
  Utensils,
  Menu,
  LayoutGrid,
  ClipboardList,
  Settings,
  TrendingUp,
  ShoppingBag,
  Clock,
  Pencil,
  QrCode,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router";

type Tab = "orders" | "menu" | "tables" | "staff" | "settings";

const TABS: { id: Tab; label: string; icon: typeof Utensils }[] = [
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "menu", label: "Menu", icon: Menu },
  { id: "tables", label: "Tables", icon: LayoutGrid },
  { id: "staff", label: "Staff", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("orders");

  const restaurants = useQuery(
    api.restaurants.getByOwner,
    user?._id ? { ownerId: user._id } : "skip",
  );
  const updateRestaurant = useMutation(api.restaurants.update);
  const stats = useQuery(
    api.orders.getStats,
    restaurants?.[0]?._id
      ? { restaurantId: restaurants[0]._id }
      : "skip",
  );

  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    description: "",
    phone: "",
    address: "",
  });

  const restaurant = restaurants?.[0];

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (restaurants === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (restaurants.length === 0) {
    return <SetupRestaurant />;
  }

  const openSettings = () => {
    setSettingsForm({
      name: restaurant?.name ?? "",
      description: restaurant?.description ?? "",
      phone: restaurant?.phone ?? "",
      address: restaurant?.address ?? "",
    });
    setShowSettingsDialog(true);
  };

  const handleSaveSettings = async () => {
    if (!restaurant) return;
    await updateRestaurant({
      id: restaurant._id,
      name: settingsForm.name.trim(),
      description: settingsForm.description.trim() || undefined,
      phone: settingsForm.phone.trim() || undefined,
      address: settingsForm.address.trim() || undefined,
    });
    setShowSettingsDialog(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
              <QrCode className="h-4 w-4 text-background" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-none">
                {restaurant?.name}
              </h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                QR Table Order
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer text-muted-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* Stats */}
        {stats && (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <ShoppingBag className="h-3.5 w-3.5" />
                <span className="text-xs">Today&apos;s Orders</span>
              </div>
              <span className="text-2xl font-bold">{stats.todayOrders}</span>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="text-xs">Today&apos;s Revenue</span>
              </div>
              <span className="text-2xl font-bold">
                ${stats.todayRevenue.toFixed(2)}
              </span>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs">Pending</span>
              </div>
              <span className="text-2xl font-bold">{stats.pendingOrders}</span>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <ClipboardList className="h-3.5 w-3.5" />
                <span className="text-xs">Total Orders</span>
              </div>
              <span className="text-2xl font-bold">{stats.totalOrders}</span>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border/50 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "orders" && restaurant && (
          <OrderManager restaurantId={restaurant._id} />
        )}
        {activeTab === "menu" && restaurant && (
          <MenuManager restaurantId={restaurant._id} />
        )}
        {activeTab === "tables" && restaurant && (
          <TableManager
            restaurantId={restaurant._id}
            restaurantSlug={restaurant.slug}
          />
        )}
        {activeTab === "staff" && restaurant && (
          <StaffManager restaurantId={restaurant._id} />
        )}
        {activeTab === "settings" && restaurant && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Restaurant Details</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  onClick={openSettings}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-xs text-muted-foreground">Name</span>
                  <p className="text-sm font-medium">{restaurant.name}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">
                    Description
                  </span>
                  <p className="text-sm font-medium">
                    {restaurant.description || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Phone</span>
                  <p className="text-sm font-medium">
                    {restaurant.phone || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Address</span>
                  <p className="text-sm font-medium">
                    {restaurant.address || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">
                    Subscription
                  </span>
                  <p className="text-sm font-medium">
                    <Badge variant="outline" className="capitalize">
                      {restaurant.subscriptionStatus ?? "trial"}
                    </Badge>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Restaurant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Name</label>
              <Input
                value={settingsForm.name}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Description
              </label>
              <Textarea
                value={settingsForm.description}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    description: e.target.value,
                  })
                }
                rows={3}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Phone</label>
              <Input
                value={settingsForm.phone}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, phone: e.target.value })
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Address
              </label>
              <Input
                value={settingsForm.address}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, address: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setShowSettingsDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer"
              onClick={handleSaveSettings}
              disabled={!settingsForm.name.trim()}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
