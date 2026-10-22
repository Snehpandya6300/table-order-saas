import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Download,
  Copy,
  Check,
  Trash2,
  Edit2,
  RefreshCw,
  LayoutGrid,
  CheckCircle2,
  XCircle,
  ListPlus,
  Layers,
  ArrowUpCircle,
  Send,
  Loader2,
  CheckCircle,
  MessageSquare,
  QrCode,
} from "lucide-react";

export function TableManager({
  restaurantId,
  restaurantName,
}: {
  restaurantId: Id<"restaurants">;
  restaurantName: string;
  restaurantSlug: string;
}) {
  const tables = useQuery(api.tables.getByRestaurant, { restaurantId });
  const tableStats = useQuery(api.tables.getStats, { restaurantId });
  const planLimits = useQuery(api.admin.getPlanLimits, { restaurantId });
  const createTable = useMutation(api.tables.create);
  const updateTable = useMutation(api.tables.update);
  const toggleActive = useMutation(api.tables.toggleActive);
  const removeTable = useMutation(api.tables.remove);
  const regenerateQr = useMutation(api.tables.regenerateQr);
  const submitPlanRequest = useMutation(api.planRequests.submit);
  const sendPlanEmail = useAction(api.planRequests.sendEmail);

  const [showNewTableDialog, setShowNewTableDialog] = useState(false);
  const [newTableLabel, setNewTableLabel] = useState("");
  const [editingTable, setEditingTable] = useState<Id<"tables"> | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Bulk add state
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkPrefix, setBulkPrefix] = useState("Table");
  const [bulkStart, setBulkStart] = useState(1);
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkCreating, setBulkCreating] = useState(false);

  // Update Plan / Contact Admin state
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [upgradeName, setUpgradeName] = useState("");
  const [upgradeEmail, setUpgradeEmail] = useState("");
  const [upgradePhone, setUpgradePhone] = useState("");
  const [upgradePlan, setUpgradePlan] = useState("pro");
  const [upgradeMessage, setUpgradeMessage] = useState("");
  const [upgradeSending, setUpgradeSending] = useState(false);
  const [upgradeSent, setUpgradeSent] = useState(false);

  if (!tables) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Loading tables...
      </div>
    );
  }

  const getQrUrl = (qrToken: string) =>
    `${window.location.origin}/q/${qrToken}`;

  const handleCopyLink = (qrToken: string) => {
    navigator.clipboard.writeText(getQrUrl(qrToken));
    setCopiedId(qrToken);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadQr = (qrToken: string, label: string) => {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(getQrUrl(qrToken))}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${label.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.target = "_blank";
    a.click();
  };

  const handleCreateTable = async () => {
    if (!newTableLabel.trim()) return;
    try {
      await createTable({
        restaurantId,
        label: newTableLabel.trim(),
      });
      setShowNewTableDialog(false);
      setNewTableLabel("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    }
  };

  const handleUpdateTable = async (id: Id<"tables">) => {
    if (!editLabel.trim()) return;
    await updateTable({ id, label: editLabel.trim() });
    setEditingTable(null);
    setEditLabel("");
  };

  const handleBulkCreate = async () => {
    setBulkCreating(true);
    let created = 0;
    try {
      for (let i = 0; i < bulkCount; i++) {
        const num = bulkStart + i;
        const label = `${bulkPrefix} ${num}`;
        try {
          await createTable({ restaurantId, label });
          created++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("Table limit reached")) {
            alert(`Stopped at ${created} tables. ${msg}`);
            break;
          }
        }
      }
      setShowBulkDialog(false);
      setBulkPrefix("Table");
      setBulkStart(1);
      setBulkCount(10);
    } finally {
      setBulkCreating(false);
    }
  };

  const handleUpgradeSubmit = async () => {
    if (!upgradeName.trim() || !upgradeEmail.trim()) return;
    setUpgradeSending(true);
    try {
      await submitPlanRequest({
        restaurantId,
        restaurantName,
        ownerName: upgradeName.trim(),
        ownerEmail: upgradeEmail.trim(),
        ownerPhone: upgradePhone.trim() || undefined,
        currentPlan: planLimits?.plan || "free",
        requestedPlan: upgradePlan,
        message: upgradeMessage.trim() || undefined,
      });

      await sendPlanEmail({
        restaurantName,
        ownerName: upgradeName.trim(),
        ownerEmail: upgradeEmail.trim(),
        ownerPhone: upgradePhone.trim() || undefined,
        currentPlan: planLimits?.plan || "free",
        requestedPlan: upgradePlan,
        message: upgradeMessage.trim() || undefined,
      });

      setUpgradeSent(true);
    } catch (err) {
      console.error(err);
      alert("Failed to send request. Please try again.");
    } finally {
      setUpgradeSending(false);
    }
  };

  const sortedTables = [...tables].sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  return (
    <div className="space-y-6">
      {/* Plan Limit Banner */}
      {planLimits && (
        <div className={`rounded-xl border p-4 flex items-center justify-between ${
          !planLimits.canAddTable
            ? "bg-amber-50 border-amber-200"
            : planLimits.currentTables >= planLimits.maxTables - 1
              ? "bg-orange-50 border-orange-200"
              : "bg-green-50 border-green-200"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-lg px-2 py-1 text-xs font-bold ${
              planLimits.plan === "enterprise"
                ? "bg-purple-100 text-purple-700"
                : planLimits.plan === "pro"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-700"
            }`}>
              {planLimits.planLabel}
            </div>
            <div>
              <p className="text-sm font-medium">
                {planLimits.currentTables} / {planLimits.maxTables === 999 ? "∞" : planLimits.maxTables} tables used
              </p>
              {!planLimits.canAddTable && (
                <p className="text-xs text-amber-700 mt-0.5">
                  Table limit reached. Upgrade your plan to add more tables.
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!planLimits.canAddTable && (
              <Button
                size="sm"
                className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F] text-xs h-8 px-3 shadow-md"
                onClick={() => setShowUpgradeDialog(true)}
              >
                <ArrowUpCircle className="mr-1.5 h-3.5 w-3.5" />
                Contact Admin to Upgrade
              </Button>
            )}
            {planLimits.canAddTable && planLimits.plan === "free" && (
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer text-xs h-8 border-green-200 text-[#4A8C6F] hover:bg-green-50"
                onClick={() => setShowUpgradeDialog(true)}
              >
                <ArrowUpCircle className="mr-1.5 h-3.5 w-3.5" />
                Update Plan
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Table Overview</h2>
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer border-green-200 text-[#4A8C6F] hover:bg-green-50"
            onClick={() => setShowBulkDialog(true)}
            disabled={planLimits ? !planLimits.canAddTable : undefined}
          >
            <ListPlus className="mr-1.5 h-3.5 w-3.5" />
            Bulk Add
          </Button>
          <Button
            size="sm"
            className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
            onClick={() => setShowNewTableDialog(true)}
            disabled={planLimits ? !planLimits.canAddTable : undefined}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Table
          </Button>
        </div>
      </div>

      {/* Tables Grid */}
      {sortedTables.length === 0 ? (
        <Card className="border-green-100 bg-white">
          <CardContent className="py-12 text-center">
            <LayoutGrid className="mx-auto mb-3 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-400">
              No tables yet. Create your first table to start taking orders.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer border-green-200 text-[#4A8C6F] hover:bg-green-50"
                onClick={() => setShowBulkDialog(true)}
              >
                <ListPlus className="mr-1.5 h-3.5 w-3.5" />
                Bulk Add Tables
              </Button>
              <Button
                size="sm"
                className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
                onClick={() => setShowNewTableDialog(true)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add One Table
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {sortedTables.map((table) => (
            <div
              key={table._id}
              className={`group rounded-2xl bg-white border overflow-hidden transition-all duration-200 ${
                table.isActive
                  ? "border-green-200 hover:shadow-lg hover:shadow-green-100 hover:border-green-300"
                  : "border-gray-200 opacity-60"
              }`}
            >
              {/* Table Card Header */}
              <div className={`px-4 py-3 flex items-center justify-between ${
                table.isActive
                  ? "bg-[#4A8C6F]"
                  : "bg-gray-300"
              }`}>
                {editingTable === table._id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      className="h-7 w-24 text-sm bg-white/90 border-green-300"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleUpdateTable(table._id)
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer h-7 w-7 p-0 text-white hover:bg-white/20"
                      onClick={() => handleUpdateTable(table._id)}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <span className="font-bold text-sm text-white">{table.label}</span>
                )}
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    table.isActive
                      ? "bg-green-50 text-[#4A8C6F] border-green-300"
                      : "bg-gray-50 text-gray-600 border-gray-200"
                  }`}
                >
                  {table.isActive ? "Active" : "Off"}
                </Badge>
              </div>

              {/* Mini Floor Plan */}
              <div className="p-4 flex items-center justify-center">
                <div className="relative">
                  {/* Table (center rectangle) */}
                  <div className={`w-16 h-10 rounded-lg border-2 flex items-center justify-center ${
                    table.isActive
                      ? "border-[#4A8C6F] bg-green-50"
                      : "border-gray-300 bg-gray-50"
                  }`}>
                    <QrCode className={`h-5 w-5 ${
                      table.isActive ? "text-[#4A8C6F]" : "text-gray-300"
                    }`} />
                  </div>
                  {/* Chairs around table */}
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#4A8C6F]" />
                  <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#4A8C6F]" />
                  <div className="absolute top-1/2 -left-2.5 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#4A8C6F]" />
                  <div className="absolute top-1/2 -right-2.5 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#4A8C6F]" />
                  <div className="absolute -top-2.5 -left-1 w-2.5 h-2.5 rounded-full bg-[#4A8C6F]" />
                  <div className="absolute -top-2.5 -right-1 w-2.5 h-2.5 rounded-full bg-[#4A8C6F]" />
                  <div className="absolute -bottom-2.5 -left-1 w-2.5 h-2.5 rounded-full bg-[#4A8C6F]" />
                  <div className="absolute -bottom-2.5 -right-1 w-2.5 h-2.5 rounded-full bg-[#4A8C6F]" />
                </div>
              </div>

              {/* QR Code */}
              <div className="px-4 pb-3">
                <div className="flex justify-center py-2 bg-gray-50 rounded-xl">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(getQrUrl(table.qrToken))}`}
                    alt={`QR for ${table.label}`}
                    className="rounded-lg"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-3 pb-3 space-y-1.5">
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer flex-1 text-[11px] h-7 border-green-200 text-[#4A8C6F] hover:bg-green-50"
                    onClick={() => handleCopyLink(table.qrToken)}
                  >
                    {copiedId === table.qrToken ? (
                      <>
                        <Check className="mr-1 h-3 w-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1 h-3 w-3" />
                        Link
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer flex-1 text-[11px] h-7 border-green-200 text-[#4A8C6F] hover:bg-green-50"
                    onClick={() => handleDownloadQr(table.qrToken, table.label)}
                  >
                    <Download className="mr-1 h-3 w-3" />
                    QR
                  </Button>
                </div>
                <div className="flex gap-1 justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer h-7 w-7 p-0 hover:bg-green-50 hover:text-[#4A8C6F]"
                    onClick={() => {
                      setEditingTable(table._id);
                      setEditLabel(table.label);
                    }}
                    title="Edit name"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer h-7 w-7 p-0 hover:bg-green-50 hover:text-[#4A8C6F]"
                    onClick={() => regenerateQr({ id: table._id })}
                    title="Regenerate QR"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer h-7 w-7 p-0 hover:bg-amber-50 hover:text-amber-600"
                    onClick={() => toggleActive({ id: table._id })}
                    title={table.isActive ? "Disable" : "Enable"}
                  >
                    {table.isActive ? (
                      <XCircle className="h-3.5 w-3.5" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer h-7 w-7 p-0 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => removeTable({ id: table._id })}
                    title="Delete table"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Single Table Dialog */}
      <Dialog open={showNewTableDialog} onOpenChange={setShowNewTableDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Table Label
              </label>
              <Input
                placeholder="e.g. Table 1, Counter A, Patio 3"
                value={newTableLabel}
                onChange={(e) => setNewTableLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateTable()}
              />
            </div>
            <p className="text-xs text-gray-400">
              A unique QR code will be generated for this table. Customers can
              scan it to view the menu and place orders.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setShowNewTableDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
              onClick={handleCreateTable}
              disabled={!newTableLabel.trim()}
            >
              Create Table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Plan / Contact Admin Dialog */}
      <Dialog
        open={showUpgradeDialog}
        onOpenChange={(open) => {
          setShowUpgradeDialog(open);
          if (!open) {
            setUpgradeSent(false);
            setUpgradeName("");
            setUpgradeEmail("");
            setUpgradePhone("");
            setUpgradeMessage("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-[#4A8C6F]" />
              Update Your Plan
            </DialogTitle>
          </DialogHeader>

          {upgradeSent ? (
            <div className="py-8 text-center space-y-3">
              <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-7 w-7 text-[#4A8C6F]" />
              </div>
              <h3 className="text-lg font-semibold text-[#4A8C6F]">
                Request Sent!
              </h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                Your upgrade request has been sent to our team. We&apos;ll contact
                you shortly at <strong>{upgradeEmail}</strong> to discuss your
                plan upgrade.
              </p>
              <Button
                className="cursor-pointer mt-2 border-green-200 text-[#4A8C6F] hover:bg-green-50"
                variant="outline"
                onClick={() => setShowUpgradeDialog(false)}
              >
                Close
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {/* Current Plan Info */}
                {planLimits && (
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#4A8C6F]">
                        Current Plan
                      </span>
                      <Badge className="bg-green-100 text-[#4A8C6F] border-green-300">
                        {planLimits.planLabel}
                      </Badge>
                    </div>
                    <p className="text-xs text-green-700 mt-1">
                      {planLimits.currentTables} /{" "}
                      {planLimits.maxTables === 999
                        ? "∞"
                        : planLimits.maxTables}{" "}
                      tables used
                    </p>
                  </div>
                )}

                {/* Plan Options */}
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Select Plan
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        id: "pro",
                        name: "Pro",
                        price: "$29/mo",
                        desc: "10 tables, Staff, Analytics",
                      },
                      {
                        id: "enterprise",
                        name: "Enterprise",
                        price: "$79/mo",
                        desc: "Unlimited tables, API, Priority",
                      },
                    ].map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        className={`cursor-pointer rounded-lg border-2 p-3 text-left transition-all ${
                          upgradePlan === plan.id
                            ? "border-[#4A8C6F] bg-green-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => setUpgradePlan(plan.id)}
                      >
                        <div className="font-semibold text-sm">{plan.name}</div>
                        <div className="text-[#4A8C6F] font-bold text-xs">
                          {plan.price}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">
                          {plan.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contact Form */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Your Name *
                  </label>
                  <Input
                    placeholder="John Doe"
                    value={upgradeName}
                    onChange={(e) => setUpgradeName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Email Address *
                  </label>
                  <Input
                    type="email"
                    placeholder="you@restaurant.com"
                    value={upgradeEmail}
                    onChange={(e) => setUpgradeEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Phone Number
                  </label>
                  <Input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={upgradePhone}
                    onChange={(e) => setUpgradePhone(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Message (optional)
                  </label>
                  <textarea
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px] resize-none"
                    placeholder="Tell us about your needs, expected table count, any questions..."
                    value={upgradeMessage}
                    onChange={(e) => setUpgradeMessage(e.target.value)}
                  />
                </div>

                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700">
                    Our team will contact you within 24 hours to process your
                    upgrade. No payment required until you confirm.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => setShowUpgradeDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
                  disabled={
                    upgradeSending ||
                    !upgradeName.trim() ||
                    !upgradeEmail.trim()
                  }
                  onClick={handleUpgradeSubmit}
                >
                  {upgradeSending ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      Send Request
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Add Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-[#4A8C6F]" />
              Bulk Add Tables
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Quick Presets */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Quick Presets
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { prefix: "Table", start: 1, count: 5, label: "5 Tables" },
                  { prefix: "Table", start: 1, count: 10, label: "10 Tables" },
                  { prefix: "Table", start: 1, count: 20, label: "20 Tables" },
                  { prefix: "Counter", start: 1, count: 5, label: "5 Counters" },
                  { prefix: "Seat", start: 1, count: 10, label: "10 Seats" },
                  { prefix: "Stall", start: 1, count: 8, label: "8 Stalls" },
                ].map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    className="cursor-pointer text-xs h-7 border-green-200 text-[#4A8C6F] hover:bg-green-50"
                    onClick={() => {
                      setBulkPrefix(preset.prefix);
                      setBulkStart(preset.start);
                      setBulkCount(preset.count);
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Settings */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Prefix
                </label>
                <Input
                  placeholder="Table"
                  value={bulkPrefix}
                  onChange={(e) => setBulkPrefix(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Start #
                </label>
                <Input
                  type="number"
                  min={1}
                  value={bulkStart}
                  onChange={(e) => setBulkStart(parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Count
                </label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={bulkCount}
                  onChange={(e) => setBulkCount(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg bg-green-50 border border-green-100 p-3">
              <p className="text-xs font-medium text-gray-500 mb-2">
                Preview (first 5):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: Math.min(bulkCount, 5) }, (_, i) => (
                  <Badge key={i} variant="secondary" className="text-xs bg-green-100 text-[#4A8C6F] border-green-200">
                    {bulkPrefix} {bulkStart + i}
                  </Badge>
                ))}
                {bulkCount > 5 && (
                  <Badge variant="secondary" className="text-xs bg-green-100 text-[#4A8C6F] border-green-200">
                    +{bulkCount - 5} more
                  </Badge>
                )}
              </div>
            </div>

            <p className="text-xs text-gray-400">
              Each table will get a unique QR code. You can manage, rename, or
              disable individual tables after creation.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setShowBulkDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
              onClick={handleBulkCreate}
              disabled={bulkCreating || bulkCount < 1}
            >
              {bulkCreating ? (
                <>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Creating {bulkCount} tables...
                </>
              ) : (
                <>
                  <Layers className="mr-1.5 h-3.5 w-3.5" />
                  Create {bulkCount} Tables
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
