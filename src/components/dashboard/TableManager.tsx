import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
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
  QrCode,
  Download,
  Copy,
  Check,
  Hash,
  XCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";

export function TableManager({
  restaurantId,
  restaurantSlug,
}: {
  restaurantId: Id<"restaurants">;
  restaurantSlug: string;
}) {
  const tokens = useQuery(api.tokens.getByRestaurant, { restaurantId });
  const activeTokens = useQuery(api.tokens.getActiveTokens, { restaurantId });
  const createToken = useMutation(api.tokens.create);
  const completeToken = useMutation(api.tokens.complete);
  const cancelToken = useMutation(api.tokens.cancel);
  const tokenStats = useQuery(api.tokens.getStats, { restaurantId });

  const [showNewTokenDialog, setShowNewTokenDialog] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenPhone, setNewTokenPhone] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!tokens) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading tokens...
      </div>
    );
  }

  const getQrUrl = (tokenId: string) => `${window.location.origin}/q/${tokenId}`;

  const handleCopyLink = (tokenId: string) => {
    navigator.clipboard.writeText(getQrUrl(tokenId));
    setCopiedId(tokenId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadQr = (tokenId: string, tokenNumber: number) => {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(getQrUrl(tokenId))}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-token-${tokenNumber}.png`;
    a.target = "_blank";
    a.click();
  };

  const handleCreateToken = async () => {
    await createToken({ restaurantId, customerName: newTokenName.trim() || undefined, customerPhone: newTokenPhone.trim() || undefined });
    setShowNewTokenDialog(false);
    setNewTokenName("");
    setNewTokenPhone("");
  };

  const statusConfig = {
    active: { label: "Active", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: Clock },
    completed: { label: "Completed", color: "bg-gray-50 text-gray-600 border-gray-200", icon: CheckCircle2 },
    cancelled: { label: "Cancelled", color: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  } as const;

  const sortedTokens = [...tokens].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tokens</h2>
          <p className="text-sm text-muted-foreground">Create tokens and generate QR codes for counter ordering.</p>
        </div>
        <Button size="sm" className="cursor-pointer" onClick={() => setShowNewTokenDialog(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />New Token
        </Button>
      </div>

      {tokenStats && (
        <div className="grid gap-3 grid-cols-3">
          <Card className="p-3"><div className="flex items-center gap-1.5 text-muted-foreground mb-0.5"><Hash className="h-3 w-3" /><span className="text-[11px]">Total</span></div><span className="text-lg font-bold">{tokenStats.totalTokens}</span></Card>
          <Card className="p-3"><div className="flex items-center gap-1.5 text-muted-foreground mb-0.5"><Clock className="h-3 w-3" /><span className="text-[11px]">Active</span></div><span className="text-lg font-bold">{tokenStats.activeTokens}</span></Card>
          <Card className="p-3"><div className="flex items-center gap-1.5 text-muted-foreground mb-0.5"><QrCode className="h-3 w-3" /><span className="text-[11px]">Today</span></div><span className="text-lg font-bold">{tokenStats.todayTokens}</span></Card>
        </div>
      )}

      {activeTokens && activeTokens.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Active Tokens ({activeTokens.length})</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeTokens.map((token) => (
              <Card key={token._id} className="overflow-hidden border-emerald-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">#{token.tokenNumber}</span>
                        <Badge variant="outline" className={`text-[10px] ${statusConfig.active.color}`}>Active</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{token.customerName || "Walk-in"} · {token.orderCount} order{token.orderCount !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="flex justify-center py-2">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(getQrUrl(token._id))}`} alt={`QR for Token #${token.tokenNumber}`} className="rounded-lg" />
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <Button variant="outline" size="sm" className="cursor-pointer flex-1 text-[11px] h-8" onClick={() => handleCopyLink(token._id)}>
                      {copiedId === token._id ? <><Check className="mr-1 h-3 w-3" />Copied</> : <><Copy className="mr-1 h-3 w-3" />Link</>}
                    </Button>
                    <Button variant="outline" size="sm" className="cursor-pointer flex-1 text-[11px] h-8" onClick={() => handleDownloadQr(token._id, token.tokenNumber)}><Download className="mr-1 h-3 w-3" />QR</Button>
                    <Button variant="outline" size="sm" className="cursor-pointer h-8 w-8 p-0" onClick={() => completeToken({ id: token._id })} title="Complete"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /></Button>
                    <Button variant="ghost" size="sm" className="cursor-pointer h-8 w-8 p-0 text-destructive" onClick={() => cancelToken({ id: token._id })} title="Cancel"><XCircle className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">All Tokens</h3>
        {sortedTokens.length === 0 ? (
          <Card><CardContent className="py-12 text-center"><Hash className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" /><p className="text-sm text-muted-foreground">No tokens yet. Create your first token to start taking orders.</p></CardContent></Card>
        ) : (
          <div className="divide-y rounded-lg border">
            {sortedTokens.map((token) => {
              const config = statusConfig[token.status];
              const StatusIcon = config.icon;
              return (
                <div key={token._id} className="flex items-center gap-4 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted font-bold text-sm">#{token.tokenNumber}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{token.customerName || "Walk-in"}</span>
                      <Badge variant="outline" className={`text-[10px] ${config.color}`}><StatusIcon className="mr-1 h-3 w-3" />{config.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{token.orderCount} order{token.orderCount !== 1 ? "s" : ""} · {new Date(token.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="cursor-pointer h-7 w-7 p-0" onClick={() => handleCopyLink(token._id)} title="Copy link">
                      {copiedId === token._id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="cursor-pointer h-7 w-7 p-0" onClick={() => handleDownloadQr(token._id, token.tokenNumber)} title="Download QR"><Download className="h-3.5 w-3.5" /></Button>
                    {token.status === "active" && (
                      <>
                        <Button variant="ghost" size="sm" className="cursor-pointer h-7 w-7 p-0 text-emerald-600" onClick={() => completeToken({ id: token._id })} title="Complete"><CheckCircle2 className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="cursor-pointer h-7 w-7 p-0 text-destructive" onClick={() => cancelToken({ id: token._id })} title="Cancel"><XCircle className="h-3.5 w-3.5" /></Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showNewTokenDialog} onOpenChange={setShowNewTokenDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>New Token</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="mb-1.5 block text-sm font-medium">Customer Name <span className="text-muted-foreground">(optional)</span></label><Input placeholder="Walk-in" value={newTokenName} onChange={(e) => setNewTokenName(e.target.value)} /></div>
            <div><label className="mb-1.5 block text-sm font-medium">Phone Number <span className="text-muted-foreground">(optional)</span></label><Input placeholder="For notifications" value={newTokenPhone} onChange={(e) => setNewTokenPhone(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">A unique token number will be generated automatically.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setShowNewTokenDialog(false)}>Cancel</Button>
            <Button className="cursor-pointer" onClick={handleCreateToken}>Create Token</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
