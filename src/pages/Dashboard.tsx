import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  LayoutDashboard,
  AlertTriangle,
  Mail,
  Phone,
  Send,
  Loader2,
  CheckCircle,
  MessageSquare,
  Ban,
} from "lucide-react";
import { useNavigate } from "react-router";

type Tab = "orders" | "menu" | "tables" | "staff" | "settings";

const ALL_TABS: { id: Tab; label: string; icon: typeof QrCode; minRole?: string }[] = [
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "menu", label: "Menu", icon: Menu, minRole: "manager" },
  { id: "tables", label: "Tables", icon: LayoutGrid, minRole: "manager" },
  { id: "staff", label: "Staff", icon: Users, minRole: "owner" },
  { id: "settings", label: "Settings", icon: Settings, minRole: "owner" },
];

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("orders");

  const ownedRestaurants = useQuery(
    api.restaurants.getByOwner,
    user?._id ? { ownerId: user._id } : "skip",
  );
  const staffRestaurants = useQuery(
    api.restaurants.getByStaffEmail,
    user?.email ? { email: user.email } : "skip",
  );

  const restaurants = ownedRestaurants && staffRestaurants
    ? [
        ...ownedRestaurants,
        ...staffRestaurants.filter(
          (sr) => !ownedRestaurants.some((or) => or._id === sr._id),
        ),
      ]
    : undefined;
  const restaurant = restaurants?.[0];
  const isOwner = ownedRestaurants?.some((r) => r._id === restaurant?._id);
  const staffRole = staffRestaurants?.find((r) => r._id === restaurant?._id)?.staffRole as "owner" | "manager" | "staff" | undefined;

  const updateRestaurant = useMutation(api.restaurants.update);
  const stats = useQuery(
    api.orders.getStats,
    restaurant?._id
      ? { restaurantId: restaurant._id }
      : "skip",
  );

  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    description: "",
    phone: "",
    address: "",
  });

  // Suspended account contact form
  const submitPlanRequest = useMutation(api.planRequests.submit);
  const sendPlanEmail = useAction(api.planRequests.sendEmail);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSending, setContactSending] = useState(false);
  const [contactSent, setContactSent] = useState(false);

  const isSuspended = restaurant?.subscriptionStatus === "suspended";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (restaurants === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#EEF5F0" }}>
        <div className="animate-pulse text-gray-400">Loading...</div>
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

  const handleContactSubmit = async () => {
    if (!restaurant || !contactName.trim() || !contactEmail.trim()) return;
    setContactSending(true);
    try {
      await submitPlanRequest({
        restaurantId: restaurant._id,
        restaurantName: restaurant.name,
        ownerName: contactName.trim(),
        ownerEmail: contactEmail.trim(),
        ownerPhone: contactPhone.trim() || undefined,
        currentPlan: restaurant.subscriptionPlan || "free",
        requestedPlan: "pro",
        message: contactMessage.trim() || "Account suspended - requesting reactivation",
      });
      await sendPlanEmail({
        restaurantName: restaurant.name,
        ownerName: contactName.trim(),
        ownerEmail: contactEmail.trim(),
        ownerPhone: contactPhone.trim() || undefined,
        currentPlan: restaurant.subscriptionPlan || "free",
        requestedPlan: "pro",
        message: contactMessage.trim() || "Account suspended - requesting reactivation",
      });
      setContactSent(true);
    } catch (err) {
      console.error(err);
      alert("Failed to send request. Please try again.");
    } finally {
      setContactSending(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#EEF5F0" }}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-green-200/50 bg-white/95 backdrop-blur-lg shadow-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#4A8C6F] shadow-md shadow-green-200">
              <QrCode className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold leading-none text-gray-900">
                  {restaurant?.name}
                </h1>
                {!isOwner && staffRole && (
                  <Badge variant="outline" className="text-[10px] capitalize bg-blue-50 text-blue-600 border-blue-200">
                    {staffRole}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-[#4A8C6F] font-medium mt-0.5">
                QR Table Order
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer text-gray-500 hover:text-[#4A8C6F] hover:bg-green-50"
            onClick={handleSignOut}
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* Suspended Account Block */}
        {isSuspended && (
          <div className="max-w-lg mx-auto">
            <Card className="border-red-200 bg-white shadow-lg overflow-hidden">
              {/* Red Header */}
              <div className="bg-red-500 px-6 py-5 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-3">
                  <Ban className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">Account Suspended</h2>
                <p className="text-sm text-white/80 mt-1">
                  Your subscription has been suspended. Contact admin to reactivate.
                </p>
              </div>

              <div className="p-6">
                {contactSent ? (
                  <div className="py-8 text-center space-y-3">
                    <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="h-7 w-7 text-[#4A8C6F]" />
                    </div>
                    <h3 className="text-lg font-semibold text-[#4A8C6F]">
                      Request Sent!
                    </h3>
                    <p className="text-sm text-gray-500 max-w-sm mx-auto">
                      Your request has been sent to our team. We&apos;ll contact you at <strong>{contactEmail}</strong> to help reactivate your account.
                    </p>
                    <Button
                      className="cursor-pointer mt-2 bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
                      onClick={() => {
                        setContactSent(false);
                        setContactName("");
                        setContactEmail("");
                        setContactPhone("");
                        setContactMessage("");
                      }}
                    >
                      Send Another Request
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Please fill in the form below and our team will contact you within 24 hours to reactivate your account.
                    </p>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Your Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        placeholder="Enter your name"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        className="border-red-200 focus:border-[#4A8C6F]"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="email"
                        placeholder="you@restaurant.com"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="border-red-200 focus:border-[#4A8C6F]"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Phone Number
                      </label>
                      <Input
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        className="border-red-200 focus:border-[#4A8C6F]"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Message (optional)
                      </label>
                      <Textarea
                        placeholder="Tell us about your issue or request..."
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        rows={3}
                        className="border-red-200 focus:border-[#4A8C6F]"
                      />
                    </div>

                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-blue-700">
                        Our team will contact you within 24 hours to process your request.
                      </p>
                    </div>

                    <Button
                      className="cursor-pointer w-full h-11 bg-[#4A8C6F] text-white hover:bg-[#3D7A5F] font-semibold"
                      disabled={contactSending || !contactName.trim() || !contactEmail.trim()}
                      onClick={handleContactSubmit}
                    >
                      {contactSending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Contact Admin
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Normal Dashboard Content (hidden when suspended) */}
        {!isSuspended && (
          <>
        {/* Stats */}
        {stats && (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
            <Card className="p-4 border-green-100 bg-white hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 text-[#4A8C6F] mb-1">
                <ShoppingBag className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Today&apos;s Orders</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">{stats.todayOrders}</span>
            </Card>
            <Card className="p-4 border-green-100 bg-white hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 text-[#5B9A7C] mb-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Today&apos;s Revenue</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">
                ${stats.todayRevenue.toFixed(2)}
              </span>
            </Card>
            <Card className="p-4 border-green-100 bg-white hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 text-amber-500 mb-1">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Pending</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">{stats.pendingOrders}</span>
            </Card>
            <Card className="p-4 border-green-100 bg-white hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 text-[#6DAA8D] mb-1">
                <ClipboardList className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Total Orders</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">{stats.totalOrders}</span>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-green-200/50 overflow-x-auto">
          {ALL_TABS.filter((tab) => {
            if (!isOwner && !staffRole) return tab.id === "orders";
            if (staffRole === "staff") return tab.id === "orders";
            if (staffRole === "manager") return !tab.minRole || tab.minRole === "manager";
            return true;
          }).map((tab) => (
            <button
              key={tab.id}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-[#4A8C6F] text-[#4A8C6F]"
                  : "border-transparent text-gray-400 hover:text-[#5B9A7C]"
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
            restaurantName={restaurant.name}
          />
        )}
        {activeTab === "staff" && restaurant && (
          <StaffManager restaurantId={restaurant._id} />
        )}
        {activeTab === "settings" && restaurant && (
          <div className="space-y-4">
            <Card className="border-green-100 bg-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900">Restaurant Details</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer border-green-200 text-[#4A8C6F] hover:bg-green-50"
                    onClick={openSettings}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-gray-400">Name</span>
                    <p className="text-sm font-medium text-gray-800">{restaurant.name}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">Description</span>
                    <p className="text-sm font-medium text-gray-800">
                      {restaurant.description || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">Phone</span>
                    <p className="text-sm font-medium text-gray-800">
                      {restaurant.phone || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">Address</span>
                    <p className="text-sm font-medium text-gray-800">
                      {restaurant.address || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">Subscription</span>
                    <p className="text-sm font-medium">
                      <Badge variant="outline" className="capitalize bg-green-50 text-[#4A8C6F] border-green-200">
                        {restaurant.subscriptionStatus ?? "trial"}
                      </Badge>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
          </>
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
              className="cursor-pointer bg-[#4A8C6F] hover:bg-[#3D7A5F] text-white"
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
