import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  Loader2,
  Mail,
  MessageCircle,
  Percent,
  Plus,
  Send,
  Smartphone,
  Ticket,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

const money = (value: number) => value.toFixed(2);
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const AUDIENCE_LABEL: Record<string, string> = {
  all: "All guests",
  repeat: "Repeat guests",
  lapsed: "Lapsed (45+ days)",
  high_spenders: "High spenders",
};

const CHANNEL_ICON = {
  email: Mail,
  sms: Smartphone,
  whatsapp: MessageCircle,
} as const;

type Tab = "coupons" | "campaigns";

function CampaignRow({
  campaign,
  busy,
  onSend,
  onHandOff,
  onDelete,
}: {
  campaign: Doc<"campaigns">;
  busy: boolean;
  onSend: () => void;
  onHandOff: (count: number) => void;
  onDelete: () => void;
}) {
  const recipients = useQuery(api.marketing.campaignRecipients, { campaignId: campaign._id }) ?? [];
  const Icon = CHANNEL_ICON[campaign.channel];

  const exportCsv = () => {
    const lines = ["name,email,phone"];
    for (const row of recipients) {
      lines.push(`"${row.name}","${row.email}","${row.phone}"`);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${campaign.name.replace(/\s+/g, "-").toLowerCase()}-audience.csv`;
    link.click();
    URL.revokeObjectURL(url);
    onHandOff(recipients.length);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-50 text-[#4A8C6F]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{campaign.name}</p>
        <p className="text-[11px] text-gray-400">
          {AUDIENCE_LABEL[campaign.audience]} · {campaign.channel.toUpperCase()} ·{" "}
          {campaign.channel === "email"
            ? `${recipients.length} with email`
            : `${recipients.length} with phone`}
          {campaign.sentCount > 0 ? ` · ${campaign.sentCount} sent` : ""}
          {campaign.failedCount > 0 ? ` · ${campaign.failedCount} failed` : ""}
        </p>
        {campaign.lastError && (
          <p className="mt-0.5 text-[10px] text-red-500">{campaign.lastError}</p>
        )}
      </div>
      <Badge
        variant="outline"
        className={`text-[10px] capitalize ${
          campaign.status === "sent"
            ? "border-green-200 bg-green-50 text-[#3D7A5F]"
            : campaign.status === "handed_off"
              ? "border-blue-200 bg-blue-50 text-blue-600"
              : campaign.status === "failed"
                ? "border-red-200 bg-red-50 text-red-600"
                : "border-gray-200 bg-gray-50 text-gray-500"
        }`}
      >
        {campaign.status.replace("_", " ")}
      </Badge>
      <div className="flex gap-1">
        {campaign.channel === "email" ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 cursor-pointer border-green-200 text-[11px] text-[#4A8C6F] hover:bg-green-50"
            disabled={busy}
            onClick={onSend}
          >
            {busy ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Send className="mr-1 h-3 w-3" />
            )}
            Send
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 cursor-pointer border-green-200 text-[11px] text-[#4A8C6F] hover:bg-green-50"
            onClick={exportCsv}
          >
            <Download className="mr-1 h-3 w-3" /> Export
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 cursor-pointer text-gray-400 hover:bg-red-50 hover:text-red-500"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function MarketingManager({ restaurantId }: { restaurantId: Id<"restaurants"> }) {
  const [tab, setTab] = useState<Tab>("coupons");
  const [busy, setBusy] = useState<string | null>(null);

  const coupons = useQuery(api.marketing.listCoupons, { restaurantId }) ?? [];
  const campaigns = useQuery(api.marketing.listCampaigns, { restaurantId }) ?? [];
  const audience = useQuery(api.marketing.audienceSizes, { restaurantId });

  const createCoupon = useMutation(api.marketing.createCoupon);
  const updateCoupon = useMutation(api.marketing.updateCoupon);
  const removeCoupon = useMutation(api.marketing.removeCoupon);
  const createCampaign = useMutation(api.marketing.createCampaign);
  const deleteCampaign = useMutation(api.marketing.deleteCampaign);
  const sendEmailCampaign = useAction(api.marketing.sendEmailCampaign);
  const handOffCampaign = useMutation(api.marketing.handOffCampaign);

  const [couponDialog, setCouponDialog] = useState(false);
  const [couponForm, setCouponForm] = useState({
    code: "",
    description: "",
    type: "percent",
    value: "10",
    minOrder: "0",
    maxDiscount: "",
    endsAt: "",
    startTime: "",
    endTime: "",
    daysOfWeek: [] as number[],
    maxUses: "",
  });

  const [campaignDialog, setCampaignDialog] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    channel: "email",
    audience: "all",
    subject: "",
    body: "",
    fromAddress: "",
  });

  const handleCreateCoupon = async () => {
    if (couponForm.code.trim().length < 3) {
      toast.error("Coupon code must be at least 3 characters");
      return;
    }
    setBusy("coupon");
    try {
      await createCoupon({
        restaurantId,
        code: couponForm.code,
        description: couponForm.description || undefined,
        type: couponForm.type as "percent" | "flat",
        value: Number(couponForm.value) || 0,
        minOrder: Number(couponForm.minOrder) || 0,
        maxDiscount: couponForm.maxDiscount ? Number(couponForm.maxDiscount) : undefined,
        endsAt: couponForm.endsAt ? new Date(couponForm.endsAt).getTime() : undefined,
        startTime: couponForm.startTime || undefined,
        endTime: couponForm.endTime || undefined,
        daysOfWeek: couponForm.daysOfWeek.length > 0 ? couponForm.daysOfWeek : undefined,
        maxUses: couponForm.maxUses ? Number(couponForm.maxUses) : undefined,
      });
      toast.success(`Coupon ${couponForm.code.toUpperCase()} created`);
      setCouponDialog(false);
      setCouponForm({
        code: "",
        description: "",
        type: "percent",
        value: "10",
        minOrder: "0",
        maxDiscount: "",
        endsAt: "",
        startTime: "",
        endTime: "",
        daysOfWeek: [],
        maxUses: "",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the coupon");
    } finally {
      setBusy(null);
    }
  };

  const handleCreateCampaign = async () => {
    if (!campaignForm.name.trim() || !campaignForm.body.trim()) {
      toast.error("Name and message are required");
      return;
    }
    setBusy("campaign");
    try {
      await createCampaign({
        restaurantId,
        name: campaignForm.name,
        channel: campaignForm.channel as "email" | "sms" | "whatsapp",
        audience: campaignForm.audience as "all" | "repeat" | "lapsed" | "high_spenders",
        subject: campaignForm.subject || undefined,
        body: campaignForm.body,
        fromAddress: campaignForm.fromAddress || undefined,
      });
      toast.success("Campaign saved as a draft");
      setCampaignDialog(false);
      setCampaignForm({
        name: "",
        channel: "email",
        audience: "all",
        subject: "",
        body: "",
        fromAddress: "",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the campaign");
    } finally {
      setBusy(null);
    }
  };

  const handleSendEmail = async (campaignId: Id<"campaigns">) => {
    setBusy(`send-${campaignId}`);
    try {
      const result = await sendEmailCampaign({ campaignId });
      if (result.sent) {
        toast.success(`Sent to ${result.sentCount} guest(s)`);
      } else {
        toast.error(result.reason ?? "Nothing was sent");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Send failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex w-fit gap-1 rounded-lg border border-green-100 bg-white p-1">
        <button
          className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === "coupons" ? "bg-[#4A8C6F] text-white" : "text-gray-500 hover:text-[#4A8C6F]"
          }`}
          onClick={() => setTab("coupons")}
        >
          <Ticket className="h-3.5 w-3.5" /> Coupons & happy hour
        </button>
        <button
          className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === "campaigns" ? "bg-[#4A8C6F] text-white" : "text-gray-500 hover:text-[#4A8C6F]"
          }`}
          onClick={() => setTab("campaigns")}
        >
          <Send className="h-3.5 w-3.5" /> Campaigns
        </button>
      </div>

      {tab === "coupons" && (
        <Card className="border-green-100 bg-white">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-green-100 px-5 py-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Coupon codes</h3>
                <p className="text-[11px] text-gray-400">
                  Customers apply these at QR checkout. Happy hour offers only apply inside their
                  daily window.
                </p>
              </div>
              <Button
                size="sm"
                className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
                onClick={() => setCouponDialog(true)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> New coupon
              </Button>
            </div>
            {coupons.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Percent className="mx-auto mb-2 h-7 w-7 text-green-300" />
                <p className="text-sm text-gray-500">
                  No coupons yet. Create a welcome offer or a weekday happy hour.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-green-50">
                {coupons.map((coupon) => (
                  <div key={coupon._id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <span className="rounded-md border border-dashed border-green-300 bg-green-50 px-2.5 py-1 font-mono text-xs font-bold tracking-wide text-[#3D7A5F]">
                      {coupon.code}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800">
                        {coupon.type === "percent"
                          ? `${coupon.value}% off`
                          : `${money(coupon.value)} off`}
                        {coupon.minOrder > 0 && (
                          <span className="ml-1 text-[11px] font-normal text-gray-400">
                            on orders over {money(coupon.minOrder)}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {coupon.description ? `${coupon.description} · ` : ""}
                        {coupon.window} · used {coupon.usedCount}
                        {coupon.remaining !== null ? `/${coupon.maxUses}` : ""}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        coupon.isActive
                          ? "border-green-200 bg-green-50 text-[#3D7A5F]"
                          : "border-gray-200 bg-gray-50 text-gray-500"
                      }`}
                    >
                      {coupon.isActive ? "Active" : "Paused"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 cursor-pointer px-2 text-[11px] text-gray-500 hover:bg-gray-100"
                      onClick={() => updateCoupon({ id: coupon._id, isActive: !coupon.isActive })}
                    >
                      {coupon.isActive ? "Pause" : "Resume"}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 cursor-pointer text-gray-400 hover:bg-red-50 hover:text-red-500"
                      onClick={async () => {
                        try {
                          await removeCoupon({ id: coupon._id });
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Could not delete");
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "campaigns" && (
        <Card className="border-green-100 bg-white">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-green-100 px-5 py-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Campaigns</h3>
                <p className="text-[11px] text-gray-400">
                  Email sends from your own verified domain. SMS and WhatsApp are exported for your
                  messaging tool.
                </p>
              </div>
              <Button
                size="sm"
                className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
                onClick={() => setCampaignDialog(true)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> New campaign
              </Button>
            </div>
            {campaigns.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Send className="mx-auto mb-2 h-7 w-7 text-green-300" />
                <p className="text-sm text-gray-500">
                  Bring guests back with a targeted offer. Audiences are built from your customer
                  list.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-green-50">
                {campaigns.map((campaign) => (
                  <CampaignRow
                    key={campaign._id}
                    campaign={campaign}
                    busy={busy === `send-${campaign._id}`}
                    onSend={() => handleSendEmail(campaign._id)}
                    onHandOff={async (count) => {
                      try {
                        await handOffCampaign({ id: campaign._id, recipientCount: count });
                        toast.success(
                          count > 0
                            ? `Exported ${count} contact(s) and marked as handed off`
                            : "Campaign marked as handed off",
                        );
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Could not update");
                      }
                    }}
                    onDelete={() => deleteCampaign({ id: campaign._id })}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Coupon dialog */}
      <Dialog open={couponDialog} onOpenChange={setCouponDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New coupon</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-xs">Code *</Label>
                <Input
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                  placeholder="WELCOME10"
                  className="font-mono"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Type</Label>
                <Select
                  value={couponForm.type}
                  onValueChange={(value) => setCouponForm({ ...couponForm, type: value })}
                >
                  <SelectTrigger className="cursor-pointer text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent" className="cursor-pointer text-sm">
                      Percentage
                    </SelectItem>
                    <SelectItem value="flat" className="cursor-pointer text-sm">
                      Flat amount
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="mb-1.5 block text-xs">Value *</Label>
                <Input
                  type="number"
                  value={couponForm.value}
                  onChange={(e) => setCouponForm({ ...couponForm, value: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Min order</Label>
                <Input
                  type="number"
                  value={couponForm.minOrder}
                  onChange={(e) => setCouponForm({ ...couponForm, minOrder: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Max uses</Label>
                <Input
                  type="number"
                  value={couponForm.maxUses}
                  onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })}
                  placeholder="∞"
                />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Description</Label>
              <Input
                value={couponForm.description}
                onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
                placeholder="Weekday lunch offer"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Happy hour window (optional)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="time"
                  value={couponForm.startTime}
                  onChange={(e) => setCouponForm({ ...couponForm, startTime: e.target.value })}
                />
                <Input
                  type="time"
                  value={couponForm.endTime}
                  onChange={(e) => setCouponForm({ ...couponForm, endTime: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Valid on</Label>
              <div className="flex flex-wrap gap-1">
                {DAY_LABELS.map((label, index) => {
                  const active = couponForm.daysOfWeek.includes(index);
                  return (
                    <button
                      key={label}
                      className={`cursor-pointer rounded-md border px-2 py-1 text-[11px] font-medium ${
                        active
                          ? "border-[#4A8C6F] bg-[#4A8C6F] text-white"
                          : "border-green-200 text-gray-500 hover:bg-green-50"
                      }`}
                      onClick={() =>
                        setCouponForm({
                          ...couponForm,
                          daysOfWeek: active
                            ? couponForm.daysOfWeek.filter((day) => day !== index)
                            : [...couponForm.daysOfWeek, index],
                        })
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[10px] text-gray-400">
                Leave every day unselected to make the coupon valid all week.
              </p>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Expires on (optional)</Label>
              <Input
                type="date"
                value={couponForm.endsAt}
                onChange={(e) => setCouponForm({ ...couponForm, endsAt: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setCouponDialog(false)}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
              disabled={busy === "coupon"}
              onClick={handleCreateCoupon}
            >
              Create coupon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign dialog */}
      <Dialog open={campaignDialog} onOpenChange={setCampaignDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="mb-1.5 block text-xs">Name *</Label>
              <Input
                value={campaignForm.name}
                onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                placeholder="Weekend brunch offer"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-xs">Channel</Label>
                <Select
                  value={campaignForm.channel}
                  onValueChange={(value) => setCampaignForm({ ...campaignForm, channel: value })}
                >
                  <SelectTrigger className="cursor-pointer text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email" className="cursor-pointer text-sm">
                      Email
                    </SelectItem>
                    <SelectItem value="sms" className="cursor-pointer text-sm">
                      SMS (handoff)
                    </SelectItem>
                    <SelectItem value="whatsapp" className="cursor-pointer text-sm">
                      WhatsApp (handoff)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Audience</Label>
                <Select
                  value={campaignForm.audience}
                  onValueChange={(value) => setCampaignForm({ ...campaignForm, audience: value })}
                >
                  <SelectTrigger className="cursor-pointer text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="cursor-pointer text-sm">
                      All guests ({audience?.all ?? 0})
                    </SelectItem>
                    <SelectItem value="repeat" className="cursor-pointer text-sm">
                      Repeat ({audience?.repeat ?? 0})
                    </SelectItem>
                    <SelectItem value="lapsed" className="cursor-pointer text-sm">
                      Lapsed ({audience?.lapsed ?? 0})
                    </SelectItem>
                    <SelectItem value="high_spenders" className="cursor-pointer text-sm">
                      High spenders ({audience?.high_spenders ?? 0})
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {campaignForm.channel === "email" && (
              <>
                <div>
                  <Label className="mb-1.5 block text-xs">Subject *</Label>
                  <Input
                    value={campaignForm.subject}
                    onChange={(e) => setCampaignForm({ ...campaignForm, subject: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">From address (your domain)</Label>
                  <Input
                    value={campaignForm.fromAddress}
                    onChange={(e) =>
                      setCampaignForm({ ...campaignForm, fromAddress: e.target.value })
                    }
                    placeholder="Spice House <offers@spicehouse.com>"
                  />
                </div>
              </>
            )}
            <div>
              <Label className="mb-1.5 block text-xs">Message *</Label>
              <Textarea
                rows={5}
                value={campaignForm.body}
                onChange={(e) => setCampaignForm({ ...campaignForm, body: e.target.value })}
                placeholder="Hi! This weekend only: 20% off all desserts. Use code SWEET20 at checkout."
              />
            </div>
            {campaignForm.channel !== "email" && (
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
                SMS and WhatsApp are handed to your messaging tool: export the audience CSV, run the
                blast there, and the campaign is marked as handed off.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setCampaignDialog(false)}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
              disabled={busy === "campaign"}
              onClick={handleCreateCampaign}
            >
              Save draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
