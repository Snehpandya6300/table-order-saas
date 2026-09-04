import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  LayoutDashboard,
  Users,
  UtensilsCrossed,
  LogOut,
  QrCode,
  TrendingUp,
  ShoppingBag,
  Crown,
  Shield,
  Zap,
  Star,
  ChevronRight,
  DollarSign,
  Store,
  Ban,
  CheckCircle2,
  XCircle,
  Settings,
  BarChart3,
  CreditCard,
  AlertTriangle,
} from "lucide-react";

const PLAN_CONFIG = {
  free: {
    label: "Free",
    price: 0,
    maxTables: 5,
    color: "bg-gray-100 text-gray-700 border-gray-200",
    icon: <Star className="h-4 w-4" />,
  },
  pro: {
    label: "Pro",
    price: 29,
    maxTables: 10,
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: <Zap className="h-4 w-4" />,
  },
  enterprise: {
    label: "Enterprise",
    price: 79,
    maxTables: 999,
    color: "bg-purple-100 text-purple-700 border-purple-200",
    icon: <Crown className="h-4 w-4" />,
  },
} as const;

type Tab = "overview" | "restaurants" | "plans";

export default function Admin() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [selectedRestaurant, setSelectedRestaurant] = useState<Id<"restaurants"> | null>(null);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [planRestaurant, setPlanRestaurant] = useState<Id<"restaurants"> | null>(null);
  const [suspendRestaurant, setSuspendRestaurant] = useState<Id<"restaurants"> | null>(null);
  const [newPlan, setNewPlan] = useState<"free" | "pro" | "enterprise">("free");
  const [customMaxTables, setCustomMaxTables] = useState("");
  const [suspendReason, setSuspendReason] = useState("");

  const restaurants = useQuery(
    api.admin.listRestaurants,
    user?._id ? { adminUserId: user._id } : "skip",
  );
  const platformStats = useQuery(
    api.admin.getPlatformStats,
    user?._id ? { adminUserId: user._id } : "skip",
  );
  const plans = useQuery(api.admin.getPlans);

  const updateSubscription = useMutation(api.admin.updateSubscription);
  const toggleStatus = useMutation(api.admin.toggleRestaurantStatus);
  const initPlans = useMutation(api.admin.initPlans);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleUpdatePlan = async () => {
    if (!planRestaurant || !user?._id) return;
    try {
      await updateSubscription({
        adminUserId: user._id,
        restaurantId: planRestaurant,
        plan: newPlan,
        maxTables: customMaxTables ? parseInt(customMaxTables) : undefined,
        subscriptionStatus: "active",
      });
      setShowPlanDialog(false);
      setPlanRestaurant(null);
      setCustomMaxTables("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleSuspend = async (suspend: boolean) => {
    if (!suspendRestaurant || !user?._id) return;
    try {
      await toggleStatus({
        adminUserId: user._id,
        restaurantId: suspendRestaurant,
        suspend,
        reason: suspend ? suspendReason : undefined,
      });
      setShowSuspendDialog(false);
      setSuspendRestaurant(null);
      setSuspendReason("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleInitPlans = async () => {
    if (!user?._id) return;
    try {
      await initPlans({ adminUserId: user._id });
    } catch (err) {
      console.error(err);
    }
  };

  // Check if user is admin
  if (user && user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full p-8 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground mb-4">
            You need admin privileges to access this panel.
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            Your account role: <span className="font-medium capitalize">{user.role ?? "user"}</span>
          </p>
          <Button onClick={() => navigate("/dashboard")} className="w-full">
            Go to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  if (!restaurants || !platformStats) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <BarChart3 className="h-4 w-4" /> },
    { id: "restaurants", label: "Restaurants", icon: <Store className="h-4 w-4" /> },
    { id: "plans", label: "Plans", icon: <CreditCard className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500">
              <QrCode className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Admin Panel</h1>
              <p className="text-[11px] text-muted-foreground">QR Table Order — Platform Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="gap-1 text-xs">
              <Crown className="h-3 w-3" />
              Super Admin
            </Badge>
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
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* Tab Navigation */}
        <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Platform Overview</h2>
              <p className="text-sm text-muted-foreground">
                Key metrics and statistics across all restaurants.
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <UtensilsCrossed className="h-3.5 w-3.5" />
                  <span className="text-xs">Restaurants</span>
                </div>
                <span className="text-2xl font-bold">{platformStats.totalRestaurants}</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {platformStats.activeRestaurants} active
                </p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span className="text-xs">Total Orders</span>
                </div>
                <span className="text-2xl font-bold">{platformStats.totalOrders}</span>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-3.5 w-3.5" />
                  <span className="text-xs">Users</span>
                </div>
                <span className="text-2xl font-bold">{platformStats.totalUsers}</span>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span className="text-xs">Revenue</span>
                </div>
                <span className="text-2xl font-bold">
                  ${platformStats.totalRevenue.toLocaleString()}
                </span>
              </Card>
            </div>

            {/* Plan Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Subscription Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 grid-cols-3">
                  {Object.entries(PLAN_CONFIG).map(([key, config]) => {
                    const count =
                      platformStats.planCounts[key as keyof typeof platformStats.planCounts] ?? 0;
                    return (
                      <div
                        key={key}
                        className={`rounded-xl border p-4 ${config.color}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {config.icon}
                          <span className="font-semibold text-sm">{config.label}</span>
                        </div>
                        <span className="text-3xl font-bold">{count}</span>
                        <p className="text-xs opacity-75 mt-1">restaurants</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Status Breakdown */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-xs text-muted-foreground">Trials</span>
                </div>
                <span className="text-xl font-bold">{platformStats.trialRestaurants}</span>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-xs text-muted-foreground">Active</span>
                </div>
                <span className="text-xl font-bold">{platformStats.activeSubscriptions}</span>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full bg-yellow-500" />
                  <span className="text-xs text-muted-foreground">Expired</span>
                </div>
                <span className="text-xl font-bold">{platformStats.expiredSubscriptions}</span>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-xs text-muted-foreground">Suspended</span>
                </div>
                <span className="text-xl font-bold">{platformStats.suspendedRestaurants}</span>
              </Card>
            </div>
          </div>
        )}

        {/* Restaurants Tab */}
        {activeTab === "restaurants" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Restaurants</h2>
                <p className="text-sm text-muted-foreground">
                  Manage all registered restaurants and their subscriptions.
                </p>
              </div>
              <Badge variant="outline">{restaurants.length} total</Badge>
            </div>

            {restaurants.length === 0 ? (
              <Card className="p-12 text-center">
                <Store className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No restaurants registered yet.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {restaurants.map((r) => {
                  const planConfig =
                    PLAN_CONFIG[r.subscriptionPlan as keyof typeof PLAN_CONFIG] ??
                    PLAN_CONFIG.free;
                  return (
                    <Card
                      key={r._id}
                      className={`transition-all hover:shadow-md ${
                        r.subscriptionStatus === "suspended" ? "opacity-60 border-red-200" : ""
                      }`}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-base font-semibold truncate">{r.name}</h3>
                              {r.subscriptionStatus === "suspended" && (
                                <Badge variant="destructive" className="text-[10px]">
                                  <Ban className="h-2.5 w-2.5 mr-0.5" />
                                  Suspended
                                </Badge>
                              )}
                              {!r.isOpen && r.subscriptionStatus !== "suspended" && (
                                <Badge variant="secondary" className="text-[10px]">Closed</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mb-3">
                              {r.ownerName} · {r.ownerEmail} · {r.slug}
                            </p>

                            {/* Stats Row */}
                            <div className="flex gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <QrCode className="h-3 w-3" />
                                {r.stats.activeTables}/{r.maxTables} tables
                              </span>
                              <span className="flex items-center gap-1">
                                <ShoppingBag className="h-3 w-3" />
                                {r.stats.orders} orders
                              </span>
                              <span className="flex items-center gap-1">
                                <UtensilsCrossed className="h-3 w-3" />
                                {r.stats.menuItems} items
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {r.stats.staff} staff
                              </span>
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                ${r.stats.totalRevenue.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Plan Badge + Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={`${planConfig.color} gap-1 text-xs`}>
                              {planConfig.icon}
                              {planConfig.label}
                            </Badge>
                            <Badge variant="outline" className="capitalize text-xs">
                              {r.subscriptionStatus ?? "trial"}
                            </Badge>

                            <div className="flex gap-1 ml-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs cursor-pointer"
                                onClick={() => {
                                  setPlanRestaurant(r._id);
                                  setNewPlan(r.subscriptionPlan as "free" | "pro" | "enterprise" ?? "free");
                                  setCustomMaxTables(String(r.maxTables));
                                  setShowPlanDialog(true);
                                }}
                              >
                                <CreditCard className="h-3 w-3 mr-1" />
                                Plan
                              </Button>
                              {r.subscriptionStatus === "suspended" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-green-600 cursor-pointer"
                                  onClick={() => {
                                    setSuspendRestaurant(r._id);
                                    handleSuspend(false);
                                  }}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Activate
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-red-600 cursor-pointer"
                                  onClick={() => {
                                    setSuspendRestaurant(r._id);
                                    setSuspendReason("");
                                    setShowSuspendDialog(true);
                                  }}
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Suspend
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Plans Tab */}
        {activeTab === "plans" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Subscription Plans</h2>
                <p className="text-sm text-muted-foreground">
                  Manage pricing plans and table limits for all restaurants.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleInitPlans}>
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                Reset to Default
              </Button>
            </div>

            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              {Object.entries(PLAN_CONFIG).map(([key, config]) => (
                <Card
                  key={key}
                  className={`relative overflow-hidden ${
                    key === "pro"
                      ? "border-blue-300 ring-2 ring-blue-100"
                      : key === "enterprise"
                        ? "border-purple-300 ring-2 ring-purple-100"
                        : ""
                  }`}
                >
                  {key === "pro" && (
                    <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                      POPULAR
                    </div>
                  )}
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      {config.icon}
                      <h3 className="text-lg font-bold">{config.label}</h3>
                    </div>
                    <div className="mb-4">
                      <span className="text-3xl font-bold">${config.price}</span>
                      <span className="text-sm text-muted-foreground">/month</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>Up to {config.maxTables === 999 ? "Unlimited" : config.maxTables} tables</span>
                      </div>
                      {key === "free" && (
                        <>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>Basic menu management</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>Order management</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>QR code generation</span>
                          </div>
                        </>
                      )}
                      {key === "pro" && (
                        <>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>Everything in Free</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>Staff management</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>Payment tracking</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>AI menu scanner</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>Advanced analytics</span>
                          </div>
                        </>
                      )}
                      {key === "enterprise" && (
                        <>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>Everything in Pro</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>Unlimited tables</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>Custom branding</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>Priority support</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>API access</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>Multi-location</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Restaurants on this plan */}
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {platformStats.planCounts[key as keyof typeof platformStats.planCounts] ?? 0}
                        </span>{" "}
                        restaurants on this plan
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Table Limits Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Table Limits Enforcement
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  Table limits are enforced when restaurants create new tables. If a restaurant
                  reaches its limit, they must upgrade their plan to add more.
                </p>
                <p>
                  <strong className="text-foreground">Free:</strong> 5 tables max &nbsp;·&nbsp;
                  <strong className="text-foreground">Pro:</strong> 10 tables max &nbsp;·&nbsp;
                  <strong className="text-foreground">Enterprise:</strong> Unlimited
                </p>
                <p>
                  You can set custom table limits per restaurant from the Restaurants tab by clicking
                  the <strong className="text-foreground">Plan</strong> button.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Update Plan Dialog */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Subscription Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Plan</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(PLAN_CONFIG) as [string, (typeof PLAN_CONFIG)[keyof typeof PLAN_CONFIG]][]).map(
                  ([key, config]) => (
                    <button
                      key={key}
                      onClick={() => setNewPlan(key as "free" | "pro" | "enterprise")}
                      className={`rounded-lg border p-3 text-center transition-all cursor-pointer ${
                        newPlan === key
                          ? "border-orange-400 bg-orange-50 ring-1 ring-orange-200"
                          : "border-border hover:border-orange-200"
                      }`}
                    >
                      <div className="flex justify-center mb-1">{config.icon}</div>
                      <span className="text-xs font-medium">{config.label}</span>
                      <p className="text-[10px] text-muted-foreground">${config.price}/mo</p>
                    </button>
                  ),
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Max Tables{" "}
                <span className="text-muted-foreground font-normal">(leave empty for default)</span>
              </label>
              <Input
                type="number"
                placeholder={String(PLAN_CONFIG[newPlan].maxTables)}
                value={customMaxTables}
                onChange={(e) => setCustomMaxTables(e.target.value)}
                min="1"
              />
              <p className="text-[11px] text-muted-foreground">
                Default for {PLAN_CONFIG[newPlan].label}: {PLAN_CONFIG[newPlan].maxTables === 999 ? "Unlimited" : PLAN_CONFIG[newPlan].maxTables} tables
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPlanDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePlan} className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
              Update Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Dialog */}
      <Dialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Suspend Restaurant
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              This will immediately close the restaurant and deactivate all QR codes. The restaurant
              owner will not be able to access their dashboard.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason (optional)</label>
              <Input
                placeholder="e.g., Payment overdue, Terms violation..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuspendDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleSuspend(true)}
            >
              <Ban className="h-3.5 w-3.5 mr-1.5" />
              Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
