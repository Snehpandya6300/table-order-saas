import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import {
  LayoutDashboard,
  Users,
  UtensilsCrossed,
  LogOut,
  QrCode,
} from "lucide-react";

export default function Admin() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const restaurants = useQuery(api.restaurants.list);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (!restaurants) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const totalOrders = 0; // Would be aggregated in a real admin query

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
              <QrCode className="h-4 w-4 text-background" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Admin Panel</h1>
              <p className="text-[11px] text-muted-foreground">
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

      <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Overview</h2>
          <p className="text-sm text-muted-foreground">
            Platform-wide statistics and restaurant management.
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <UtensilsCrossed className="h-3.5 w-3.5" />
              <span className="text-xs">Restaurants</span>
            </div>
            <span className="text-2xl font-bold">{restaurants.length}</span>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-3.5 w-3.5" />
              <span className="text-xs">Active Trials</span>
            </div>
            <span className="text-2xl font-bold">
              {restaurants.filter((r) => r.subscriptionStatus === "trial")
                .length}
            </span>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span className="text-xs">Active Subscriptions</span>
            </div>
            <span className="text-2xl font-bold">
              {restaurants.filter((r) => r.subscriptionStatus === "active")
                .length}
            </span>
          </Card>
        </div>

        {/* Restaurant List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Restaurants</CardTitle>
          </CardHeader>
          <CardContent>
            {restaurants.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No restaurants registered yet.
              </p>
            ) : (
              <div className="divide-y rounded-lg border">
                {restaurants.map((r) => (
                  <div key={r._id} className="flex items-center gap-4 p-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.slug} · Created{" "}
                        {new Date(r.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize text-xs">
                      {r.subscriptionStatus ?? "trial"}
                    </Badge>
                    <Badge
                      variant={r.isOpen ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {r.isOpen ? "Open" : "Closed"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
